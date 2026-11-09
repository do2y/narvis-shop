import type { BrowserContext, Page } from "@playwright/test";

import { ok, type ApiMock } from "./support/apiMock";
import { APP_ORIGIN, expect, test } from "./support/fixtures";
import { startSseServer, type SseServer, type SseStream } from "./support/sseServer";

/**
 * T2-D1 — 판매자 승인 요청이 서버에 도착한 뒤 연결이 끊긴다.
 *
 * T1 정책(03 §12·§13, useChat.ts settleResend · draftApproval.ts):
 * - 승인은 fetch 를 한 번이라도 부르면(requestStarted) 이후 실패는 **서버 처리 여부 불명**이다
 * - 그 경우 자동 재전송하지 않는다(401 포함) · 승인 상태 `unknown` · 확인 안내 · 재시도 수단 없음 · 카드 잠금
 *
 * ⚠️ 서버가 요청을 **수신**했다는 기록은 승인 처리의 성공·실패를 말해 주지 않는다. 연결이 끊긴 뒤의 결과는
 * 실제 서버에서도 알 수 없다(처리 후 끊김일 수도, 처리 전 끊김일 수도 있다). 목 서버는 처리를 모델링하지 않는다.
 *
 * 연결 중단은 HTTP 오류 응답(500 등)이 아니라 **소켓을 서버에서 끊는 것**으로 만든다.
 * D1a: 요청 본문 수신 후, 응답 헤더 전에 끊음 / D1b: 200 + 토큰 1개 후 스트림 도중 끊음.
 */

const SELLER = {
  id: "e2e-seller-1",
  email: "seller@e2e.test",
  nickname: "E2E 판매자",
  role: "SELLER",
} as const;

// 계약 SellerDraft(src/shared/types/chat/seller.ts) — 수정 초안. productId 는 숫자 문자열
const DRAFT = {
  draftId: "e2e-draft-update-1",
  op: "update",
  productId: "700001",
  changes: [{ field: "price", before: 32000, after: 30000 }],
  summary: "가격을 30,000원으로 인하",
};

/** draftApproval.ts CONFIRM_UNKNOWN — 처리 여부를 단정하지 않는 안내 */
const CONFIRM_UNKNOWN =
  "요청이 처리됐는지 확인하지 못했어요. 상품 목록에서 반영 여부를 확인한 뒤 다시 진행해 주세요.";

interface SseBody {
  sessionId: string;
  threadId: string;
  message?: string;
  action?: string;
  draftId?: string;
}

async function seedSellerLogin(context: BrowserContext) {
  // 복원(useRestoreSession)은 persist 된 user 가 있어야 시작된다 — 앱 스크립트보다 먼저 심는다
  await context.addInitScript((user) => {
    localStorage.setItem(
      "jarvis-auth",
      JSON.stringify({ state: { user }, version: 3 }),
    );
  }, SELLER);
}

function applySellerDefaults(api: ApiMock, sse: SseServer) {
  api.on("POST", /^\/api\/auth\/refresh$/, () => ok(null));
  api.on("GET", /^\/api\/auth\/me$/, () => ok(SELLER));
  api.on("POST", /^\/api\/events/, () => ok({ accepted: true }));
  const session = {
    sessionId: "e2e-seller-session-1",
    ttlSeconds: 600,
    streamTicket: "e2e-seller-ticket",
    ticketTtlSeconds: 60,
    llmSseUrl: sse.streamUrl,
  };
  // CH-6 판매자 세션 발급 · CH-1b 티켓 재발급(승인은 fresh 로 매번 새 티켓)
  api.on("POST", /^\/api\/chat\/seller\/sessions$/, () => ok(session));
  api.on("POST", /^\/api\/chat\/tickets$/, () => ok(session));
}

function chatForm(page: Page) {
  return page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "전송" }) });
}

/** 초안 턴을 끝까지 받아 "적용" 버튼이 눌릴 수 있는 상태로 만든다 */
async function receiveDraft(page: Page, sse: SseServer) {
  await chatForm(page).getByRole("textbox").fill("7번 상품 가격 30000원으로 내려줘");
  await chatForm(page).getByRole("button", { name: "전송" }).click();
  await expect.poll(() => sse.requests.length, { message: "초안 턴 SSE 도착" }).toBe(1);
  const s = await sse.nextStream();
  s.open();
  s.send("meta", { lane: "product" });
  s.send("token", { text: "초안을 만들었어요." });
  s.send("draft", DRAFT);
  s.send("done", { finishReason: "stop", panel: "replace" });
  s.end();
  const apply = page.getByRole("button", { name: "적용" });
  await expect(apply).toBeEnabled();
  return apply;
}

const issuedTickets = (api: ApiMock) =>
  api.calls.filter((c) => c.path === "/api/chat/tickets").length;

async function runDisconnectScenario(
  page: Page,
  context: BrowserContext,
  sse: SseServer,
  api: ApiMock,
  disconnect: (s: SseStream) => void,
  label: string,
) {
  await seedSellerLogin(context);
  applySellerDefaults(api, sse);

  // 브라우저가 실제로 기록한 네트워크 실패 — 앱의 오류 처리 경로와 구분해 남긴다
  const networkFailures: { url: string; method: string; errorText: string }[] = [];
  page.on("requestfailed", (r) => {
    if (r.url().startsWith(sse.streamUrl)) {
      networkFailures.push({
        url: r.url(),
        method: r.method(),
        errorText: r.failure()?.errorText ?? "",
      });
    }
  });

  await page.goto("/seller/chat");
  const apply = await receiveDraft(page, sse);
  const ticketsBefore = issuedTickets(api);
  const timeline: string[] = [];

  // ── 사용자: 적용(승인) ──
  await apply.click();
  timeline.push("user:clicked-apply");
  await expect.poll(() => sse.requests.length, { message: "승인 SSE 도착" }).toBe(2);
  const confirmStream = await sse.nextStream();
  const body = confirmStream.request.body as SseBody;
  // (1) 승인 요청이 실제로 서버에 도착했다 — 최상위 action/draftId, message 없음(발화≠동의)
  expect(body).toMatchObject({ action: "confirm", draftId: DRAFT.draftId });
  expect(body.message).toBeUndefined();
  timeline.push("server:confirm-received");
  // 승인은 캐시를 건너뛰고 새 티켓을 받는다(I-6) — 승인 직전 재발급 1회
  expect(issuedTickets(api) - ticketsBefore, "승인 직전 새 티켓 1회").toBe(1);

  // ── (2) 서버가 요청을 받은 뒤 연결을 끊는다 ──
  disconnect(confirmStream);
  timeline.push(`server:connection-destroyed(${label})`);

  // ── (5)(6) 화면 ──
  // 처리 여부를 단정하지 않는 안내 — 말풍선과 초안 카드 두 곳
  await expect(page.getByText(CONFIRM_UNKNOWN, { exact: true })).toHaveCount(2);
  timeline.push("ui:unknown-notice-shown");
  // 확정처럼 보이지 않는다: 적용 버튼이 사라지고(재승인 불가) 성공·완료 표시가 없다
  await expect(page.getByRole("button", { name: "적용" })).toHaveCount(0);
  await expect(page.getByText("결과를 확정하지 못했어요", { exact: false })).toHaveCount(0);
  // (7) 재시도 수단이 없다 — 말풍선 다시 시도 없음
  await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
  // 남은 동작은 확인 경로뿐이다
  await expect(page.getByRole("link", { name: "상품 목록 보기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "초안 닫기" })).toBeVisible();
  // 입력은 가능하다(턴이 정리됨)
  await chatForm(page).getByRole("textbox").fill("상태 확인");
  await expect(chatForm(page).getByRole("button", { name: "전송" })).toBeEnabled();
  await page.screenshot({ path: `${test.info().outputPath(`${label}-after-disconnect.png`)}` });

  // ── (3)(4) 자동 재전송 없음 — 요청 수와 사건 기록 ──
  const confirmRequests = () =>
    sse.requests.filter((r) => (r.body as SseBody).action === "confirm").length;
  expect(confirmRequests(), "승인 요청 1회").toBe(1);
  expect(sse.requests).toHaveLength(2); // 초안 턴 1 + 승인 1
  expect(issuedTickets(api) - ticketsBefore, "재전송을 위한 추가 티켓 발급 없음").toBe(1);

  // (7) 사용자가 남은 동작(초안 닫기)을 해도 승인이 다시 나가지 않는다
  await page.getByRole("button", { name: "초안 닫기" }).click();
  timeline.push("user:closed-draft");
  await expect(page.getByText(DRAFT.summary)).toHaveCount(0);
  expect(confirmRequests(), "초안 닫기 뒤에도 승인 1회").toBe(1);
  expect(sse.requests).toHaveLength(2);

  expect(timeline).toEqual([
    "user:clicked-apply",
    "server:confirm-received",
    `server:connection-destroyed(${label})`,
    "ui:unknown-notice-shown",
    "user:closed-draft",
  ]);
  // 브라우저 측 증거: 승인 SSE 요청이 네트워크 수준에서 실패로 끝났다(HTTP 오류 응답이 아니라)
  expect(networkFailures.filter((f) => f.method === "POST")).toHaveLength(1);

  await test.info().attach(`${label}-events.json`, {
    body: JSON.stringify(
      {
        timeline,
        browserNetworkFailures: networkFailures,
        confirmBody: body,
        apiCalls: api.calls.map((c) => `${c.method} ${c.path}`),
        unhandledApi: api.unhandled.map((c) => `${c.method} ${c.path}`),
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  console.log(`[${label}]`, JSON.stringify({ timeline, networkFailures, unhandled: api.unhandled.map((c) => `${c.method} ${c.path}`) }, null, 2));
}

/**
 * D1a — 응답 헤더 전 끊김 (관찰·원인 분석, 회귀 계약 아님).
 *
 * 첫 실행에서 서버가 같은 승인 POST 를 두 번 받았다(앱 fetch 1회). 그 횟수를 계약으로 고정하지 않고
 * 연결 조건별 **관찰값**으로 남긴다. 단언은 사용자 안전 조건에만 건다:
 * 앱 수준 재실행 없음(fetch 1회 · 논리 요청 1회 · 추가 티켓 없음) · 확정 표시 없음 · 불확실성 안내 · 위험한 재시도 수단 없음.
 *
 * 동기화와 종료 조건(고정 대기 없음):
 * - 서버에 승인 POST 가 도착할 때마다 응답 헤더 전에 끊는다(무기한 대기시키지 않는다)
 * - **브라우저가 그 논리 요청을 `requestfailed` 로 종결한 시점**을 "더 이상의 재전송 없음"의 경계로 본다 —
 *   종결된 요청은 브라우저가 다시 보내지 않는다. 그 뒤의 POST 는 새 논리 요청(앱 fetch)이어야 하며 fetch 계측에 잡힌다
 * - 안전장치: 서버 수신이 5회를 넘으면 관찰을 중단하고 실패시킨다(무한 재전송 방지)
 */
async function observeDisconnectBeforeHeaders(
  page: Page,
  context: BrowserContext,
  api: ApiMock,
  condition: "keep-alive" | "connection-close" | "keep-alive-fresh-socket",
) {
  const server = await startSseServer({
    allowedOrigin: APP_ORIGIN,
    connectionClose: condition === "connection-close",
  });
  try {
    await seedSellerLogin(context);
    applySellerDefaults(api, server);

    // 앱의 fetch 호출 계측(테스트 전용, 제품 코드 무변경) — 승인 fetch 를 앱이 몇 번 불렀는가
    await context.addInitScript((streamUrl) => {
      const w = window as unknown as { __e2eSseFetches: string[] };
      w.__e2eSseFetches = [];
      const original = window.fetch;
      window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith(streamUrl)) w.__e2eSseFetches.push(String(init?.body ?? ""));
        return original.call(this, input, init);
      };
    }, server.streamUrl);

    const isConfirm = (postData: string | null) =>
      !!postData && (JSON.parse(postData) as SseBody).action === "confirm";
    const logicalConfirms: string[] = [];
    const confirmResponses: number[] = [];
    let finalNetworkError = "";
    let resolveFailed!: (e: string) => void;
    const browserEndedConfirm = new Promise<string>((r) => (resolveFailed = r));
    page.on("request", (r) => {
      if (r.url().startsWith(server.streamUrl) && r.method() === "POST" && isConfirm(r.postData()))
        logicalConfirms.push(r.postData() ?? "");
    });
    page.on("response", (r) => {
      if (r.url().startsWith(server.streamUrl) && isConfirm(r.request().postData()))
        confirmResponses.push(r.status());
    });
    page.on("requestfailed", (r) => {
      if (r.url().startsWith(server.streamUrl) && isConfirm(r.postData())) {
        finalNetworkError = r.failure()?.errorText ?? "";
        resolveFailed(finalNetworkError);
      }
    });

    await page.goto("/seller/chat");
    const apply = await receiveDraft(page, server);
    // 변형: keep-alive 정책은 그대로 두고, 승인 직전에 서버가 유휴 연결을 모두 닫는다 —
    // 승인이 새 연결에서 시작하게 하려는 것. 새 연결이 실제로 쓰였는지는 아래에서 사후 확인한다
    const closedIdleSocketIds =
      condition === "keep-alive-fresh-socket" ? await server.closeIdleSockets() : [];
    const ticketsBefore = issuedTickets(api);
    const appConfirmFetches = async () =>
      (
        await page.evaluate(
          () => (window as unknown as { __e2eSseFetches: string[] }).__e2eSseFetches,
        )
      ).filter((b) => b.includes('"action":"confirm"')).length;

    // ── 사용자 승인 클릭 1회 ──
    const userClicks = 1;
    await apply.click();

    // ── 서버에 도착하는 승인 POST 를 모두 헤더 전에 끊는다 — 브라우저가 요청을 종결할 때까지 ──
    await expect
      .poll(() => server.requests.length, { message: "첫 승인 POST 도착" })
      .toBe(2);
    const receipts: { body: SseBody; socketId: number; socketRequestIndex: number; headersSentAtDestroy: boolean }[] = [];
    let stream: SseStream | null = await server.nextStream();
    while (stream) {
      receipts.push({
        body: stream.request.body as SseBody,
        socketId: stream.request.socketId,
        socketRequestIndex: stream.request.socketRequestIndex,
        headersSentAtDestroy: stream.headersSent,
      });
      stream.destroy();
      if (receipts.length > 5) throw new Error("승인 POST 서버 수신이 5회를 넘음 — 관찰 중단");
      const next: { s: SseStream } | { ended: string } = await Promise.race([
        server.nextStream().then((s) => ({ s })),
        browserEndedConfirm.then((ended) => ({ ended })),
      ]);
      stream = "s" in next ? next.s : null;
    }

    // ── 사용자 안전 조건(단언) ──
    // 처리 불명 안내 — 말풍선·카드
    await expect(page.getByText(CONFIRM_UNKNOWN, { exact: true })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "적용" })).toHaveCount(0);
    await expect(page.getByText("결과를 확정하지 못했어요", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
    await chatForm(page).getByRole("textbox").fill("상태 확인");
    await expect(chatForm(page).getByRole("button", { name: "전송" })).toBeEnabled();
    // 앱 수준 재실행 없음
    expect(await appConfirmFetches(), "앱의 승인 fetch 호출 1회").toBe(userClicks);
    expect(logicalConfirms, "브라우저가 노출한 승인 논리 요청 1회").toHaveLength(1);
    expect(issuedTickets(api) - ticketsBefore, "앱이 재전송용 티켓을 다시 받지 않음").toBe(1);
    // 전제: 첫 승인 POST 가 서버에 도착했고, 응답 헤더 전에 끊겼다
    expect(receipts.length).toBeGreaterThanOrEqual(1);
    expect(receipts[0].body).toMatchObject({ action: "confirm", draftId: DRAFT.draftId });
    expect(receipts[0].headersSentAtDestroy).toBe(false);
    expect(confirmResponses, "브라우저가 승인 응답(헤더)을 받지 못함").toEqual([]);
    expect(finalNetworkError).not.toBe("");

    // 사용자가 남은 동작(초안 닫기)을 해도 앱이 다시 보내지 않는다
    await page.getByRole("button", { name: "초안 닫기" }).click();
    await expect(page.getByText(DRAFT.summary)).toHaveCount(0);
    expect(await appConfirmFetches()).toBe(1);

    // ── 관찰값(단언하지 않음) ──
    // 첫 승인 POST 가 새 연결의 첫 요청이었는가. 변형 조건은 닫은 연결보다 나중에 열린 연결이어야 유효하다
    const firstOnFreshSocket = receipts[0].socketRequestIndex === 0;
    const validComparison =
      condition !== "keep-alive-fresh-socket" ||
      (firstOnFreshSocket &&
        closedIdleSocketIds.length > 0 &&
        receipts[0].socketId > Math.max(...closedIdleSocketIds));
    if (!validComparison) {
      test.info().annotations.push({
        type: "invalid-comparison",
        description: "승인이 새 연결에서 시작됐음을 확인하지 못함 — 비교 결과로 세지 않음",
      });
    }
    const observation = {
      condition,
      validComparison,
      closedIdleSocketIds,
      firstReceiptOnFreshSocket: firstOnFreshSocket,
      userClicks,
      appConfirmFetches: await appConfirmFetches(),
      logicalConfirmRequests: logicalConfirms.length,
      serverConfirmReceipts: receipts.length,
      receipts,
      allSameDraftId: receipts.every((r) => r.body.draftId === DRAFT.draftId),
      confirmResponsesSeenByBrowser: confirmResponses,
      finalNetworkError,
      serverEvents: server.events,
    };
    await test.info().attach(`D1a-${condition}.json`, {
      body: JSON.stringify(observation, null, 2),
      contentType: "application/json",
    });
    console.log(`[D1a ${condition}]`, JSON.stringify({ ...observation, serverEvents: undefined }, null, 2));
    console.log(
      `[D1a ${condition} events]`,
      server.events.map((e) => `${e.seq}:${e.type}#${e.socketId}${e.detail ? JSON.stringify(e.detail) : ""}`).join(" "),
    );
    return observation;
  } finally {
    await server.close();
  }
}

test("T2-D1a 관찰(회귀 계약 아님) — 응답 헤더 전 끊김 · keep-alive", async ({ page, context, api }) => {
  test.info().annotations.push({ type: "observation", description: "서버 수신 횟수는 관찰값 — 계약 아님" });
  await observeDisconnectBeforeHeaders(page, context, api, "keep-alive");
});

test("T2-D1a 관찰(회귀 계약 아님) — 응답 헤더 전 끊김 · keep-alive + 승인 직전 유휴 연결 닫음", async ({ page, context, api }) => {
  test.info().annotations.push({ type: "observation", description: "서버 수신 횟수는 관찰값 — 계약 아님" });
  await observeDisconnectBeforeHeaders(page, context, api, "keep-alive-fresh-socket");
});

test("T2-D1a 관찰(회귀 계약 아님) — 응답 헤더 전 끊김 · Connection: close", async ({ page, context, api }) => {
  test.info().annotations.push({ type: "observation", description: "서버 수신 횟수는 관찰값 — 계약 아님" });
  await observeDisconnectBeforeHeaders(page, context, api, "connection-close");
});

test("T2-D1b 승인 응답 스트림 도중 연결이 끊기면 재전송 없이 처리 불명으로 안내한다", async ({
  page,
  context,
  sse,
  api,
}) => {
  await runDisconnectScenario(
    page,
    context,
    sse,
    api,
    (s) => {
      s.open();
      s.send("meta", { lane: "product" });
      s.send("token", { text: "적용하고 있어요" });
      s.destroy();
    },
    "D1b-mid-stream",
  );
});
