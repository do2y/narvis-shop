import type { Page } from "@playwright/test";

// 별칭: `use` 로 시작하는 이름을 react-hooks 규칙이 훅 호출로 오인한다(하네스 이름 정리는 후속)
import {
  chatList,
  ok,
  useGuestShoppingDefaults as applyGuestDefaults,
} from "./support/apiMock";
import { expect, test } from "./support/fixtures";

/**
 * T2-C2c — SSE 는 `done` 으로 끝났지만 추천 카드 조회(CH-5)가 끝나기 전에 새로고침한다.
 *
 * 목적: "SSE 가 done 으로 끝난 시점"과 "카드 조회·화면 반영까지 끝난 시점"을 구분해, 그 사이 새로고침에서
 * 무엇이 저장·복원되는지 관찰한다. C3 개선(B안: 메시지 완료 상태 명시)의 "완료 시점" 결정 근거로 쓴다.
 *
 * ⚠️ 관찰 테스트다(정책 미정). 이 구간의 기대 표시는 정해지지 않았다. 단언은 재현 전제
 * (done 수신 뒤 턴이 카드 조회를 기다리는 중 · CH-5 가 서버에 도착해 붙잡힘)와 정책과 무관한 안전 조건
 * (자동 재전송 없음 · 입력 잠김 없음)에만 건다. 화면·저장소 상태는 관찰값으로 첨부한다.
 *
 * 이전 결과 오염을 보려고 턴 2개로 구성한다 — 턴1 은 카드 A 까지 정상 완료, 턴2 는 카드 B 조회 중 새로고침.
 */

const STORAGE_KEY = "chat:session";
const Q1 = "러닝화 추천해줘";
const Q2 = "등산화도 보여줘";
const A1 = "러닝화 두 켤레를 골랐어요.";
const A2 = "등산화 두 켤레를 골랐어요.";
const LIST_A = "c2c-list-a";
const LIST_B = "c2c-list-b";
const CARDS_A = ["턴1 러닝화 A", "턴1 러닝화 B"];
const CARDS_B = ["턴2 등산화 A", "턴2 등산화 B"];
/** chatEventHandler.ts — CH-5 조회가 하나도 안 됐을 때 답변에 덧붙는 문구 */
const CARD_FAIL_NOTE = "추천 카드를 새로 불러오지 못해 이전 결과를 그대로 두었어요.";

interface Stored {
  messages: { role: string; text: string; error?: string }[];
  results: unknown[];
}

const cardLink = (page: Page, name: string) =>
  page.getByRole("link", { name: `${name} 상세 보기 (새 탭)` });

function chatForm(page: Page) {
  return page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "전송" }) });
}

async function send(page: Page, text: string) {
  await chatForm(page).getByRole("textbox").fill(text);
  await chatForm(page).getByRole("button", { name: "전송" }).click();
}

const parse = (raw: string | null): Stored | null => (raw ? (JSON.parse(raw) as Stored) : null);

function summarize(s: Stored | null) {
  if (!s) return null;
  const raw = JSON.stringify(s.results);
  return {
    messages: s.messages.map((m) => ({ role: m.role, text: m.text, error: m.error })),
    resultsHaveCardsA: CARDS_A.some((n) => raw.includes(n)),
    resultsHaveCardsB: CARDS_B.some((n) => raw.includes(n)),
  };
}

async function observeScreen(page: Page) {
  const count = async (names: string[]) =>
    (await Promise.all(names.map((n) => cardLink(page, n).count()))).reduce((a, b) => a + b, 0);
  return {
    answer2Visible: (await page.getByText(A2, { exact: false }).count()) > 0,
    cardFailNoteVisible: (await page.getByText(CARD_FAIL_NOTE).count()) > 0,
    cardsAVisible: await count(CARDS_A),
    cardsBVisible: await count(CARDS_B),
    retryButtons: await page.getByRole("button", { name: "다시 시도" }).count(),
    typingIndicators: await page.getByLabel("입력 중").count(),
    failureNotices: await page.getByText(/응답을 받지 못했어요|응답 연결이 중간에 끊겼어요/).count(),
  };
}

test("T2-C2c 관찰 — done 뒤 카드 조회 중 새로고침의 저장·복원", async ({ page, sse, api }, testInfo) => {
  testInfo.annotations.push({ type: "observation", description: "정책 미정 — 화면·저장소 상태는 관찰값" });
  applyGuestDefaults(api, { llmSseUrl: sse.streamUrl });
  const timeline: string[] = [];
  let releaseB!: () => void;
  const bReleased = new Promise<void>((r) => (releaseB = r));
  api.on("GET", new RegExp(`^/api/chat/lists/${LIST_A}$`), () => ok(chatList(LIST_A, CARDS_A)));
  api.on("GET", new RegExp(`^/api/chat/lists/${LIST_B}$`), async () => {
    timeline.push("server:ch5-B-arrived");
    await bReleased; // 새로고침이 끝날 때까지 응답하지 않는다
    timeline.push("server:ch5-B-responded(after-reload)");
    return ok(chatList(LIST_B, CARDS_B));
  });

  // 새 문서가 시작되는 순간(앱 스크립트 실행 전)의 저장값 — 해제 중 마지막 저장을 보려고 남긴다
  await page.addInitScript((key) => {
    (window as unknown as { __atDocStart: string | null }).__atDocStart = sessionStorage.getItem(key);
  }, STORAGE_KEY);

  await page.goto("/chat");

  // ── 턴1: 카드 A 까지 정상 완료 ──
  await send(page, Q1);
  await expect.poll(() => sse.requests.length).toBe(1);
  const s1 = await sse.nextStream();
  s1.open();
  s1.send("token", { text: A1 });
  s1.send("products.ready", { listIds: [LIST_A] });
  s1.send("done", { finishReason: "stop" });
  s1.end();
  await expect(cardLink(page, CARDS_A[0])).toBeVisible();
  await chatForm(page).getByRole("textbox").fill("x");
  await expect(chatForm(page).getByRole("button", { name: "전송" })).toBeEnabled();
  timeline.push("turn1:complete");

  // ── 턴2: done 까지 받고, CH-5 B 는 서버에 붙잡힘 ──
  await send(page, Q2);
  await expect.poll(() => sse.requests.length).toBe(2);
  const s2 = await sse.nextStream();
  s2.open();
  s2.send("progress", { stage: "publishing", message: "추천을 정리하고 있어요" });
  s2.send("token", { text: A2 });
  s2.send("products.ready", { listIds: [LIST_B] });
  s2.send("done", { finishReason: "stop" });
  s2.end();
  timeline.push("server:turn2-done-sent");
  await expect
    .poll(() => timeline.includes("server:ch5-B-arrived"), { message: "CH-5 B 가 서버에 도착(조회 진행 중)" })
    .toBe(true);
  await expect(page.getByText(A2)).toBeVisible();
  // 재현 전제: done 은 받았지만 턴은 카드 조회를 기다리는 중이다(응답 중 상태)
  await chatForm(page).getByRole("textbox").fill("x");
  await expect(chatForm(page).getByRole("button", { name: "전송" })).toBeDisabled();
  const beforeReloadRaw = await page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY);
  const beforeReloadScreen = await observeScreen(page);
  await page.screenshot({ path: testInfo.outputPath("1-before-reload.png") });

  // ── 새로고침 ──
  const ch5Before = api.calls.filter((c) => c.path === `/api/chat/lists/${LIST_B}`).length;
  await page.reload();
  timeline.push("ui:reloaded");
  await expect(page.getByText(Q2, { exact: true })).toBeVisible();
  const atDocStartRaw = await page.evaluate(
    () => (window as unknown as { __atDocStart: string | null }).__atDocStart,
  );
  const afterReloadScreen = await observeScreen(page);
  const afterReloadRaw = await page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY);
  await page.screenshot({ path: testInfo.outputPath("2-after-reload.png") });

  // 붙잡아 둔 응답을 풀어 정리한다 — 이미 끊긴 요청이라 화면에 닿으면 안 된다
  releaseB();
  await expect
    .poll(() => timeline.includes("server:ch5-B-responded(after-reload)"))
    .toBe(true);

  // ── 안전 조건(단언) ──
  expect(sse.requests, "새로고침이 질문을 다시 보내지 않음").toHaveLength(2);
  expect(
    api.calls.filter((c) => c.path === `/api/chat/lists/${LIST_B}`).length,
    "새로고침 뒤 CH-5 B 를 다시 조회하지 않음(관찰과 함께 기록)",
  ).toBe(ch5Before);
  await chatForm(page).getByRole("textbox").fill("다음 질문");
  await expect(chatForm(page).getByRole("button", { name: "전송" })).toBeEnabled();
  // 늦게 풀린 이전 응답이 새 문서의 화면을 바꾸지 않음 — 다음 SSE 프레임이 아니라 다음 사용자 동작까지의 관찰
  const afterReleaseScreen = await observeScreen(page);

  const observation = {
    timeline,
    storage: {
      beforeReload: summarize(parse(beforeReloadRaw)),
      atNewDocStart: summarize(parse(atDocStartRaw)),
      afterReload: summarize(parse(afterReloadRaw)),
    },
    screen: { beforeReload: beforeReloadScreen, afterReload: afterReloadScreen, afterLateRelease: afterReleaseScreen },
    sse: { posts: sse.requests.length },
    unhandledApi: api.unhandled.map((c) => `${c.method} ${c.path}`),
  };
  await testInfo.attach("c2c-observation.json", {
    body: JSON.stringify(observation, null, 2),
    contentType: "application/json",
  });
  console.log("[C2c]", JSON.stringify(observation, null, 2));
});
