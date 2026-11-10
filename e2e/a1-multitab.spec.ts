import type { Page } from "@playwright/test";

// 별칭: `use` 로 시작하는 이름을 react-hooks 규칙이 훅 호출로 오인한다(하네스 이름 정리는 후속)
import {
  chatList,
  ok,
  useGuestShoppingDefaults as applyGuestDefaults,
} from "./support/apiMock";
import { expect, test } from "./support/fixtures";

/**
 * T2-A1 — 멀티탭 독립성.
 *
 * 설계(docs/architecture/chat.md §3·저장 계층): sessionId 는 탭 간 공유(localStorage 캐시
 * `jarvis:chat:session:{channel}` · 25초), threadId 는 탭마다 고유(sessionStorage), 대화 내용도
 * sessionStorage(`chat:session`). 같은 BrowserContext 의 페이지들은 localStorage·BroadcastChannel·
 * Web Locks 를 공유하고 sessionStorage 는 각자 가진다 — 실제 브라우저의 탭과 같은 구성이다.
 *
 * sessionId 공유의 근거는 **값이 같다는 것이 아니라 발급 요청 횟수**로 본다 — 목 백엔드는 계약(CH-1 멱등)대로
 * 매번 같은 sessionId 를 돌려주므로 값만 비교하면 FE 가 공유했는지 서버가 같은 값을 준 것인지 구분할 수 없다.
 */

const THREAD_KEY = "jarvis:chat:thread:SHOPPING"; // src/shared/chat/threadId.ts
const CHAT_KEY = "chat:session"; // src/shared/chat/chatPersistence.ts

const QA = "A탭 러닝화 추천해줘";
const QA2 = "A탭 새 대화 질문";
const QB = "B탭 등산화 보여줘";
const A_CARDS = ["A탭 상품 1", "A탭 상품 2"];
const B_CARDS = ["B탭 상품 1", "B탭 상품 2"];

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

/** 글자를 넣은 뒤 전송 버튼 상태 — 빈 입력도 버튼을 잠그므로 "응답 중"만이 잠금 사유가 되게 한다 */
async function expectStreaming(page: Page, streaming: boolean) {
  await chatForm(page).getByRole("textbox").fill("상태 확인");
  const button = chatForm(page).getByRole("button", { name: "전송" });
  if (streaming) await expect(button).toBeDisabled();
  else await expect(button).toBeEnabled();
  await chatForm(page).getByRole("textbox").fill("");
}

interface StoredChat {
  messages: { role: string; text: string }[];
  results: unknown[];
}
async function tabStorage(page: Page) {
  return page.evaluate(
    ([threadKey, chatKey]) => ({
      threadId: sessionStorage.getItem(threadKey),
      chat: sessionStorage.getItem(chatKey),
    }),
    [THREAD_KEY, CHAT_KEY] as const,
  );
}
const parseChat = (raw: string | null): StoredChat | null =>
  raw ? (JSON.parse(raw) as StoredChat) : null;

interface SseBody {
  sessionId: string;
  threadId: string;
  message: string;
}

test("T2-A1 두 탭의 SSE 가 겹쳐도 각 탭의 대화·진행 상태·식별자가 독립적이다", async ({
  page: pageA,
  context,
  sse,
  api,
}, testInfo) => {
  applyGuestDefaults(api, { llmSseUrl: sse.streamUrl });
  api.on("GET", /^\/api\/chat\/lists\/a-list$/, () => ok(chatList("a-list", A_CARDS)));
  api.on("GET", /^\/api\/chat\/lists\/b-list$/, () => ok(chatList("b-list", B_CARDS)));
  const issued = () =>
    api.calls.filter(
      (c) => c.path === "/api/chat/sessions" || c.path === "/api/chat/tickets",
    ).length;
  const timeline: string[] = [];

  // ── 탭 A: 질문 → 스트리밍 시작 ──
  await pageA.goto("/chat");
  await send(pageA, QA);
  await expect.poll(() => sse.requests.length, { message: "A SSE 도착" }).toBe(1);
  timeline.push("A1:sse-arrived");
  const sA = await sse.nextStream();
  sA.open();
  sA.send("token", { text: "A 답변 하나 " });
  await expect(pageA.getByText("A 답변 하나")).toBeVisible();
  expect(issued(), "A 가 세션을 1회 발급").toBe(1);

  // ── 탭 B: A 가 응답 중일 때 새 탭으로 연다 ──
  const pageB = await context.newPage();
  await pageB.goto("/chat");
  await expect(chatForm(pageB).getByRole("textbox")).toBeVisible();
  // 새 탭은 A 의 대화를 물려받지 않는다(sessionStorage 는 탭마다 따로)
  await expect(pageB.getByText(QA, { exact: true })).toHaveCount(0);
  const bInitial = await tabStorage(pageB);
  const aInitial = await tabStorage(pageA);
  expect(bInitial.chat, "B 의 대화 저장소는 비어 있음").toBeNull();
  expect(bInitial.threadId, "B 는 마운트 시 자기 threadId 를 만든다").toBeTruthy();
  expect(bInitial.threadId).not.toBe(aInitial.threadId);

  await send(pageB, QB);
  await expect.poll(() => sse.requests.length, { message: "B SSE 도착" }).toBe(2);
  timeline.push("B:sse-arrived");
  const sB = await sse.nextStream();
  sB.open();
  sB.send("progress", { stage: "searching", message: "B탭 상품을 찾고 있어요" });
  sB.send("token", { text: "B 답변 하나 " });
  await expect(pageB.getByText("B 답변 하나")).toBeVisible();
  // B 는 세션을 새로 발급하지 않았다 — A 가 심은 공유 캐시(localStorage)를 썼다
  expect(issued(), "B 가 발급 없이 공유 세션 캐시를 사용").toBe(1);

  // ── (3) 두 SSE 가 겹친 상태 — A 는 B 가 시작된 뒤에도 계속 받는다 ──
  sA.send("token", { text: "A 답변 둘" });
  await expect(pageA.getByText("A 답변 하나 A 답변 둘")).toBeVisible();
  expect(sA.clientClosed, "A 의 SSE 가 끊기지 않음").toBe(false);
  await expectStreaming(pageA, true);
  await expectStreaming(pageB, true);
  timeline.push("A+B:both-streaming");

  // ── (4) B 가 응답 중일 때 A 가 완료된다 ──
  sA.send("products.ready", { listIds: ["a-list"] });
  sA.send("done", { finishReason: "stop" });
  sA.end();
  await expect(cardLink(pageA, A_CARDS[0])).toBeVisible();
  await expectStreaming(pageA, false);
  timeline.push("A1:done");
  sB.send("token", { text: "B 답변 둘 " });
  await expect(pageB.getByText("B 답변 하나 B 답변 둘")).toBeVisible();
  await expect(pageB.getByText("B탭 상품을 찾고 있어요")).toBeVisible();
  await expectStreaming(pageB, true);
  expect(sB.clientClosed, "A 완료 뒤에도 B 의 SSE 유지").toBe(false);

  // ── (4) B 가 응답 중일 때 A 가 새 대화를 시작하고 새 질문을 보낸다 ──
  await pageA.getByRole("button", { name: "새 대화" }).click();
  timeline.push("A:new-chat");
  await expect(pageA.getByText(QA, { exact: true })).toHaveCount(0);
  await send(pageA, QA2);
  await expect.poll(() => sse.requests.length, { message: "A 새 대화 SSE 도착" }).toBe(3);
  timeline.push("A2:sse-arrived");
  const sA2 = await sse.nextStream();
  sA2.open();
  sA2.send("token", { text: "A 새 답변" });
  await expect(pageA.getByText("A 새 답변")).toBeVisible();

  sB.send("token", { text: "B 답변 셋" });
  await expect(pageB.getByText("B 답변 하나 B 답변 둘 B 답변 셋")).toBeVisible();
  await expectStreaming(pageB, true);
  expect(sB.clientClosed, "A 의 새 대화 뒤에도 B 의 SSE 유지").toBe(false);

  // ── B 완료, A2 완료 ──
  sB.send("products.ready", { listIds: ["b-list"] });
  sB.send("done", { finishReason: "stop" });
  sB.end();
  await expect(cardLink(pageB, B_CARDS[0])).toBeVisible();
  await expectStreaming(pageB, false);
  timeline.push("B:done");
  sA2.send("done", { finishReason: "stop" });
  sA2.end();
  await expectStreaming(pageA, false);
  timeline.push("A2:done");

  // ── (5) 화면: 다른 탭의 질문·답변·카드가 섞이지 않는다 ──
  await expect(pageA.getByText(QB, { exact: true })).toHaveCount(0);
  await expect(pageA.getByText("B 답변 하나", { exact: false })).toHaveCount(0);
  for (const n of B_CARDS) await expect(cardLink(pageA, n)).toHaveCount(0);
  await expect(pageB.getByText(QA, { exact: true })).toHaveCount(0);
  await expect(pageB.getByText(QA2, { exact: true })).toHaveCount(0);
  await expect(pageB.getByText("A 답변 하나", { exact: false })).toHaveCount(0);
  await expect(pageB.getByText("A 새 답변")).toHaveCount(0);
  for (const n of A_CARDS) await expect(cardLink(pageB, n)).toHaveCount(0);
  await pageA.screenshot({ path: testInfo.outputPath("tab-a.png") });
  await pageB.screenshot({ path: testInfo.outputPath("tab-b.png") });

  // ── (5) 저장소: 탭마다 자기 대화만 ──
  const aStore = await tabStorage(pageA);
  const bStore = await tabStorage(pageB);
  expect(parseChat(aStore.chat)?.messages.map((m) => [m.role, m.text])).toEqual([
    ["user", QA2],
    ["assistant", "A 새 답변"],
  ]);
  expect(parseChat(bStore.chat)?.messages.map((m) => [m.role, m.text])).toEqual([
    ["user", QB],
    ["assistant", "B 답변 하나 B 답변 둘 B 답변 셋"],
  ]);
  for (const n of A_CARDS) expect(bStore.chat).not.toContain(n);
  for (const n of B_CARDS) {
    expect(bStore.chat).toContain(n);
    expect(aStore.chat).not.toContain(n);
  }

  // ── (6) SSE 요청의 식별자 관계 ──
  const [rA1, rB, rA2] = sse.requests.map((r) => r.body as SseBody);
  expect([rA1.message, rB.message, rA2.message]).toEqual([QA, QB, QA2]);
  // sessionId: 세 요청 모두 같은 접속 — 발급은 전체 1회
  expect(new Set([rA1.sessionId, rB.sessionId, rA2.sessionId]).size).toBe(1);
  expect(issued(), "전 과정 세션 발급 1회").toBe(1);
  // threadId: 탭마다 다르고, 새 대화는 새 방이다
  expect(rA1.threadId).toBe(aInitial.threadId);
  expect(rB.threadId).toBe(bInitial.threadId);
  expect(rB.threadId).not.toBe(rA1.threadId);
  expect(rA2.threadId).not.toBe(rA1.threadId);
  expect(rA2.threadId).not.toBe(rB.threadId);
  // 각 탭 저장소의 threadId 가 그 탭이 마지막으로 보낸 요청과 같다(B 는 A 의 새 대화로 바뀌지 않음)
  expect(aStore.threadId).toBe(rA2.threadId);
  expect(bStore.threadId).toBe(rB.threadId);

  expect(sse.requests).toHaveLength(3);
  expect(api.unhandled).toEqual([]);
  expect(timeline).toEqual([
    "A1:sse-arrived",
    "B:sse-arrived",
    "A+B:both-streaming",
    "A1:done",
    "A:new-chat",
    "A2:sse-arrived",
    "B:done",
    "A2:done",
  ]);

  await testInfo.attach("a1-identifiers.json", {
    body: JSON.stringify(
      {
        requests: { rA1, rB, rA2 },
        storage: { aInitial, bInitial, aFinal: aStore.threadId, bFinal: bStore.threadId },
        sessionIssuance: issued(),
        timeline,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});

/**
 * 관찰 — 탭을 만드는 방식에 따라 sessionStorage 가 복사되는가.
 * (b) 제품 경로: 추천 카드의 "상세 보기 (새 탭)" — `target=_blank rel="noopener noreferrer"`
 * (c) opener 가 남는 새 창(`window.open`) — HTML 명세상 sessionStorage 가 복사되는 경로. 브라우저 메뉴의
 *     "탭 복제"와 같은 의미지만 그 메뉴 자체는 Playwright 로 누를 수 없어 근사다.
 *
 * ⚠️ 회귀 계약이 아니다. (c)에서 관찰되는 threadId 공유는 **잠재적 설계 결함 후보**이며, 바람직한 동작으로
 * 고정하지 않는다 — 그래서 복사·공유 여부는 단언하지 않고 관찰값(a1-tab-creation.json)으로만 남긴다.
 * 단언은 재현 전제(A 탭의 대화·threadId 존재, 각 탭의 요청 도착)에만 건다.
 * 탭 복제 지원 정책과 threadId 충돌 방지 방식이 정해지면 그때 기대 결과를 정의해 단언으로 옮긴다.
 * 현재 제품의 새 탭 경로는 (b) noopener 뿐이다 — (c)는 현 사용자 경로에서 재현된 결함이 아니다.
 * 기록: docs/ai-development/2026-11-09-browser-e2e/a1-multitab.md
 */
test("T2-A1 관찰(회귀 계약 아님) — 새 탭 생성 방식별 sessionStorage 복사와 threadId", async ({
  page: pageA,
  context,
  sse,
  api,
}, testInfo) => {
  testInfo.annotations.push({
    type: "observation",
    description: "정책 미정 — opener 탭의 threadId 공유를 기대 동작으로 고정하지 않음",
  });
  applyGuestDefaults(api, { llmSseUrl: sse.streamUrl });
  api.on("GET", /^\/api\/chat\/lists\/a-list$/, () => ok(chatList("a-list", A_CARDS)));

  await pageA.goto("/chat");
  await send(pageA, QA);
  await expect.poll(() => sse.requests.length).toBe(1);
  const sA = await sse.nextStream();
  sA.open();
  sA.send("token", { text: "A 답변" });
  sA.send("products.ready", { listIds: ["a-list"] });
  sA.send("done", { finishReason: "stop" });
  sA.end();
  await expect(cardLink(pageA, A_CARDS[0])).toBeVisible();
  const aStore = await tabStorage(pageA);
  expect(aStore.threadId).toBeTruthy();
  expect(aStore.chat).toContain(QA);

  // (b) 제품 경로 — 카드 링크로 새 탭
  const [productTab] = await Promise.all([
    context.waitForEvent("page"),
    cardLink(pageA, A_CARDS[0]).click(),
  ]);
  await productTab.waitForLoadState("domcontentloaded");
  const productTabStorage = await tabStorage(productTab);
  const productTabHasOpener = await productTab.evaluate(() => window.opener !== null);
  // 같은 탭에서 /chat 으로 이동하면 어떤 방을 쓰는가
  await productTab.goto("/chat");
  await expect(chatForm(productTab).getByRole("textbox")).toBeVisible();
  const productTabOnChat = await tabStorage(productTab);
  const productTabShowsA = (await productTab.getByText(QA, { exact: true }).count()) > 0;
  await productTab.close();

  // (c) opener 가 남는 새 창
  const [openerTab] = await Promise.all([
    context.waitForEvent("page"),
    pageA.evaluate(() => {
      window.open("/chat", "_blank");
    }),
  ]);
  await openerTab.waitForLoadState("domcontentloaded");
  await expect(chatForm(openerTab).getByRole("textbox")).toBeVisible();
  const openerTabStorage = await tabStorage(openerTab);
  const openerTabShowsA = (await openerTab.getByText(QA, { exact: true }).count()) > 0;
  await openerTab.screenshot({ path: testInfo.outputPath("opener-tab.png") });

  // 복사된 탭에서 질문하면 어떤 threadId 로 나가는가
  await send(openerTab, "복사된 탭의 질문");
  await expect.poll(() => sse.requests.length).toBe(2);
  const sC = await sse.nextStream();
  const openerTabSentThread = (sC.request.body as SseBody).threadId;
  sC.open();
  sC.send("done", { finishReason: "stop" });
  sC.end();

  const observation = {
    tabA: { threadId: aStore.threadId, chatHasQA: true },
    productLinkTab: {
      hasOpener: productTabHasOpener,
      atLoad: {
        threadId: productTabStorage.threadId,
        chatCopied: productTabStorage.chat !== null,
      },
      afterNavigatingToChat: {
        threadId: productTabOnChat.threadId,
        sameThreadAsA: productTabOnChat.threadId === aStore.threadId,
        showsTabAConversation: productTabShowsA,
      },
    },
    openerTab: {
      threadId: openerTabStorage.threadId,
      sameThreadAsA: openerTabStorage.threadId === aStore.threadId,
      chatCopied: openerTabStorage.chat !== null,
      showsTabAConversation: openerTabShowsA,
      sentThreadId: openerTabSentThread,
      sentSameThreadAsA: openerTabSentThread === aStore.threadId,
    },
    unhandledApi: api.unhandled.map((c) => `${c.method} ${c.path}`),
    // 테스트 백엔드가 받은 전체 호출 — 상품 상세(SSR)를 포함해 실제 백엔드로 새는 요청이 없는지 보는 근거
    allApiCalls: [...api.calls, ...api.unhandled].map((c) => `${c.method} ${c.path}`),
  };
  await testInfo.attach("a1-tab-creation.json", {
    body: JSON.stringify(observation, null, 2),
    contentType: "application/json",
  });
  console.log("[A1 tab-creation observation]", JSON.stringify(observation, null, 2));
});
