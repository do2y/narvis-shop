import type { Page } from "@playwright/test";

// 별칭: `use` 로 시작하는 이름을 react-hooks 규칙이 훅 호출로 오인한다(하네스 이름 정리는 후속)
import { ok, useGuestShoppingDefaults as applyGuestDefaults } from "./support/apiMock";
import { expect, test } from "./support/fixtures";
import type { SseStream } from "./support/sseServer";

/**
 * T2-C1 — 일반 채팅 스트림이 **중간에** 끊긴 뒤 사용자가 다시 시도한다.
 *
 * 정의(Phase 1): "일반 질문 스트림이 중간에 끊긴 뒤 재시도" — 위험은 오분류·다른 질문 재전송, 확인은 오류 문구와
 * "재시도 시 같은 질문 1회". 응답 헤더 전 끊김(C1a)은 원래 정의 밖이라 다루지 않는다.
 *
 * 정책(T1 · useChat.ts · store.ts · retryPolicy.ts):
 * - 스트림 도중 실패는 **자동 재시도하지 않는다**(중복 담기 방지). 일반 발화의 자동 재요청은 스트림 시작 401 뿐이다
 * - 실패 말풍선 + `retryable` 기본 true → "다시 시도". 재시도는 마지막 실패 (user, assistant) 쌍을 지우고 **같은 발화**를 다시 보낸다
 * - 분류: done/error 없이 정상 종료 → "응답 연결이 중간에 끊겼어요" / 그 밖(네트워크 오류 등) → "응답을 받지 못했어요"
 *
 * 두 변형: reset(토큰 뒤 소켓 강제 종료) · clean(토큰 뒤 done 없이 정상 종료).
 * 서버 수신 횟수는 1회로 가정하지 않는다(D1a 에서 브라우저 계층 재전송 관찰) — 단언은 앱 fetch 로, 서버 수신은 관찰값으로.
 */

const STORAGE_KEY = "chat:session";
const QUESTION = "러닝화 추천해줘";
const PARTIAL = "조건에 맞는 러닝화를 찾았고, 이유는";
const FINAL = "다시 받은 완성된 답변입니다.";

const NOTICE = {
  reset: "응답을 받지 못했어요. 다시 시도해 주세요.",
  clean: "응답 연결이 중간에 끊겼어요. 다시 시도해 주세요.",
} as const;

interface SseBody {
  sessionId: string;
  threadId: string;
  message?: string;
}

function chatForm(page: Page) {
  return page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "전송" }) });
}

const readMessages = async (page: Page) => {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY);
  return raw
    ? (JSON.parse(raw) as { messages: { role: string; text: string; error?: string }[] }).messages
    : [];
};

for (const variant of ["reset", "clean"] as const) {
  test(`T2-C1b-${variant} 스트림 도중 끊기면 자동 재시도 없이 실패 안내 · 수동 재시도는 같은 질문 1회`, async ({
    page,
    context,
    sse,
    api,
  }, testInfo) => {
    applyGuestDefaults(api, { llmSseUrl: sse.streamUrl });
    // 수집(search) 이벤트도 사건으로 남긴다 — 재시도가 검색을 다시 수집하는지 관찰(I-1 인접, 단언 안 함)
    const searchEvents: unknown[] = [];
    api.on("POST", /^\/api\/events/, (call) => {
      if (JSON.stringify(call.body).includes('"search"')) searchEvents.push(call.body);
      return ok({ accepted: true });
    });
    // 앱의 fetch 호출 계측(테스트 전용, 제품 코드 무변경)
    await context.addInitScript((streamUrl) => {
      const w = window as unknown as { __e2eSseFetches: string[] };
      w.__e2eSseFetches = [];
      const original = window.fetch;
      window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith(streamUrl)) w.__e2eSseFetches.push(String(init?.body ?? ""));
        return original.call(this, input, init);
      };
    }, sse.streamUrl);
    const appFetches = async () =>
      page.evaluate(() => (window as unknown as { __e2eSseFetches: string[] }).__e2eSseFetches.length);
    const networkFailures: string[] = [];
    page.on("requestfailed", (r) => {
      if (r.url().startsWith(sse.streamUrl)) networkFailures.push(r.failure()?.errorText ?? "");
    });
    const issued = () =>
      api.calls.filter((c) => c.path === "/api/chat/sessions" || c.path === "/api/chat/tickets").length;
    const timeline: string[] = [];

    await page.goto("/chat");
    const form = chatForm(page);
    await form.getByRole("textbox").fill(QUESTION);
    timeline.push("user:send");
    await form.getByRole("button", { name: "전송" }).click();

    // ── 첫 턴: 헤더 + 토큰 → 도중 끊김 ──
    await expect.poll(() => sse.requests.length, { message: "SSE POST 도착" }).toBe(1);
    timeline.push("server:sse-received#1");
    const first = await sse.nextStream();
    first.open();
    first.send("progress", { stage: "searching", message: "상품을 찾고 있어요" });
    first.send("token", { text: "조건에 맞는 러닝화를 " });
    first.send("token", { text: "찾았고, 이유는 " });
    await expect(page.getByText(PARTIAL)).toBeVisible();
    timeline.push("ui:partial-visible");
    const interrupt = (s: SseStream) => {
      if (variant === "reset") s.destroy();
      else s.end(); // done/error 없이 정상 종료
    };
    interrupt(first);
    timeline.push(`server:${variant === "reset" ? "socket-destroyed" : "ended-without-done"}`);

    // ── 실패 표시 — 이 시점이 앱의 재시도 결정이 끝난 시점이다(자동 재요청이 있다면 catch 이전) ──
    // 사용자 재시도 전에 추가 요청이 오면(자동 재요청) 매달리지 않게 같은 방식으로 끊고 사건으로 남긴다 —
    // "안내가 안 뜸" 같은 간접 증상이 아니라 아래의 횟수·사건 순서 단언이 판정하게 하려는 계측이다.
    // nextStream() 을 경쟁에 걸면 남은 대기자가 수동 재시도 요청을 가로채므로, 요청 수를 소비하지 않고 센다.
    const notice = page.getByText(NOTICE[variant], { exact: true });
    let handled = 1;
    for (;;) {
      await expect
        .poll(async () => (await notice.isVisible()) || sse.requests.length > handled, {
          message: "실패 안내 표시 또는 추가 요청 도착",
        })
        .toBe(true);
      if (sse.requests.length <= handled) break;
      const extra = await sse.nextStream(); // 이미 도착한 요청이라 즉시 꺼내진다
      handled += 1;
      timeline.push("server:extra-request-before-user-retry");
      extra.open();
      interrupt(extra);
      if (handled > 5) throw new Error("사용자 재시도 전 추가 요청이 4회를 넘음 — 관찰 중단");
    }
    await expect(notice).toBeVisible();
    timeline.push("ui:failure-notice");
    // 다른 분기의 문구가 아니다(오분류 확인)
    const otherNotice = NOTICE[variant === "reset" ? "clean" : "reset"];
    await expect(page.getByText(otherNotice, { exact: true })).toHaveCount(0);
    // 실패를 성공처럼 보이지 않는다 — 부분 답변은 일반 답변 말풍선으로 남지 않는다(실패 말풍선은 안내만 그린다)
    await expect(page.getByText(PARTIAL)).toHaveCount(0);
    await expect(page.getByLabel("입력 중")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(1);
    // 자동 재시도 없음
    expect(await appFetches(), "앱 fetch 1회 — 자동 재시도 없음").toBe(1);
    const receiptsAfterFailure = sse.requests.length; // 관찰값
    const issuedBeforeRetry = issued();
    // 저장 상태: 실패한 턴이 (user, 실패 assistant) 로 남는다 — 부분 문구는 저장소엔 있다(화면엔 없음)
    const failedState = await readMessages(page);
    expect(failedState.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(failedState[1].error).toBe(NOTICE[variant]);
    // 실패 뒤 입력이 막히지 않는다
    await form.getByRole("textbox").fill("상태 확인");
    await expect(form.getByRole("button", { name: "전송" })).toBeEnabled();
    await form.getByRole("textbox").fill("");
    await page.screenshot({ path: testInfo.outputPath(`${variant}-1-failed.png`) });

    // ── 사용자 수동 재시도 ──
    timeline.push("user:click-retry");
    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect.poll(appFetches, { message: "수동 재시도 fetch" }).toBe(2);
    await expect
      .poll(() => sse.requests.length, { message: "재시도 SSE POST 도착" })
      .toBe(receiptsAfterFailure + 1);
    timeline.push("server:sse-received#retry");
    const retryStream = await sse.nextStream();
    const firstBody = sse.requests[0].body as SseBody;
    const retryBody = retryStream.request.body as SseBody;
    // 같은 질문 · 같은 방 · 같은 접속
    expect(retryBody.message).toBe(QUESTION);
    expect(retryBody.threadId).toBe(firstBody.threadId);
    expect(retryBody.sessionId).toBe(firstBody.sessionId);
    // 실패 말풍선은 사라지고, 질문 말풍선은 하나뿐이다(중복 없음)
    await expect(page.getByText(NOTICE[variant], { exact: true })).toHaveCount(0);
    await expect(page.getByText(QUESTION, { exact: true })).toHaveCount(1);

    retryStream.open();
    retryStream.send("token", { text: FINAL });
    retryStream.send("done", { finishReason: "stop" });
    retryStream.end();
    await expect(page.getByText(FINAL)).toBeVisible();
    timeline.push("ui:retry-answer");
    await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
    await expect(page.getByText(QUESTION, { exact: true })).toHaveCount(1);
    await expect(page.getByText(PARTIAL)).toHaveCount(0);
    expect(await readMessages(page)).toEqual([
      expect.objectContaining({ role: "user", text: QUESTION }),
      expect.objectContaining({ role: "assistant", text: FINAL }),
    ]);
    expect((await readMessages(page))[1].error).toBeUndefined();
    // 재시도는 사용자 클릭 1회에 fetch 1회 — 그 이상 나가지 않았다
    expect(await appFetches(), "전체 앱 fetch 2회(최초 1 + 수동 재시도 1)").toBe(2);

    // 재시도 뒤 새 메시지 전송이 막히지 않는다
    await form.getByRole("textbox").fill("다음 질문");
    await form.getByRole("button", { name: "전송" }).click();
    await expect.poll(appFetches, { message: "다음 질문 fetch" }).toBe(3);
    timeline.push("user:next-message-sent");
    await page.screenshot({ path: testInfo.outputPath(`${variant}-2-after-retry.png`) });

    expect(timeline).toEqual([
      "user:send",
      "server:sse-received#1",
      "ui:partial-visible",
      `server:${variant === "reset" ? "socket-destroyed" : "ended-without-done"}`,
      "ui:failure-notice",
      "user:click-retry",
      "server:sse-received#retry",
      "ui:retry-answer",
      "user:next-message-sent",
    ]);

    const observation = {
      variant,
      appFetchesAfterFailure: 1,
      serverReceiptsAfterFailure: receiptsAfterFailure,
      receipts: sse.requests.map((r) => ({
        message: (r.body as SseBody).message,
        threadId: (r.body as SseBody).threadId,
        socketId: r.socketId,
        socketRequestIndex: r.socketRequestIndex,
      })),
      sessionIssuanceBeforeRetry: issuedBeforeRetry,
      sessionIssuanceAfterRetry: issued(),
      browserNetworkFailures: networkFailures,
      searchEventsCollected: searchEvents.length,
      failedStateStoredPartialText: failedState[1].text,
      serverEvents: sse.events.map((e) => `${e.seq}:${e.type}#${e.socketId}${e.detail ? JSON.stringify(e.detail) : ""}`),
    };
    await testInfo.attach(`c1-${variant}.json`, {
      body: JSON.stringify(observation, null, 2),
      contentType: "application/json",
    });
    console.log(`[C1b-${variant}]`, JSON.stringify(observation, null, 2));
  });
}
