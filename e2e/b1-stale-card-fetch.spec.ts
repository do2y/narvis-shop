import type { Page } from "@playwright/test";

// 별칭: `use` 로 시작하는 이름을 react-hooks 규칙이 훅 호출로 오인한다(하네스 이름 정리는 후속)
import {
  chatList,
  ok,
  useGuestShoppingDefaults as applyGuestDefaults,
} from "./support/apiMock";
import { expect, test } from "./support/fixtures";

/**
 * T2-B1 — 이전 턴의 카드 조회(CH-5)가 늦게 끝나도 새 대화에 들어오지 않는다.
 *
 * T1(jsdom)은 `fetchChatListGroup` 을 목으로 바꿔 훅·이벤트 핸들러 수준에서 확인했다(A1 · A2·A3).
 * 여기서는 실제 브라우저에서 다음을 본다:
 * - 실제 HTTP 요청이 서버에 도착해 붙잡힌 채로 사용자가 "새 대화"를 누르고 새 질문을 보낸다
 * - 이전 요청은 취소되지 않고(CH-5 에는 abort 신호가 없다) **새 턴 시작 뒤 200 으로 브라우저에 도착**한다
 * - 그 뒤의 화면 · 새 턴의 응답 중 상태 · sessionStorage · 새로고침 복원
 *
 * 순서는 고정 대기 없이 만든다: 이전 CH-5 응답은 테스트가 풀어줄 때까지 서버가 보내지 않고,
 * 테스트는 새 턴의 SSE 요청 도착을 확인한 뒤에만 풀어준다.
 */

const STORAGE_KEY = "chat:session"; // src/shared/chat/chatPersistence.ts
const OLD_Q = "러닝화 추천해줘";
const NEW_Q = "등산화 보여줘";
const OLD_LIST = "b1-old-list";
const NEW_LIST = "b1-new-list";
const OLD_CARDS = ["이전턴 러닝화 A", "이전턴 러닝화 B"];
const NEW_CARDS = ["새턴 등산화 A", "새턴 등산화 B"];

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

interface Stored {
  messages: { role: string; text: string }[];
  results: unknown[];
}
const readStorage = async (page: Page): Promise<Stored | null> => {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Stored) : null;
};

test("T2-B1 이전 턴의 CH-5 응답이 새 턴 시작 뒤 도착해도 새 대화에 섞이지 않는다", async ({
  page,
  sse,
  api,
}, testInfo) => {
  applyGuestDefaults(api, { llmSseUrl: sse.streamUrl });

  // 서버 쪽 사건 기록 — 순서 단언의 근거
  const timeline: string[] = [];
  let releaseOld!: () => void;
  const oldReleased = new Promise<void>((r) => (releaseOld = r));

  api.on("GET", new RegExp(`^/api/chat/lists/${OLD_LIST}$`), async () => {
    timeline.push("old-ch5:arrived-at-server");
    await oldReleased; // 테스트가 풀어줄 때까지 응답하지 않는다
    timeline.push("old-ch5:server-responded");
    return ok(chatList(OLD_LIST, OLD_CARDS));
  });
  api.on("GET", new RegExp(`^/api/chat/lists/${NEW_LIST}$`), () =>
    ok(chatList(NEW_LIST, NEW_CARDS)),
  );

  await page.goto("/chat");

  // ── 이전 턴: 답변 → products.ready → done. CH-5 는 서버에서 붙잡힌다 ──
  await send(page, OLD_Q);
  await expect.poll(() => sse.requests.length, { message: "이전 턴 SSE 도착" }).toBe(1);
  const oldStream = await sse.nextStream();
  oldStream.open();
  oldStream.send("token", { text: "이전 턴 답변입니다." });
  const oldResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === `/api/chat/lists/${OLD_LIST}`,
  );
  oldStream.send("products.ready", { listIds: [OLD_LIST] });
  oldStream.send("done", { finishReason: "stop" });
  oldStream.end();

  await expect
    .poll(() => timeline.includes("old-ch5:arrived-at-server"), {
      message: "이전 턴 CH-5 요청이 서버에 도착(실제로 시작됨)",
    })
    .toBe(true);
  await expect(page.getByText("이전 턴 답변입니다.")).toBeVisible();
  // 카드 조회를 기다리는 동안 이전 턴은 아직 응답 중이다(settle 대기) — 경쟁의 전제
  await chatForm(page).getByRole("textbox").fill("x");
  await expect(chatForm(page).getByRole("button", { name: "전송" })).toBeDisabled();

  // ── 사용자: 새 대화 → 새 질문 ──
  await page.getByRole("button", { name: "새 대화" }).click();
  timeline.push("user:new-chat");
  await expect(page.getByText(OLD_Q, { exact: true })).toHaveCount(0);
  await send(page, NEW_Q);
  await expect.poll(() => sse.requests.length, { message: "새 턴 SSE 도착" }).toBe(2);
  timeline.push("new-sse:arrived-at-server");
  const newStream = await sse.nextStream();
  newStream.open();
  newStream.send("progress", { stage: "searching", message: "등산화를 찾고 있어요" });
  newStream.send("token", { text: "새 턴 답변을 " });
  await expect(page.getByText("새 턴 답변을")).toBeVisible();

  // ── 이전 CH-5 를 이제 완료시킨다 ──
  releaseOld();
  const delivered = await oldResponse;
  expect(delivered.status()).toBe(200);
  // 본문까지 브라우저에 도착했다(취소·실패 아님)
  expect(await delivered.finished()).toBeNull();
  timeline.push("old-ch5:delivered-to-browser");

  // (4) 순서: 이전 요청은 새 대화 전에 시작됐고, 새 턴 시작 뒤에 완료됐다
  expect(timeline).toEqual([
    "old-ch5:arrived-at-server",
    "user:new-chat",
    "new-sse:arrived-at-server",
    "old-ch5:server-responded",
    "old-ch5:delivered-to-browser",
  ]);

  // 동기화 지점: 이전 응답 도착 뒤 새 턴의 다음 프레임이 화면에 반영될 때까지.
  // 이 시점에 이전 턴의 finally(endTurn)가 이미 실행됐다는 것은 정상 실행에서 직접 관찰하지
  // 않는다 — 근거는 결함 주입 M2(endTurn 소유권 검사 제거)에서 바로 이 단계가 실패한 것이다
  // (b1-stale-card-fetch.md). 브라우저가 두 연결의 작업을 도착 순서대로 처리한다는 전제에 기댄다.
  newStream.send("token", { text: "이어서 쓰는 중" });
  await expect(page.getByText("새 턴 답변을 이어서 쓰는 중")).toBeVisible();

  // (1) 이전 카드가 화면에 없다
  for (const name of OLD_CARDS) await expect(cardLink(page, name)).toHaveCount(0);
  // (2) 새 턴은 여전히 응답 중이다 — 이전 턴의 완료·정리가 새 턴의 상태를 풀지 않았다
  await chatForm(page).getByRole("textbox").fill("다음 질문");
  await expect(chatForm(page).getByRole("button", { name: "전송" })).toBeDisabled();
  await expect(page.getByText("등산화를 찾고 있어요")).toBeVisible();
  // 저장소에도 이전 카드·이전 질문이 없다(응답 중 시점)
  const midStorage = JSON.stringify(await readStorage(page));
  for (const name of OLD_CARDS) expect(midStorage).not.toContain(name);
  expect(midStorage).not.toContain(OLD_Q);
  await page.screenshot({ path: testInfo.outputPath("1-after-stale-delivery.png") });

  // ── 새 턴 완료 ──
  newStream.send("products.ready", { listIds: [NEW_LIST] });
  newStream.send("done", { finishReason: "stop" });
  newStream.end();
  for (const name of NEW_CARDS) await expect(cardLink(page, name)).toBeVisible();
  for (const name of OLD_CARDS) await expect(cardLink(page, name)).toHaveCount(0);
  await expect(chatForm(page).getByRole("button", { name: "전송" })).toBeEnabled();

  // (3) 저장소와 새로고침 복원
  const stored = await readStorage(page);
  expect(stored?.messages.map((m) => [m.role, m.text])).toEqual([
    ["user", NEW_Q],
    ["assistant", "새 턴 답변을 이어서 쓰는 중"],
  ]);
  const storedRaw = JSON.stringify(stored);
  for (const name of OLD_CARDS) expect(storedRaw).not.toContain(name);
  for (const name of NEW_CARDS) expect(storedRaw).toContain(name);

  await page.reload();
  await expect(page.getByText(NEW_Q, { exact: true })).toBeVisible();
  for (const name of NEW_CARDS) await expect(cardLink(page, name)).toBeVisible();
  for (const name of OLD_CARDS) await expect(cardLink(page, name)).toHaveCount(0);
  await expect(page.getByText(OLD_Q, { exact: true })).toHaveCount(0);
  await expect(page.getByText("이전 턴 답변입니다.")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("2-after-reload.png") });

  // 요청 수: SSE 2(턴당 1) · 이전·새 CH-5 각 1 · 등록 안 된 호출 없음
  expect(sse.requests).toHaveLength(2);
  const count = (p: string) => api.calls.filter((c) => c.path === p).length;
  expect(count(`/api/chat/lists/${OLD_LIST}`)).toBe(1);
  expect(count(`/api/chat/lists/${NEW_LIST}`)).toBe(1);
  expect(api.unhandled).toEqual([]);

  await testInfo.attach("b1-timeline.json", {
    body: JSON.stringify(timeline, null, 2),
    contentType: "application/json",
  });
});
