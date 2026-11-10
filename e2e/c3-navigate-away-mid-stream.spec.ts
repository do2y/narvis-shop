import type { Page } from "@playwright/test";

// 별칭: `use` 로 시작하는 이름을 react-hooks 규칙이 훅 호출로 오인한다(하네스 이름 정리는 후속)
import { ok, useGuestShoppingDefaults as applyGuestDefaults } from "./support/apiMock";
import { expect, test } from "./support/fixtures";

/**
 * T2-C3 — 답변 스트리밍 중 앱 안의 다른 화면으로 이동했다가 채팅으로 돌아온다.
 *
 * 정책 기준(서로 부딪칠 수 있다 — 결과를 현재 구현에 맞추지 않는다):
 * - P-a (T1 · stream-lifecycle-bugs ② · useChat.test `[C1]`): 화면을 떠난 것은 오류가 아니다 — **실패 말풍선을 남기지 않는다**
 * - P-b (T2-C2 판단 기준): 끊긴 답변은 **완료된 답변과 구분돼야 한다**
 * - P-c (T1 `[A·언마운트]` · 자동 재시도 금지): 자동 재전송 없음 · 입력이 잠기지 않음
 *
 * 단언: P-b · P-c 와 재현 전제(실제 이동 · 언마운트 abort 가 서버에 닿음). P-a 는 관찰값으로 남긴다.
 * 현재 구현은 실패 말풍선 외에 "중단" 표시 수단이 없어 P-a 를 지키면 P-b 가 깨질 수 있다 — 그 경우 이 테스트는 RED 다.
 */

const STORAGE_KEY = "chat:session";
const QUESTION = "러닝화 추천해줘";
const PARTIAL = "조건에 맞는 러닝화를 찾았고, 이유는";
/** 현재 코드가 가진 실패·중단 안내 문구(useChat catch 분기) — P-b 판정에 "중단을 알리는 표시"로 쓴다 */
const INTERRUPTION_NOTICES = [
  "응답을 받지 못했어요",
  "응답 연결이 중간에 끊겼어요",
  "대화가 만료되었어요",
];

interface StoredMessage {
  role: string;
  text: string;
  error?: string;
}

function chatForm(page: Page) {
  return page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "전송" }) });
}

const readMessages = async (page: Page): Promise<StoredMessage[]> => {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { messages: StoredMessage[] }).messages : [];
};

async function observeChatScreen(page: Page) {
  const notices = await Promise.all(
    INTERRUPTION_NOTICES.map((t) => page.getByText(t, { exact: false }).count()),
  );
  return {
    partialVisible: (await page.getByText(PARTIAL).count()) > 0,
    interruptionNotices: INTERRUPTION_NOTICES.filter((_, i) => notices[i] > 0),
    retryButtons: await page.getByRole("button", { name: "다시 시도" }).count(),
    typingIndicators: await page.getByLabel("입력 중").count(),
    // B안 1단계의 중단 상태 줄(role="status") — 실패가 아닌 "받은 데까지" 표시. P-b 의 "중단 표시"로 인정한다
    interruptedStatusLines: await page
      .getByRole("status")
      .filter({ hasText: "응답이 중단됐어요" })
      .count(),
  };
}

test("T2-C3 스트리밍 중 다른 화면으로 이동했다 돌아오면 끊긴 답변이 완료된 답변과 구분된다", async ({
  page,
  context,
  sse,
  api,
}, testInfo) => {
  applyGuestDefaults(api, { llmSseUrl: sse.streamUrl });
  // /home 서버 렌더링이 부르는 카테고리 — 계약 모양의 빈 목록
  api.on("GET", /^\/api\/categories$/, () => ok({ categories: [] }));
  // 앱의 fetch 호출 계측(테스트 전용, 제품 코드 무변경)
  await context.addInitScript((streamUrl) => {
    const w = window as unknown as { __e2eSseFetches?: string[] };
    // 클라이언트 내비게이션은 문서를 바꾸지 않아 이 스크립트가 다시 돌지 않는다 — 새 문서에서만 초기화된다
    w.__e2eSseFetches = [];
    const original = window.fetch;
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(streamUrl)) w.__e2eSseFetches!.push(String(init?.body ?? ""));
      return original.call(this, input, init);
    };
  }, sse.streamUrl);
  const appFetches = async () =>
    page.evaluate(() => (window as unknown as { __e2eSseFetches: string[] }).__e2eSseFetches.length);
  const timeline: string[] = [];

  // ── 질문 → 토큰 일부 ──
  await page.goto("/chat");
  await chatForm(page).getByRole("textbox").fill(QUESTION);
  await chatForm(page).getByRole("button", { name: "전송" }).click();
  await expect.poll(() => sse.requests.length, { message: "SSE POST 도착" }).toBe(1);
  const stream = await sse.nextStream();
  stream.open();
  stream.send("progress", { stage: "searching", message: "상품을 찾고 있어요" });
  stream.send("token", { text: "조건에 맞는 러닝화를 " });
  stream.send("token", { text: "찾았고, 이유는 " });
  await expect(page.getByText(PARTIAL)).toBeVisible();
  timeline.push("ui:partial-visible");
  const beforeNav = await readMessages(page);

  // ── 앱 안의 다른 화면으로 이동(클라이언트 내비게이션) — 스트림은 끝나지 않았다 ──
  await page.getByRole("link", { name: "Narvis 홈" }).first().click();
  await page.waitForURL("**/home");
  timeline.push("ui:navigated-home");
  // 재현 전제: 채팅 화면이 언마운트되며 abort 가 실제로 연결을 끊었다(서버 쪽에서 확인)
  await expect
    .poll(() => stream.clientClosed, { message: "언마운트 abort 가 SSE 연결을 끊음" })
    .toBe(true);
  timeline.push("server:client-closed");
  // 문서가 바뀌지 않았다 — fetch 계측이 이어져 있으면 클라이언트 내비게이션이다
  expect(await appFetches(), "클라이언트 내비게이션(같은 문서)").toBe(1);
  const atHome = await readMessages(page);

  // ── 채팅으로 복귀(브라우저 뒤로 가기) ──
  await page.goBack();
  await page.waitForURL("**/chat");
  await expect(page.getByText(QUESTION, { exact: true })).toBeVisible();
  await expect(chatForm(page).getByRole("textbox")).toBeVisible();
  timeline.push("ui:returned-chat");
  const afterReturn = await observeChatScreen(page);
  const afterReturnStorage = await readMessages(page);
  await page.screenshot({ path: testInfo.outputPath("1-after-return.png") });

  // 관찰: 새로고침 뒤에도 같은가(복귀 뒤 저장값의 복원)
  await page.reload();
  await expect(page.getByText(QUESTION, { exact: true })).toBeVisible();
  const afterReload = await observeChatScreen(page);
  const afterReloadStorage = await readMessages(page);
  await page.screenshot({ path: testInfo.outputPath("2-after-reload.png") });

  const observation = {
    timeline,
    storage: { beforeNav: beforeNav.at(-1), atHome: atHome.at(-1), afterReturn: afterReturnStorage.at(-1), afterReload: afterReloadStorage.at(-1) },
    screen: { afterReturn, afterReload },
    // P-a 관찰: 실패 말풍선이 남았는가
    policyA_failureBubbleLeft: afterReturn.interruptionNotices.length > 0 || afterReturn.retryButtons > 0,
    sse: { posts: sse.requests.length, firstStreamClosedByClient: stream.clientClosed },
    unhandledApi: api.unhandled.map((c) => `${c.method} ${c.path}`),
  };
  await testInfo.attach("c3-observation.json", {
    body: JSON.stringify(observation, null, 2),
    contentType: "application/json",
  });
  console.log("[C3]", JSON.stringify(observation, null, 2));

  // ── P-c: 자동 재전송 없음 · 입력 잠김 없음 ──
  expect(sse.requests, "이동·복귀·새로고침 중 SSE 재전송 없음").toHaveLength(1);
  await chatForm(page).getByRole("textbox").fill("다음 질문");
  await expect(chatForm(page).getByRole("button", { name: "전송" })).toBeEnabled();

  // ── P-b: 끊긴 답변이 완료된 답변과 구분된다 ──
  // 부분 답변이 화면에 남아 있다면, 같은 화면에 중단을 알리는 표시(안내 문구 · 중단 상태 줄 · 재시도 수단)가 있어야 한다
  for (const [label, s] of [["복귀 직후", afterReturn], ["새로고침 뒤", afterReload]] as const) {
    if (s.partialVisible) {
      expect(
        s.interruptionNotices.length + s.interruptedStatusLines + s.retryButtons,
        `${label}: 부분 답변이 중단 표시 없이 완료된 답변처럼 보임`,
      ).toBeGreaterThan(0);
    }
  }
});
