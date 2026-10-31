import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSession } from "@/shared/chat/sessionCoordinator";
import { useChatStore } from "@/shared/chat/store";
import type { ChatSession, SellerDraft } from "@/shared/types/chat";
import SellerChatPage from "./ChatPage";

/**
 * 판매자 등록 카드의 "다시 시도" 연결 — 화면 전체를 렌더해 실제 배선을 지난다.
 *
 * 카드는 재시도 대상 id 를 모른다. ChatPage 가 "마지막 말풍선"으로 감싸 넘기는데,
 * 카드의 오류 상태도 그 말풍선의 error 에서 나오므로 둘이 같은 대상을 가리켜야 한다.
 * 훅 테스트(useChat.test.ts)로는 이 배선을 확인할 수 없다.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/seller/chat",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/shared/chat/sessionCoordinator", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/chat/sessionCoordinator")>();
  return {
    ...actual,
    ensureSession: vi.fn(),
    refreshTicket: vi.fn(),
    clearCachedSession: vi.fn(),
    subscribeSession: vi.fn(() => () => {}),
    subscribeOwnershipChange: vi.fn(() => () => {}),
  };
});
vi.mock("@/shared/analytics/track", () => ({ track: vi.fn() }));

const session: ChatSession = {
  sessionId: "session-1",
  ttlSeconds: 600,
  streamTicket: "ticket-1",
  ticketTtlSeconds: 60,
  llmSseUrl: "https://ai.example/seller/chat",
};

const encoder = new TextEncoder();
const frame = (type: string, data: unknown) =>
  `data: ${JSON.stringify({ type, data })}\n\n`;
function sse(...frames: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(f));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}
const rejected = (status: number) =>
  new Response(
    JSON.stringify({ success: false, error: { code: "ERROR", message: "" } }),
    { status },
  );

const draft: SellerDraft = {
  draftId: "draft-1",
  op: "create",
  productId: null,
  changes: [],
  summary: "",
  preview: {
    title: "코튼 오버핏 셔츠",
    imageUrl: null,
    imagePlaceholder: true,
    priceText: "32,000원",
    originalPriceText: null,
    discountRate: 0,
    stockText: "50개",
    categoryPath: "패션의류 > 셔츠",
    summary: null,
    description: null,
    sections: [],
  },
};

// AI 서버(SSE)로 가는 요청만 순서대로 응답한다. 그 밖의 요청(목록 조회 등)은 이 테스트와 무관해 실패로 둔다.
let replies: Response[] = [];
const aiCalls: RequestInit[] = [];
const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url) !== session.llmSseUrl) throw new Error("not under test");
  aiCalls.push(init!);
  const next = replies.shift();
  if (!next) throw new Error("unexpected AI request");
  return next;
});
const aiBody = (i: number) => JSON.parse(aiCalls[i].body as string);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SellerChatPage />
    </QueryClientProvider>,
  );
}

function sendFromInput(text: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "전송" }));
}

beforeEach(() => {
  // jsdom 에는 레이아웃이 없어 scrollTo 가 구현돼 있지 않다(대화 자동 스크롤이 부른다)
  Element.prototype.scrollTo = () => {};
  useChatStore.getState().reset();
  sessionStorage.clear();
  replies = [];
  aiCalls.length = 0;
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(ensureSession).mockReset().mockResolvedValue(session);
});

afterEach(async () => {
  cleanup();
  await new Promise((r) => setTimeout(r, 0));
  vi.unstubAllGlobals();
});

// 초안 턴은 프레임을 **한 청크**로 보낸다. 청크가 나뉘면 draft 와 done 사이에 렌더가 끼어
// done{replace} 가 카드를 가린다 — 별도 결함(07-issues I-3)이라 이 테스트의 관심(재시도)과 분리한다.
const draftTurn = () =>
  sse(
    [
      frame("meta", { lane: "product" }),
      frame("token", { text: "초안을 만들었어요." }),
      frame("draft", draft),
      frame("done", { finishReason: "stop", panel: "replace" }),
    ].join(""),
  );

/** 초안을 받고 카드의 "상품 등록"을 누른 뒤, 오류 상태가 된 카드의 영역을 돌려준다 */
async function confirmFromCard() {
  sendFromInput("이 셔츠 등록해 줘");
  await screen.findByText("코튼 오버핏 셔츠");
  fireEvent.click(screen.getByRole("button", { name: /상품 등록/ }));
  await waitFor(() =>
    expect(useChatStore.getState().messages.slice(-1)[0].error).toBeDefined(),
  );
  const error = useChatStore.getState().messages.slice(-1)[0].error!;
  // 같은 문구가 좌측 말풍선(span)과 카드(p)에 함께 뜬다
  const cardMessage = (await screen.findAllByText(error)).find(
    (el) => el.tagName === "P",
  );
  expect(cardMessage).toBeDefined(); // 전제 — 카드가 오류 상태로 바뀌었다
  return cardMessage!.parentElement!;
}

// 카드가 오류 상태로 보이는 실제 경로는 "등록 승인 실패"뿐이다. 수정 요청은 입력창 전송이
// 패널을 "auto"로 돌려 카드가 가려지므로(07-issues I-3과 같은 원인) 카드 버튼에 닿지 않는다.
// 서버가 등록 실패를 action 으로 알리는 경우도 done{keep} 이 패널을 목록으로 돌려 카드가 보이지 않는다.
describe("판매자 등록 카드 — 다시 시도 (H1 · I-4)", () => {
  it("[H1·카드] 승인 요청이 나가기 전에 실패하면(세션 확보 실패) 카드의 다시 시도가 같은 초안을 다시 승인한다", async () => {
    vi.mocked(ensureSession)
      .mockResolvedValueOnce(session)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(session);
    replies.push(
      draftTurn(),
      sse(frame("done", { finishReason: "stop", panel: "refresh" })),
    );
    renderPage();

    const card = await confirmFromCard();
    expect(aiCalls).toHaveLength(1); // 전제 — 승인 요청은 나가지 못했다
    fireEvent.click(within(card).getByRole("button", { name: /다시 시도/ }));

    await waitFor(() => expect(aiCalls).toHaveLength(2));
    expect(aiBody(1)).toMatchObject({ action: "confirm", draftId: "draft-1" });
  });

  it("[I-4·카드] 승인 요청이 나간 뒤 실패하면(500) 카드와 말풍선 어디에도 다시 시도가 없고 반영 여부 확인을 안내한다", async () => {
    replies.push(draftTurn(), rejected(500));
    renderPage();

    const card = await confirmFromCard();

    expect(card.textContent).toContain("상품 목록에서 반영 여부를 확인");
    expect(screen.queryAllByRole("button", { name: /다시 시도/ })).toHaveLength(0);
    expect(aiCalls).toHaveLength(2);
  });
});
