import type { BrowserContext, Page } from "@playwright/test";

import { ok, type ApiMock } from "./support/apiMock";
import { expect, test } from "./support/fixtures";
import type { SseServer } from "./support/sseServer";

/**
 * T2-D2 — 판매자 승인 요청이 HTTP 401 로 거부된다.
 *
 * 정책(T1 I-6, 03 §12 · useChat.ts):
 * - 일반 발화·칩 제거: 스트림 시작 401 → 티켓 재발급 후 같은 본문으로 1회 재요청
 * - **판매자 승인: 401 이어도 재발급·재요청하지 않는다** — 요청을 이미 보냈으므로 처리 여부 불명으로 끝낸다
 *   (`unknown` · 확인 안내 · retryable:false · 카드 잠금). 승인 직전에는 캐시를 건너뛰고 새 티켓 1회(fresh)
 *
 * ⚠️ 테스트 서버의 401 은 "요청 수신 + 거부 응답"까지만 모델링한다. 운영 서버에서 401 이 났을 때 승인이 실행되지
 * 않았다고 단정하지 않는다 — 서버 측 처리 여부 · 멱등성 · 결과 조회는 미검증(08 Q5·Q6·Q8~Q10).
 *
 * 동기화: 앱이 401 에 재요청한다면 그 재요청은 바깥 catch(처리 불명 안내) 이전에 일어난다. 그래서
 * **처리 불명 안내가 화면에 뜬 시점**을 "앱의 재전송 결정이 끝난 시점"으로 본다. 고정 대기 없음.
 * (D1 테스트 파일을 바꾸지 않기 위해 판매자 준비 코드를 이 파일에 따로 둔다 — 공통화는 후속)
 */

const SELLER = {
  id: "e2e-seller-1",
  email: "seller@e2e.test",
  nickname: "E2E 판매자",
  role: "SELLER",
} as const;

// 계약 SellerDraft — 수정 초안. productId 는 숫자 문자열
const DRAFT = {
  draftId: "e2e-draft-update-401",
  op: "update",
  productId: "700002",
  changes: [{ field: "price", before: 32000, after: 30000 }],
  summary: "가격을 30,000원으로 인하",
};

/** draftApproval.ts CONFIRM_UNKNOWN */
const CONFIRM_UNKNOWN =
  "요청이 처리됐는지 확인하지 못했어요. 상품 목록에서 반영 여부를 확인한 뒤 다시 진행해 주세요.";

interface SseBody {
  sessionId: string;
  threadId: string;
  message?: string;
  action?: string;
  draftId?: string;
}

function chatForm(page: Page) {
  return page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "전송" }) });
}

async function prepareSeller(
  context: BrowserContext,
  api: ApiMock,
  sse: SseServer,
  timeline: string[],
) {
  // 복원(useRestoreSession)은 persist 된 user 가 있어야 시작된다 — 앱 스크립트보다 먼저 심는다
  await context.addInitScript((user) => {
    localStorage.setItem("jarvis-auth", JSON.stringify({ state: { user }, version: 3 }));
  }, SELLER);
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

  // 인증 복구 요청(AT refresh)도 사건으로 남긴다 — SSE 401 과 별개 경로지만 발생 여부를 본다
  api.on("POST", /^\/api\/auth\/refresh$/, () => {
    timeline.push("api:auth-refresh");
    return ok(null);
  });
  api.on("GET", /^\/api\/auth\/me$/, () => ok(SELLER));
  api.on("POST", /^\/api\/events/, () => ok({ accepted: true }));
  const session = {
    sessionId: "e2e-seller-session-1",
    ttlSeconds: 600,
    streamTicket: "e2e-seller-ticket",
    ticketTtlSeconds: 60,
    llmSseUrl: sse.streamUrl,
  };
  api.on("POST", /^\/api\/chat\/seller\/sessions$/, () => {
    timeline.push("api:seller-session-issued");
    return ok(session);
  });
  api.on("POST", /^\/api\/chat\/tickets$/, () => {
    timeline.push("api:ticket-issued");
    return ok(session);
  });
}

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
}

test("T2-D2 판매자 승인이 401 로 거부되면 재발급·재전송 없이 처리 불명으로 안내한다", async ({
  page,
  context,
  sse,
  api,
}, testInfo) => {
  const timeline: string[] = [];
  await prepareSeller(context, api, sse, timeline);

  const confirmResponses: number[] = [];
  page.on("response", (r) => {
    if (r.url().startsWith(sse.streamUrl) && r.request().postData()?.includes('"action":"confirm"'))
      confirmResponses.push(r.status());
  });

  await page.goto("/seller/chat");
  await receiveDraft(page, sse);
  const beforeApproval = [...timeline]; // 부팅·초안 턴까지의 정상 발급·복구
  timeline.length = 0;

  const appConfirmFetches = async () =>
    (
      await page.evaluate(() => (window as unknown as { __e2eSseFetches: string[] }).__e2eSseFetches)
    ).filter((b) => b.includes('"action":"confirm"')).length;
  const confirmReceipts = () =>
    sse.requests.filter((r) => (r.body as SseBody).action === "confirm").length;

  // ── (1) 사용자 적용 클릭 1회 ──
  timeline.push("user:click-apply");
  await page.getByRole("button", { name: "적용" }).click();

  // ── (2)(3) 승인 POST 서버 도착 · 본문 ──
  await expect.poll(confirmReceipts, { message: "승인 POST 서버 도착" }).toBe(1);
  timeline.push("server:confirm-received");
  const stream = await sse.nextStream();
  const body = stream.request.body as SseBody;
  expect(body).toMatchObject({ action: "confirm", draftId: DRAFT.draftId });
  expect(body.message).toBeUndefined();

  // ── (4) 서버가 401 로 거부 ──
  const rejected = page.waitForResponse(
    (r) => r.url().startsWith(sse.streamUrl) && r.status() === 401,
  );
  stream.reject(401, "TOKEN_EXPIRED");
  timeline.push("server:responded-401");
  await rejected;
  // 이후 도착하는 SSE 요청(앱이 재전송한다면 그 요청)에도 즉시 401 을 준다 — 응답 없이 매달리면
  // 재전송이 "안내가 안 뜸"이라는 간접 증상으로만 드러난다. 매달리지 않게 해서 재전송 여부를
  // 아래의 직접 단언(서버 수신·앱 fetch·사건 순서)이 판정하게 한다. 테스트가 끝나면 서버가 닫혀 멈춘다.
  void (async () => {
    for (;;) {
      const extra = await sse.nextStream();
      timeline.push("server:extra-request-responded-401");
      extra.reject(401, "TOKEN_EXPIRED");
    }
  })();

  // ── (7)(8) 화면 — 이 시점이 앱의 재전송 결정이 끝난 시점이다 ──
  await expect(page.getByText(CONFIRM_UNKNOWN, { exact: true })).toHaveCount(2);
  timeline.push("ui:unknown-notice-shown");
  await expect(page.getByRole("button", { name: "적용" })).toHaveCount(0);
  await expect(page.getByText("결과를 확정하지 못했어요", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "상품 목록 보기" })).toBeVisible();
  await chatForm(page).getByRole("textbox").fill("상태 확인");
  await expect(chatForm(page).getByRole("button", { name: "전송" })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("after-401.png") });

  // ── (5)(6) 자동 재전송 · 추가 발급 없음 ──
  expect(await appConfirmFetches(), "앱의 승인 fetch 1회").toBe(1);
  expect(confirmReceipts(), "서버의 승인 POST 수신 1회").toBe(1);
  expect(confirmResponses, "브라우저가 받은 승인 응답은 401 하나").toEqual([401]);

  // ── (9) 허용된 동작(초안 닫기) 뒤에도 재실행 없음 ──
  await page.getByRole("button", { name: "초안 닫기" }).click();
  await expect(page.getByText(DRAFT.summary)).toHaveCount(0);
  timeline.push("user:closed-draft");
  expect(await appConfirmFetches()).toBe(1);
  expect(confirmReceipts()).toBe(1);

  // 승인 구간의 사건 순서 — 승인 직전 새 티켓 1회(정상) 외에 발급·인증 복구가 없다
  expect(timeline).toEqual([
    "user:click-apply",
    "api:ticket-issued", // 승인 직전 fresh 티켓(I-6) — 정상 발급
    "server:confirm-received",
    "server:responded-401",
    "ui:unknown-notice-shown",
    "user:closed-draft",
  ]);
  expect(sse.requests).toHaveLength(2); // 초안 턴 1 + 승인 1

  const observation = {
    beforeApproval,
    approvalTimeline: timeline,
    appConfirmFetches: await appConfirmFetches(),
    serverConfirmReceipts: confirmReceipts(),
    confirmBody: body,
    confirmResponses,
    serverEvents: sse.events,
    unhandledApi: api.unhandled.map((c) => `${c.method} ${c.path}`),
  };
  await testInfo.attach("d2-events.json", {
    body: JSON.stringify(observation, null, 2),
    contentType: "application/json",
  });
  console.log("[D2]", JSON.stringify({ ...observation, serverEvents: undefined }, null, 2));
  console.log(
    "[D2 events]",
    sse.events.map((e) => `${e.seq}:${e.type}#${e.socketId}${e.detail ? JSON.stringify(e.detail) : ""}`).join(" "),
  );
});
