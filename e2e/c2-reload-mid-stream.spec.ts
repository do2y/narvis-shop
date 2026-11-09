import type { Page } from "@playwright/test";

import type { SseServer, SseStream } from "./support/sseServer";
import type { ApiMock } from "./support/apiMock";
// 별칭: `use` 로 시작하는 이름을 react-hooks 규칙이 훅 호출로 오인한다(하네스 이름 정리는 후속)
import { useGuestShoppingDefaults as applyGuestDefaults } from "./support/apiMock";
import { expect, test } from "./support/fixtures";

/**
 * T2-C2 — 답변 스트리밍 중 새로고침 (회귀 테스트).
 *
 * 지키는 약속: 새로고침으로 끊긴 응답이 **완료된 답변처럼 복원되지 않는다.**
 * 중단 안내가 보이고, 입력이 가능하며, 같은 질문이 자동으로 다시 나가지 않는다.
 *
 * ⚠️ 한계 — 현재 Chromium 에서 관찰된 동작을 고정한 것이다. 이 동작은 설계된 것이 아니라
 * 페이지 해제 중 `reader.read()` 가 TypeError("network error")로 끝나고, useChat 의 catch 가
 * 실패를 표시한 뒤 스토어 구독이 sessionStorage 에 **해제 전에** 저장을 마치는 타이밍에 기댄다.
 * 다른 브라우저·탭 강제 종료·모바일 백그라운드 종료에서 같다고 일반화하지 않는다.
 * 기록: docs/ai-development/2026-11-09-browser-e2e/c2-reload-mid-stream.md
 *
 * 저장 시점(새 문서 시작 순간의 저장값)은 단언하지 않고 진단용으로 첨부만 한다 —
 * 그것은 메커니즘이지 사용자 결과가 아니다. 타이밍에 기대지 않는 방식으로 고치면
 * 그 값은 달라져도 아래 약속은 그대로여야 한다.
 */

const STORAGE_KEY = "chat:session"; // src/shared/chat/chatPersistence.ts
const QUESTION = "러닝화 추천해줘";
/** useChat.ts catch 기본 분기의 문구 — 현재 Chromium 에서 새로고침이 이 분기로 간다 */
const INTERRUPTED_NOTICE = "응답을 받지 못했어요. 다시 시도해 주세요.";

interface StoredMessage {
  role: string;
  text: string;
  error?: string;
  retryable?: boolean;
}

function parseMessages(raw: string | null): StoredMessage[] {
  if (!raw) return [];
  return (JSON.parse(raw) as { messages: StoredMessage[] }).messages;
}

function chatForm(page: Page) {
  return page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "전송" }) });
}

const readStorage = (page: Page) =>
  page.evaluate((key) => sessionStorage.getItem(key), STORAGE_KEY);

async function startTurn(page: Page, sse: SseServer, api: ApiMock) {
  applyGuestDefaults(api, { llmSseUrl: sse.streamUrl });
  await page.goto("/chat");
  await chatForm(page).getByRole("textbox").fill(QUESTION);
  await chatForm(page).getByRole("button", { name: "전송" }).click();
  await expect
    .poll(() => sse.requests.length, { message: "SSE POST 도착" })
    .toBe(1);
  const stream = await sse.nextStream();
  stream.open();
  return stream;
}

/** 새로고침하고, 복원이 끝난 시점(복원된 질문 말풍선이 보임)까지 기다린다 */
async function reloadAndWaitRestored(page: Page, stream: SseStream) {
  await page.reload();
  await expect(page.getByText(QUESTION, { exact: true })).toBeVisible();
  await expect
    .poll(() => stream.clientClosed, {
      message: "이전 SSE 연결이 브라우저에서 끊김",
    })
    .toBe(true);
}

/** 정책 약속 2~5 — 두 시나리오가 공유한다 */
async function expectInterruptedNotCompleted(
  page: Page,
  sse: SseServer,
  api: ApiMock,
  issuedBeforeReload: number,
) {
  // (2) 완료된 답변처럼 보이지 않는다 — 진행 중으로 보이지도 않는다
  await expect(page.getByLabel("입력 중")).toHaveCount(0);
  // 복원된 마지막 말풍선이 실패로 표시된 상태다(화면의 근거가 되는 상태)
  const messages = parseMessages(await readStorage(page));
  expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  expect(messages[0].text).toBe(QUESTION);
  expect(messages[1].error, "복원된 응답이 실패로 표시됨").toBeTruthy();

  // (3) 사용자가 중단을 알 수 있는 안내와, 그 턴에 대한 재시도 수단
  await expect(page.getByText(INTERRUPTED_NOTICE, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(1);

  // (4) 입력이 가능하다 — 응답 중 잠금이 남아 있지 않다
  const form = chatForm(page);
  await form.getByRole("textbox").fill("다음 질문");
  await expect(form.getByRole("button", { name: "전송" })).toBeEnabled();

  // (5) 새로고침이 같은 질문을 다시 보내지 않는다(자동 재시도 금지).
  // 재전송이라면 세션·티켓 발급이 먼저 나가므로 그 횟수도 함께 본다.
  // 한계: "복원 완료 + 입력 확인" 시점까지의 관찰이다 — 그 뒤의 지연 재전송은 보지 않는다.
  expect(sse.requests).toHaveLength(1);
  expect(issuedCount(api)).toBe(issuedBeforeReload);
}

function issuedCount(api: ApiMock): number {
  return api.calls.filter(
    (c) => c.path === "/api/chat/sessions" || c.path === "/api/chat/tickets",
  ).length;
}

test.beforeEach(async ({ page }) => {
  // 진단: 새 문서가 시작되는 순간(앱 스크립트 실행 전)의 저장값 — 단언하지 않는다
  await page.addInitScript((key) => {
    (window as unknown as { __atDocStart: string | null }).__atDocStart =
      sessionStorage.getItem(key);
  }, STORAGE_KEY);
});

test.afterEach(async ({ page }, testInfo) => {
  const atDocStart = await page
    .evaluate(() => (window as unknown as { __atDocStart: string | null }).__atDocStart)
    .catch(() => null);
  await testInfo.attach("storage-at-new-doc-start.json", {
    body: JSON.stringify(parseMessages(atDocStart), null, 2),
    contentType: "application/json",
  });
});

test("T2-C2a 토큰 일부를 받은 뒤 새로고침하면 중단된 응답으로 복원된다", async ({
  page,
  sse,
  api,
}, testInfo) => {
  const stream = await startTurn(page, sse, api);
  stream.send("progress", { stage: "searching", message: "상품을 찾고 있어요" });
  stream.send("token", { text: "조건에 맞는 러닝화를 " });
  stream.send("token", { text: "두 켤레 찾았고, 이유를 " });
  // done·error 를 보내지 않는다 — 스트림은 열린 채다
  const partial = "조건에 맞는 러닝화를 두 켤레 찾았고, 이유를";

  // (1) 전제: 부분 응답이 화면과 저장소에 있다
  await expect(page.getByText(partial)).toBeVisible();
  await expect
    .poll(async () => parseMessages(await readStorage(page)).at(-1)?.text, {
      message: "새로고침 전 저장소의 마지막 assistant 문구",
    })
    .toBe("조건에 맞는 러닝화를 두 켤레 찾았고, 이유를 ");
  expect(parseMessages(await readStorage(page)).at(-1)?.error).toBeUndefined();
  await page.screenshot({ path: testInfo.outputPath("1-before-reload.png") });
  const issued = issuedCount(api);

  await reloadAndWaitRestored(page, stream);
  await page.screenshot({ path: testInfo.outputPath("2-after-reload.png") });

  // (2) 부분 답변이 일반 답변 말풍선으로 남지 않는다.
  // 현재는 실패 말풍선이 본문 대신 안내만 그린다. 부분 답변을 안내와 함께 보존하기로
  // 정하면(후속 과제 C) 이 단언은 "안내와 같은 말풍선 안에 있다"로 바뀌어야 한다.
  await expect(page.getByText(partial)).toHaveCount(0);
  await expectInterruptedNotCompleted(page, sse, api, issued);
});

test("T2-C2b 진행 표시만 받은 뒤 새로고침하면 중단된 응답으로 복원된다", async ({
  page,
  sse,
  api,
}, testInfo) => {
  const stream = await startTurn(page, sse, api);
  stream.send("progress", { stage: "searching", message: "상품을 찾고 있어요" });

  // (1) 전제: 진행 표시가 화면에 있고, 저장소엔 빈 assistant 말풍선이 있다
  await expect(page.getByText("상품을 찾고 있어요")).toBeVisible();
  await expect
    .poll(async () => parseMessages(await readStorage(page)).at(-1)?.role, {
      message: "새로고침 전 저장소에 assistant 말풍선이 있음",
    })
    .toBe("assistant");
  const before = parseMessages(await readStorage(page)).at(-1);
  expect(before?.text).toBe("");
  expect(before?.error).toBeUndefined();
  await page.screenshot({ path: testInfo.outputPath("1-before-reload.png") });
  const issued = issuedCount(api);

  await reloadAndWaitRestored(page, stream);
  await page.screenshot({ path: testInfo.outputPath("2-after-reload.png") });

  // (2) 진행 중이던 상태가 그대로 보이지 않는다
  await expect(page.getByText("상품을 찾고 있어요")).toHaveCount(0);
  await expectInterruptedNotCompleted(page, sse, api, issued);
});
