import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureSession,
  refreshTicket,
  SessionClaimPendingError,
} from "@/shared/chat/sessionCoordinator";
import { useChatStore } from "@/shared/chat/store";
import { useAuthStore } from "@/shared/stores/authStore";
import type { ChatSession, DraftApproval, SellerDraft } from "@/shared/types/chat";
import SellerChatPage from "./ChatPage";
import { ProductCreateCard } from "./components/ProductCreateCard";
import { ProductDiffCard } from "./components/ProductDiffCard";

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
const token2 = (text: string) => frame("token", { text });
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
  useChatStore.setState({ unresolvedApprovals: [] }); // 새 대화(reset)가 일부러 지우지 않는 값
  useAuthStore.setState({ user: null });
  sessionStorage.clear();
  replies = [];
  aiCalls.length = 0;
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(ensureSession).mockReset().mockResolvedValue(session);
  vi.mocked(refreshTicket).mockReset().mockResolvedValue(session);
});

afterEach(async () => {
  cleanup();
  await new Promise((r) => setTimeout(r, 0));
  vi.unstubAllGlobals();
});

/**
 * 청크 사이에 실제로 시간을 둔다 — 이 틈에 React 가 렌더·이펙트를 실행한다.
 * 스트림을 미리 채우면 읽는 쪽이 쉬지 않아 렌더가 끼어들지 못하므로 읽을 때마다 하나씩 내준다.
 */
function chunked(chunks: string[]): Response {
  const queue = [...chunks];
  const stream = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        await new Promise((r) => setTimeout(r, 5));
        const next = queue.shift();
        if (next === undefined) controller.close();
        else controller.enqueue(encoder.encode(next));
      },
    },
    { highWaterMark: 0 },
  );
  return new Response(stream, { status: 200 });
}

/** 서버가 언제 보낼지 테스트가 정하는 스트림 */
function heldStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start: (c) => {
      controller = c;
    },
  });
  return {
    response: new Response(stream, { status: 200 }),
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
  };
}

type Panel = "replace" | "keep" | "refresh";
const draftFrames = (target: SellerDraft, panel: Panel) => [
  frame("meta", { lane: "product" }),
  frame("token", { text: "초안을 만들었어요." }),
  frame("draft", target),
  frame("done", { finishReason: "stop", panel }),
];
const CHUNKINGS: [string, (frames: string[]) => string[]][] = [
  ["한 청크", (frames) => [frames.join("")]],
  ["프레임별 청크", (frames) => frames],
  [
    "draft 와 done 사이에만 경계",
    (frames) => [frames.slice(0, -1).join(""), frames[frames.length - 1]],
  ],
];
const draftTurn = (target: SellerDraft = draft, panel: Panel = "replace") =>
  chunked(draftFrames(target, panel));

/** 응답이 끝나 눌 수 있게 된 버튼 — 스트리밍 중에는 카드 버튼이 비활성이다 */
async function readyButton(name: RegExp) {
  return waitFor(() => {
    const button = screen.queryByRole("button", { name }) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button!.disabled).toBe(false);
    return button!;
  });
}
const turnEnded = () =>
  waitFor(() => expect(useChatStore.getState().isStreaming).toBe(false));

/** 초안을 받고 카드의 "상품 등록"을 누른 뒤, 오류 상태가 된 카드의 영역을 돌려준다 */
async function confirmFromCard() {
  sendFromInput("이 셔츠 등록해 줘");
  fireEvent.click(await readyButton(/상품 등록/));
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

// 서버가 등록 실패를 action 으로 알리는 경우는 done{keep} 이 패널을 목록으로 돌려 카드가 보이지 않는다.
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

// 등록·수정·삭제 승인은 모두 같은 confirm 경로다 — 카드만 다르다
const updateDraft: SellerDraft = {
  draftId: "draft-update",
  op: "update",
  productId: "7",
  changes: [{ field: "price", before: 32000, after: 30000 }],
  summary: "가격을 30,000원으로 인하",
};
const deleteDraft: SellerDraft = {
  draftId: "draft-delete",
  op: "delete",
  productId: "7",
  changes: [{ field: "name", before: "코튼 셔츠", after: "" }],
  summary: "상품 삭제",
};

describe("판매자 등록 카드 — 재시도할 수 없는 실패 (I-4)", () => {
  // 요청 전 실패라 승인 상태는 비어 있고 카드는 오류 상태인데, 재시도는 불가능한 경로.
  // 승인 잠금(I-5)이 가리지 않으므로 버튼 노출이 canRetry 를 따르는지 여기서 확인된다.
  it("[I-4·카드] 승계 대기로 승인을 보내지 못하면 카드에 다시 시도가 없다 — 눌러도 재시도되지 않는 버튼을 그리지 않는다", async () => {
    vi.mocked(ensureSession)
      .mockResolvedValueOnce(session)
      .mockRejectedValue(new SessionClaimPendingError());
    replies.push(draftTurn());
    renderPage();

    const card = await confirmFromCard();

    expect(aiCalls).toHaveLength(1);
    expect(within(card).queryByRole("button", { name: /다시 시도/ })).toBeNull();
    expect(within(card).queryByRole("button", { name: /초안 닫기/ })).not.toBeNull();
  });
});

describe("판매자 승인 — 새 티켓과 401 (I-6)", () => {
  it.each([
    ["등록", draft, /상품 등록/],
    ["수정", updateDraft, /적용/],
    ["삭제", deleteDraft, /적용/],
  ] as const)(
    "[I-6·화면] %s 승인은 새 티켓을 받아 한 번만 보내고, 401 이면 다시 보내지 않으며 다시 시도도 주지 않는다",
    async (_label, target, confirmButton) => {
      replies.push(draftTurn(target), rejected(401), sse(frame("done", { finishReason: "stop" })));
      renderPage();
      sendFromInput("초안 만들어 줘");
      fireEvent.click(await readyButton(confirmButton));

      await waitFor(() =>
        expect(useChatStore.getState().messages.slice(-1)[0].error).toBeDefined(),
      );

      expect(ensureSession).toHaveBeenLastCalledWith(
        "SELLER",
        session.sessionId,
        true,
        { fresh: true },
      );
      expect(aiCalls).toHaveLength(2); // 초안 턴 1 + 승인 1
      expect(aiBody(1)).toMatchObject({ action: "confirm", draftId: target.draftId });
      expect(refreshTicket).not.toHaveBeenCalled();
      expect(useChatStore.getState().messages.slice(-1)[0].error).toContain(
        "반영 여부를 확인",
      );
      expect(screen.queryAllByRole("button", { name: /다시 시도/ })).toHaveLength(0);
    },
  );
});

const sellerUser = (id: string) => ({
  id,
  email: `${id}@example.com`,
  nickname: id,
  role: "SELLER" as const,
});

describe("판매자 승인 상태와 카드 (I-5)", () => {
  const WARNING = /이전 승인 결과를 확인하지 못했어요/;
  const newUpdate: SellerDraft = { ...updateDraft, draftId: "draft-update-2" };
  const otherProduct: SellerDraft = { ...updateDraft, draftId: "draft-other", productId: "8" };
  const newCreate: SellerDraft = { ...draft, draftId: "draft-create-2" };
  const keepDone = () =>
    sse(token2("안내 문구"), frame("done", { finishReason: "stop", panel: "keep" }));

  /** 초안을 받아 승인까지 누른다 */
  async function approve(target: SellerDraft, button: RegExp) {
    sendFromInput("초안 만들어 줘");
    fireEvent.click(await readyButton(button));
    await turnEnded();
    await waitFor(() =>
      expect(aiCalls.some((c) => JSON.parse(c.body as string).draftId === target.draftId)).toBe(true),
    );
  }

  it.each([
    ["수정", updateDraft],
    ["삭제", deleteDraft],
  ] as const)(
    "[I-5·화면] %s 승인이 요청 후 실패하면 적용 버튼이 사라져 같은 승인을 다시 보낼 수 없다",
    async (_label, target) => {
      replies.push(draftTurn(target), rejected(500));
      renderPage();

      await approve(target, /적용/);

      await waitFor(() =>
        expect(screen.queryByRole("button", { name: /적용/ })).toBeNull(),
      );
      expect(screen.queryByRole("link", { name: /상품 목록 보기/ })).not.toBeNull();
      expect(screen.queryByRole("button", { name: /초안 닫기/ })).not.toBeNull();
      expect(screen.queryByRole("button", { name: /다시 시도/ })).toBeNull();
      expect(aiCalls).toHaveLength(2);
    },
  );

  it("[I-5·화면] 수정 승인이 요청 전에 실패하면 적용 버튼이 남아 같은 초안을 다시 승인할 수 있다", async () => {
    vi.mocked(ensureSession)
      .mockResolvedValueOnce(session)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(session);
    replies.push(draftTurn(updateDraft), sse(frame("done", { finishReason: "stop", panel: "refresh" })));
    renderPage();

    sendFromInput("가격 내려 줘");
    fireEvent.click(await readyButton(/적용/));
    await waitFor(() =>
      expect(useChatStore.getState().messages.slice(-1)[0].error).toBeDefined(),
    );
    expect(aiCalls).toHaveLength(1);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /적용/ })).not.toBeNull(),
    );

    fireEvent.click(screen.getByRole("button", { name: /적용/ }));

    await waitFor(() => expect(aiCalls).toHaveLength(2));
    expect(aiBody(1)).toMatchObject({ draftId: updateDraft.draftId });
  });

  it("[I-5·화면] unknown 뒤 같은 상품의 새 초안은 경고하고, 2단계 확인을 거쳐야 승인이 나간다", async () => {
    replies.push(
      draftTurn(updateDraft),
      rejected(500),
      draftTurn(newUpdate),
      sse(frame("done", { finishReason: "stop", panel: "refresh" })),
    );
    renderPage();
    await approve(updateDraft, /적용/);

    sendFromInput("다시 만들어 줘");
    await waitFor(() => expect(screen.queryByText(WARNING)).not.toBeNull());
    fireEvent.click(await readyButton(/적용/));

    // 1단계 — 아직 나가지 않는다
    expect(screen.queryByRole("button", { name: /확인했고 승인/ })).not.toBeNull();
    expect(screen.queryByRole("link", { name: /상품 목록 보기/ })).not.toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(aiCalls).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /돌아가기/ }));
    expect(aiCalls).toHaveLength(3);

    fireEvent.click(await readyButton(/적용/));
    fireEvent.click(screen.getByRole("button", { name: /확인했고 승인/ }));

    await waitFor(() => expect(aiCalls).toHaveLength(4));
    expect(aiBody(3)).toMatchObject({ action: "confirm", draftId: newUpdate.draftId });
    // 이전 기록은 사용자 확인으로 지워진다. 이번 승인도 action 없이 끝나 새 기록이 남는다.
    await waitFor(() =>
      expect(
        useChatStore.getState().unresolvedApprovals.map((u) => u.draftId),
      ).toEqual([newUpdate.draftId]),
    );
  });

  it("[I-5·화면] closed 뒤 같은 상품의 새 초안도 경고한다 — 처리 여부를 모르는 것은 같다", async () => {
    replies.push(draftTurn(updateDraft), keepDone(), draftTurn(newUpdate));
    renderPage();
    await approve(updateDraft, /적용/);
    expect(useChatStore.getState().unresolvedApprovals).toHaveLength(1);

    sendFromInput("다시 만들어 줘");

    await waitFor(() => expect(screen.queryByText(WARNING)).not.toBeNull());
  });

  it("[I-5·화면] 등록은 대상을 구분할 id 가 없어 미해결 등록이 있으면 새 등록 초안에 경고한다", async () => {
    replies.push(draftTurn(draft), rejected(500), draftTurn(newCreate));
    renderPage();
    await approve(draft, /상품 등록/);

    sendFromInput("다시 만들어 줘");

    await waitFor(() => expect(screen.queryByText(WARNING)).not.toBeNull());
  });

  it("[I-5·화면] 다른 상품의 새 초안에는 경고하지 않고 바로 승인된다", async () => {
    replies.push(
      draftTurn(updateDraft),
      rejected(500),
      draftTurn(otherProduct),
      sse(frame("done", { finishReason: "stop", panel: "refresh" })),
    );
    renderPage();
    await approve(updateDraft, /적용/);

    sendFromInput("다른 상품 가격 내려 줘");
    const apply = await readyButton(/적용/);
    expect(screen.queryByText(WARNING)).toBeNull();
    fireEvent.click(apply);

    await waitFor(() => expect(aiCalls).toHaveLength(4));
    expect(aiBody(3)).toMatchObject({ draftId: otherProduct.draftId });
  });

  it("[I-5·화면] 잠긴 초안을 그대로 둔 채 등록 초안을 받아도 경고와 2단계 확인을 거쳐 승인된다", async () => {
    replies.push(
      draftTurn(draft),
      rejected(500),
      draftTurn(newCreate),
      sse(frame("done", { finishReason: "stop", panel: "refresh" })),
    );
    renderPage();
    await approve(draft, /상품 등록/);
    expect(useChatStore.getState().results).toHaveLength(1); // 전제 — 이전 초안이 남아 있다

    sendFromInput("다시 만들어 줘");
    await waitFor(() => expect(screen.queryByText(WARNING)).not.toBeNull());
    fireEvent.click(await readyButton(/상품 등록/));
    expect(aiCalls).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /확인했고 승인/ }));

    await waitFor(() => expect(aiCalls).toHaveLength(4));
    expect(aiBody(3)).toMatchObject({ action: "confirm", draftId: newCreate.draftId });
  });

  it("[I-5·화면] 무관한 수정 요청이 실패해도 초안은 잠기지 않고 적용 버튼이 남는다", async () => {
    replies.push(draftTurn(updateDraft), rejected(500));
    renderPage();
    sendFromInput("가격 내려 줘");
    await readyButton(/적용/);

    sendFromInput("재고도 바꿔 줘");
    await waitFor(() =>
      expect(useChatStore.getState().messages.slice(-1)[0].error).toBeDefined(),
    );
    await turnEnded();

    expect(screen.queryByRole("button", { name: /적용/ })).not.toBeNull();
    expect(screen.queryByRole("link", { name: /상품 목록 보기/ })).toBeNull();
  });

  it("[I-5·화면] 초안을 닫아도 미해결 기록은 남는다 — 닫는다고 취소되는 것이 아니다", async () => {
    replies.push(draftTurn(updateDraft), rejected(500));
    renderPage();
    await approve(updateDraft, /적용/);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /초안 닫기/ })).not.toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: /초안 닫기/ }));

    expect(useChatStore.getState().results).toEqual([]);
    expect(useChatStore.getState().unresolvedApprovals).toHaveLength(1);
  });

  it("[I-5·화면] 로그아웃 뒤 다른 계정에는 이전 계정의 미해결 기록이 경고로 보이지 않는다", async () => {
    useAuthStore.setState({ user: sellerUser("seller-a") });
    replies.push(draftTurn(updateDraft), rejected(500), draftTurn(newUpdate));
    const view = renderPage();
    await approve(updateDraft, /적용/);
    expect(useChatStore.getState().unresolvedApprovals).toHaveLength(1); // 전제

    act(() => {
      useAuthStore.getState().clearAuth();
      useAuthStore.setState({ user: sellerUser("seller-b") });
    });
    sendFromInput("다시 만들어 줘");
    await readyButton(/적용/);
    expect(screen.queryByText(WARNING)).toBeNull();
    view.unmount();
  });
});

describe("승인 상태별 카드 표시 (I-5)", () => {
  const CLOSED = /결과를 확정하지 못했어요/;
  const success = /상품이 등록되었어요|완료/;
  const noop = () => {};
  const renderCard = (props: Partial<Parameters<typeof ProductDiffCard>[0]>, target: SellerDraft) =>
    render(
      <ProductDiffCard draft={target} onConfirm={noop} onCancel={noop} {...props} />,
    );

  it.each([
    ["수정 카드", (approval: DraftApproval) => renderCard({ approval }, updateDraft), /적용/],
    [
      "등록 카드",
      (approval: DraftApproval) =>
        render(<ProductCreateCard draft={draft} onConfirm={noop} onCancel={noop} approval={approval} />),
      /상품 등록/,
    ],
  ] as const)(
    "[I-5·카드] %s — closed 는 승인 버튼 없이 중립 안내만 보이고 성공으로 표시하지 않는다",
    (_label, show, confirmButton) => {
      show("closed");

      expect(screen.queryByText(CLOSED)).not.toBeNull();
      expect(screen.queryByRole("button", { name: confirmButton })).toBeNull();
      expect(screen.queryByText(success)).toBeNull();
      expect(screen.queryByRole("link", { name: /상품 목록 보기/ })).not.toBeNull();
      expect(screen.queryByRole("button", { name: /초안 닫기/ })).not.toBeNull();
    },
  );

  it.each([
    ["수정 카드", () => renderCard({ approval: "rejected", approvalMessage: "반영하지 못했어요" }, updateDraft), /적용/],
    [
      "등록 카드",
      () =>
        render(
          <ProductCreateCard
            draft={draft}
            onConfirm={noop}
            onCancel={noop}
            approval="rejected"
            approvalMessage="반영하지 못했어요"
          />,
        ),
      /상품 등록/,
    ],
  ] as const)("[I-5·카드] %s — rejected 는 서버 문구를 보여 주고 승인 버튼이 없다", (_label, show, confirmButton) => {
    show();

    expect(screen.queryByText("반영하지 못했어요")).not.toBeNull();
    expect(screen.queryByRole("button", { name: confirmButton })).toBeNull();
  });

  it("[I-5·카드] 등록 카드 — 이전 승인이 불명확하면 경고하고, 2단계 확인 뒤에만 승인한다", () => {
    const onConfirm = vi.fn();
    const onAcknowledge = vi.fn();
    render(
      <ProductCreateCard
        draft={draft}
        onConfirm={onConfirm}
        onCancel={noop}
        duplicateRisk
        onAcknowledge={onAcknowledge}
      />,
    );
    expect(screen.queryByText(/이전 승인 결과를 확인하지 못했어요/)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /상품 등록/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /확인했고 승인/ })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /확인했고 승인/ }));
    expect(onAcknowledge).toHaveBeenCalledWith(draft.draftId);
  });

  it("[I-5·카드] 등록 카드 — pending 은 처리 중으로 잠긴다", () => {
    render(
      <ProductCreateCard
        draft={draft}
        onConfirm={noop}
        onCancel={noop}
        disabled
        approval="pending"
      />,
    );

    expect((screen.getByRole("button", { name: /등록 중/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("패널 전환 — 새 초안 (I-3)", () => {
  const replacement: SellerDraft = {
    ...updateDraft,
    draftId: "draft-update-2",
    summary: "가격을 28,000원으로 인하",
  };
  const generalTurn = (panel: Panel) =>
    chunked([token2("안내 문구"), frame("done", { finishReason: "stop", panel })]);
  const panelShows = (summary: string) => screen.queryByText(summary) !== null;

  it.each(CHUNKINGS)("[I-3] %s — 첫 초안은 응답이 끝난 뒤에도 카드가 보인다", async (_label, split) => {
    replies.push(chunked(split(draftFrames(draft, "replace"))));
    renderPage();
    sendFromInput("이 셔츠 등록해 줘");

    await turnEnded();
    await readyButton(/상품 등록/);
  });

  it.each(CHUNKINGS)("[I-3] %s — 새 초안이 기존 초안을 교체해도 새 카드가 보인다", async (_label, split) => {
    replies.push(draftTurn(updateDraft), chunked(split(draftFrames(replacement, "replace"))));
    renderPage();
    sendFromInput("가격 내려 줘");
    await readyButton(/적용/);

    sendFromInput("28,000원으로 해 줘");

    await waitFor(() => expect(panelShows(replacement.summary)).toBe(true));
    await turnEnded();
    expect(panelShows(replacement.summary)).toBe(true);
    expect(panelShows(updateDraft.summary)).toBe(false);
    await readyButton(/적용/);
  });

  describe.each(["keep", "refresh"] as const)("done{%s}", (panel) => {
    it.each(CHUNKINGS)(`[I-3] %s — 같은 턴에 초안이 오면 done{${panel}} 뒤에도 카드가 보인다`, async (_label, split) => {
      replies.push(chunked(split(draftFrames(updateDraft, panel))));
      renderPage();
      sendFromInput("가격 내려 줘");

      await turnEnded();
      await new Promise((r) => setTimeout(r, 20));
      await readyButton(/적용/);
    });

    it(`[I-3] 초안 없는 턴이 done{${panel}} 로 목록으로 돌아간 뒤 새 초안이 와도 카드가 보인다`, async () => {
      replies.push(draftTurn(updateDraft), generalTurn(panel), draftTurn(replacement));
      renderPage();
      sendFromInput("가격 내려 줘");
      await readyButton(/적용/);

      sendFromInput("이번 주 주문은?");
      await turnEnded();
      await waitFor(() => expect(panelShows(updateDraft.summary)).toBe(false)); // 전제 — 목록으로 돌아갔다

      sendFromInput("28,000원으로 해 줘");
      await waitFor(() => expect(panelShows(replacement.summary)).toBe(true));
      await readyButton(/적용/);
    });
  });

  it("[I-3] done{refresh} 는 초안이 온 턴에도 목록 데이터를 다시 받는다 — 패널만 초안에 남는다", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    replies.push(draftTurn(updateDraft, "refresh"));
    render(
      <QueryClientProvider client={client}>
        <SellerChatPage />
      </QueryClientProvider>,
    );
    sendFromInput("가격 내려 줘");

    await readyButton(/적용/);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["seller"] });
  });

  it("[I-3] 동일한 초안의 재렌더링과 무관한 상태 변경으로 닫은 패널이 다시 열리지 않는다", async () => {
    replies.push(draftTurn(updateDraft));
    const view = renderPage();
    sendFromInput("가격 내려 줘");
    await readyButton(/적용/);

    fireEvent.click(screen.getByRole("button", { name: /목록으로/ }));
    expect(panelShows(updateDraft.summary)).toBe(false);

    const store = useChatStore.getState();
    act(() => {
      store.setResults([...useChatStore.getState().results]); // 같은 초안, 새 배열
      store.setDraftApproval(updateDraft.draftId, "closed");
      store.setProgress("진행 중");
      store.appendToLastAssistant("추가 문구");
    });
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SellerChatPage />
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 20));

    expect(panelShows(updateDraft.summary)).toBe(false);
  });

  it.each(["keep", "replace"] as const)("[I-3] 닫은 패널은 초안 없는 턴의 done{%s} 로 다시 열리지 않는다", async (panel) => {
    replies.push(draftTurn(updateDraft), generalTurn(panel));
    renderPage();
    sendFromInput("가격 내려 줘");
    await readyButton(/적용/);
    fireEvent.click(screen.getByRole("button", { name: /목록으로/ }));

    sendFromInput("이번 주 주문은?");
    await waitFor(() => expect(aiCalls).toHaveLength(2));
    await turnEnded();
    await new Promise((r) => setTimeout(r, 20));

    expect(panelShows(updateDraft.summary)).toBe(false);
  });

  it("[I-3] 응답 도중 닫은 패널은 그 턴의 done 으로 다시 열리지 않는다", async () => {
    const turn = heldStream();
    replies.push(turn.response);
    renderPage();
    sendFromInput("가격 내려 줘");
    await waitFor(() => expect(aiCalls).toHaveLength(1));

    turn.push(frame("draft", updateDraft));
    await waitFor(() => expect(panelShows(updateDraft.summary)).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /목록으로/ }));
    turn.push(frame("done", { finishReason: "stop", panel: "replace" }));
    turn.close();
    await turnEnded();
    await new Promise((r) => setTimeout(r, 20));

    expect(panelShows(updateDraft.summary)).toBe(false);
  });

  it("[I-3] 초안 검토 중 수정을 요청하면 응답하는 동안 카드가 가려지지 않는다", async () => {
    const edit = heldStream();
    replies.push(draftTurn(updateDraft), edit.response);
    renderPage();
    sendFromInput("가격 내려 줘");
    await readyButton(/적용/);

    sendFromInput("28,000원으로 해 줘");
    await waitFor(() => expect(aiCalls).toHaveLength(2));
    edit.push(token2("고치는 중"));
    await new Promise((r) => setTimeout(r, 20));

    expect(panelShows(updateDraft.summary)).toBe(true);
    edit.close();
  });

  it.each([
    ["요청 거절", () => rejected(500)],
    ["SSE error", () => chunked([frame("error", { code: "INTERNAL", message: "" })])],
  ] as const)("[I-3] 수정 요청이 실패해도(%s) 카드가 남는다", async (_label, failure) => {
    replies.push(draftTurn(updateDraft), failure());
    renderPage();
    sendFromInput("가격 내려 줘");
    await readyButton(/적용/);

    sendFromInput("28,000원으로 해 줘");
    await waitFor(() =>
      expect(useChatStore.getState().messages.slice(-1)[0].error).toBeDefined(),
    );
    await turnEnded();

    await readyButton(/적용/);
  });

  it("[I-3] 초안 뒤 error 로 끝난 턴의 표시가 다음 턴으로 새지 않는다 — 초안 없는 다음 턴의 done{keep} 은 목록으로 돌아간다", async () => {
    replies.push(
      chunked([frame("draft", updateDraft), frame("error", { code: "INTERNAL", message: "" })]),
      generalTurn("keep"),
    );
    renderPage();
    sendFromInput("가격 내려 줘");
    await readyButton(/적용/);

    sendFromInput("이번 주 주문은?");
    await waitFor(() => expect(aiCalls).toHaveLength(2));
    await turnEnded();

    await waitFor(() => expect(panelShows(updateDraft.summary)).toBe(false));
  });

  it("[I-3] 초안을 닫은 뒤 받은 새 초안은 다시 패널을 연다", async () => {
    replies.push(draftTurn(updateDraft), draftTurn(replacement));
    renderPage();
    sendFromInput("가격 내려 줘");
    await readyButton(/적용/);
    fireEvent.click(screen.getByRole("button", { name: /취소/ }));
    expect(panelShows(updateDraft.summary)).toBe(false);

    sendFromInput("다시 만들어 줘");

    await waitFor(() => expect(panelShows(replacement.summary)).toBe(true));
  });

  it("[I-3] 새 대화로 버려진 턴의 초안은 패널을 열지 않는다", async () => {
    const turn = heldStream();
    replies.push(turn.response);
    renderPage();
    sendFromInput("가격 내려 줘");
    await waitFor(() => expect(aiCalls).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: /새 대화/ }));
    turn.push(frame("draft", updateDraft));
    await new Promise((r) => setTimeout(r, 20));

    expect(panelShows(updateDraft.summary)).toBe(false);
    expect(useChatStore.getState().results).toEqual([]);
  });

  it.each(CHUNKINGS)("[I-3 회귀] %s — 분석 리포트는 done{replace} 뒤 패널에 표시된다", async (_label, split) => {
    replies.push(
      chunked(
        split([
          frame("meta", { lane: "analysis" }),
          token2("지난주 매출이 늘었어요."),
          frame("done", { finishReason: "stop", panel: "replace" }),
        ]),
      ),
    );
    renderPage();
    sendFromInput("지난주 분석해 줘");

    await turnEnded();
    await waitFor(() =>
      expect(useChatStore.getState().analysisReport).not.toBeNull(),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /목록으로/ })).not.toBeNull(),
    );
  });

  it("[I-3 회귀] 초안이 만료돼 사라진 뒤 질문이 실패하면 빈 결과 패널이 아니라 목록이다", async () => {
    replies.push(draftTurn(updateDraft), rejected(500));
    renderPage();
    sendFromInput("가격 내려 줘");
    await readyButton(/적용/);
    act(() => useChatStore.getState().dropDraft(updateDraft.draftId)); // 초안 TTL 만료와 같은 동작

    sendFromInput("이번 주 주문은?");
    await waitFor(() =>
      expect(useChatStore.getState().messages.slice(-1)[0].error).toBeDefined(),
    );

    expect(screen.queryByRole("button", { name: /목록으로/ })).toBeNull();
  });

  it("[I-3 회귀] 목록을 고른 뒤 새 분석을 시키면 응답 중에 스켈레톤이 보인다", async () => {
    const analysis = heldStream();
    replies.push(draftTurn(updateDraft), analysis.response);
    renderPage();
    sendFromInput("가격 내려 줘");
    await readyButton(/적용/);
    fireEvent.click(screen.getByRole("button", { name: /목록으로/ }));

    sendFromInput("지난주 분석해 줘");
    await waitFor(() => expect(aiCalls).toHaveLength(2));
    analysis.push(frame("meta", { lane: "analysis" }));

    await waitFor(() => expect(screen.queryByLabelText("분석 중")).not.toBeNull());
    analysis.close();
  });
});

/**
 * 모바일 초안 접근(I-8)과 초안 복귀(I-9).
 *
 * jsdom 은 미디어 쿼리·CSS 를 적용하지 않는다. 여기서 "보인다/숨는다"는 **어느 칸을 보이도록 지정했는가**
 * (`lg` 미만에서 쓰이는 `hidden` 클래스)와 접근성 상태를 읽는 것이고, 실제 표시는 브라우저에서 확인해야 한다.
 */
describe("모바일 초안 접근과 초안 복귀 (I-8 · I-9)", () => {
  const other: SellerDraft = {
    ...updateDraft,
    draftId: "draft-other",
    productId: "8",
    summary: "다른 상품 가격 인하",
  };
  const next: SellerDraft = { ...updateDraft, draftId: "draft-update-2", summary: "가격을 28,000원으로 인하" };
  const ENTRY = /^초안 보기 \((\d+)\)$/;
  const chatPane = () => screen.queryByRole("region", { name: "AI 채팅" });
  const workPane = () =>
    screen
      .queryAllByRole("region")
      .find((el) => el.getAttribute("aria-label") !== "AI 채팅") ?? null;
  /** lg 미만에서 이 칸을 보이도록 지정했는가 */
  const mobileShown = (el: HTMLElement | null) => {
    expect(el).not.toBeNull();
    return !el!.classList.contains("hidden");
  };
  const currentTab = () => {
    const nav = screen.queryByRole("navigation", { name: "화면 전환" });
    expect(nav).not.toBeNull();
    return within(nav!)
      .queryAllByRole("button")
      .filter((el) => el.getAttribute("aria-current") === "page")
      .map((el) => el.textContent);
  };
  const tab = (name: string) => {
    const nav = screen.queryByRole("navigation", { name: "화면 전환" });
    expect(nav).not.toBeNull();
    return within(nav!).getByRole("button", { name });
  };
  const entries = () => screen.queryAllByRole("button", { name: ENTRY });
  const shows = (summary: string) => screen.queryByText(summary) !== null;
  const paneLabel = () => workPane()?.getAttribute("aria-label") ?? null;
  /** 작업 영역(목록 상단)의 입구 — 채팅 칸의 입구와 구분한다 */
  const listEntries = () => entries().filter((e) => workPane()?.contains(e));
  const listEntry = () => {
    const [el] = listEntries();
    expect(el).toBeDefined();
    return el!;
  };

  async function receiveDraft(target: SellerDraft = updateDraft) {
    replies.push(draftTurn(target));
    renderPage();
    sendFromInput("가격 내려 줘");
    await readyButton(/적용/);
  }

  it.each(CHUNKINGS)("[I-8] %s — 새 초안이 오면 모바일에서 작업 영역을 보이게 하고, 결과 화면임을 접근성 정보로 알린다", async (_label, split) => {
    replies.push(chunked(split(draftFrames(updateDraft, "replace"))));
    renderPage();
    sendFromInput("가격 내려 줘");
    await turnEnded();
    await readyButton(/적용/);

    expect(mobileShown(workPane())).toBe(true);
    expect(mobileShown(chatPane())).toBe(false);
    expect(paneLabel()).toBe("초안 검토");
    expect(currentTab()).toEqual([]); // 결과를 보는 동안 어느 탭도 현재 화면이 아니다
  });

  it("[I-8] 작업 영역 → AI 채팅 → 초안 보기로 다시 작업 영역의 초안 카드로 돌아온다", async () => {
    await receiveDraft();

    fireEvent.click(tab("AI 채팅"));
    expect(mobileShown(chatPane())).toBe(true);
    expect(mobileShown(workPane())).toBe(false);
    expect(currentTab()).toEqual(["AI 채팅"]);

    const [entry] = entries();
    expect(entry?.textContent).toBe("초안 보기 (1)");
    fireEvent.click(entry!);

    expect(mobileShown(workPane())).toBe(true);
    expect(mobileShown(chatPane())).toBe(false);
    expect(shows(updateDraft.summary)).toBe(true);
    expect(currentTab()).toEqual([]);
  });

  it("[I-9] 목록으로 이동한 뒤 초안 보기로 기존 초안을 다시 연다 — 결과를 보는 동안에는 목록의 입구가 없다", async () => {
    await receiveDraft();
    fireEvent.click(screen.getByRole("button", { name: /목록으로/ }));
    expect(shows(updateDraft.summary)).toBe(false);
    expect(paneLabel()).toBe("작업 목록");
    expect(currentTab()).toEqual(["주문 관리"]);

    fireEvent.click(listEntry());

    expect(shows(updateDraft.summary)).toBe(true);
    expect(listEntries()).toHaveLength(0);
  });

  it("[I-9] done{keep} 로 목록에 돌아간 뒤에도 입구로 초안을 다시 연다 — keep 의 목록 복귀는 그대로다", async () => {
    replies.push(draftTurn(updateDraft), chunked([token2("안내"), frame("done", { finishReason: "stop", panel: "keep" })]));
    renderPage();
    sendFromInput("가격 내려 줘");
    await readyButton(/적용/);
    sendFromInput("이번 주 주문은?");
    await turnEnded();
    await waitFor(() => expect(shows(updateDraft.summary)).toBe(false)); // keep 은 여전히 목록으로

    fireEvent.click(listEntry());

    await readyButton(/적용/);
  });

  it.each([
    ["unknown", () => rejected(500), /반영 여부를 확인/],
    ["closed", () => sse(token2("안내"), frame("done", { finishReason: "stop", panel: "keep" })), /결과를 확정하지 못했어요/],
  ] as const)("[I-9] %s 초안의 안내를 입구로 다시 확인할 수 있고, 다시 승인할 수는 없다", async (_label, reply, notice) => {
    replies.push(draftTurn(updateDraft), reply());
    renderPage();
    sendFromInput("가격 내려 줘");
    fireEvent.click(await readyButton(/적용/));
    await turnEnded();
    if (shows(updateDraft.summary)) fireEvent.click(screen.getByRole("button", { name: /목록으로/ }));

    fireEvent.click(listEntry());

    await waitFor(() =>
      expect(workPane() && within(workPane()!).queryByText(notice)).not.toBeNull(),
    );
    expect(screen.queryByRole("button", { name: /적용/ })).toBeNull();
    expect(aiCalls).toHaveLength(2); // I-5 — 같은 초안은 다시 나가지 않는다
  });

  it("[I-8·I-5] closed 뒤 받은 새 초안은 모바일 작업 영역에서 경고와 2단계 확인을 거쳐 승인된다 — 채팅을 다녀와도 같다", async () => {
    replies.push(
      draftTurn(updateDraft),
      sse(token2("안내"), frame("done", { finishReason: "stop", panel: "keep" })),
      draftTurn(next),
      sse(frame("done", { finishReason: "stop", panel: "refresh" })),
    );
    renderPage();
    sendFromInput("가격 내려 줘");
    fireEvent.click(await readyButton(/적용/));
    await turnEnded();

    fireEvent.click(tab("AI 채팅"));
    sendFromInput("다시 만들어 줘");
    await waitFor(() => expect(shows(next.summary)).toBe(true));
    expect(mobileShown(workPane())).toBe(true);
    fireEvent.click(tab("AI 채팅"));
    expect(entries()).toHaveLength(1);
    fireEvent.click(entries()[0]);

    await waitFor(() => expect(screen.queryByText(/이전 승인 결과를 확인하지 못했어요/)).not.toBeNull());
    fireEvent.click(await readyButton(/적용/));
    expect(aiCalls).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /확인했고 승인/ }));
    await waitFor(() => expect(aiCalls).toHaveLength(4));
    expect(aiBody(3)).toMatchObject({ action: "confirm", draftId: next.draftId });
  });

  it.each(CHUNKINGS)("[I-9] %s — 한 턴에 초안이 둘이면 입구는 개수를 알리고 결과 패널 전체를 연다", async (_label, split) => {
    replies.push(
      chunked(
        split([
          frame("meta", { lane: "product" }),
          frame("draft", updateDraft),
          frame("draft", other),
          frame("done", { finishReason: "stop", panel: "replace" }),
        ]),
      ),
    );
    renderPage();
    sendFromInput("두 상품 가격 내려 줘");
    await turnEnded();
    await waitFor(() => expect(shows(other.summary)).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /목록으로/ }));

    const entry = listEntry();
    expect(entry.textContent).toBe("초안 보기 (2)");
    fireEvent.click(entry);

    expect(shows(updateDraft.summary)).toBe(true);
    expect(shows(other.summary)).toBe(true);
  });

  it("[I-9] 초안을 닫으면 개수가 줄고, 마지막 초안을 닫으면 입구가 사라진다", async () => {
    replies.push(
      chunked([frame("draft", updateDraft), frame("draft", other), frame("done", { finishReason: "stop", panel: "replace" })]),
    );
    renderPage();
    sendFromInput("두 상품 가격 내려 줘");
    await turnEnded();
    await waitFor(() => expect(shows(other.summary)).toBe(true));

    fireEvent.click(screen.getAllByRole("button", { name: /취소/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: /목록으로/ }));
    expect(entries().map((el) => el.textContent)).toContain("초안 보기 (1)");
    expect(entries().map((el) => el.textContent)).not.toContain("초안 보기 (2)");

    fireEvent.click(listEntry());
    fireEvent.click(screen.getByRole("button", { name: /취소/ }));

    expect(entries()).toHaveLength(0);
    expect(shows(other.summary)).toBe(false);
  });

  it("[I-9] 초안이 없으면 입구가 없다", () => {
    renderPage();
    expect(entries()).toHaveLength(0);
  });

  it("[I-9] 수동으로 닫은 패널은 입구가 있어도 무관한 상태 변경으로 다시 열리지 않는다", async () => {
    await receiveDraft();
    fireEvent.click(screen.getByRole("button", { name: /목록으로/ }));

    act(() => {
      const store = useChatStore.getState();
      store.setResults([...store.results]);
      store.setDraftApproval(updateDraft.draftId, "closed");
      store.appendToLastAssistant("추가 문구");
    });
    await new Promise((r) => setTimeout(r, 20));

    expect(shows(updateDraft.summary)).toBe(false);
    expect(entries().length).toBeGreaterThan(0);
  });

  it("[I-8 반응형] 데스크톱 클래스 분기는 그대로다 — 두 칸 모두 lg 에서 표시 지정, 채팅의 초안 보기는 lg 에서 숨김 지정", async () => {
    await receiveDraft();

    expect(chatPane()?.className ?? "").toContain("lg:flex");
    expect(workPane()?.className ?? "").toContain("lg:flex");
    fireEvent.click(tab("AI 채팅"));
    expect(chatPane()?.className ?? "").toContain("lg:flex");
    expect(workPane()?.className ?? "").toContain("lg:flex");
    const chatEntry = entries().find((el) => el.closest('[aria-label="AI 채팅"]'));
    expect(chatEntry).toBeDefined();
    expect(chatEntry!.closest(".lg\\:hidden")).not.toBeNull();
  });

  // 수정 요청은 기존 초안을 고치지 않는다 — 새 draftId 초안이 오면 교체되고, 되묻기로 끝나면 초안이 오지 않는다.
  // 그래서 "바로 반영"처럼 결과를 단정하지 않고, 새 초안을 검토한 뒤 승인한다는 흐름만 알린다.
  it("[I-8 문구] 등록 초안 안내는 새 초안이 만들어질 수 있고 검토 뒤 등록한다고 알린다 — 데스크톱·모바일 각자의 문구, 배치 클래스 유지", async () => {
    replies.push(draftTurn(draft));
    renderPage();
    sendFromInput("이 셔츠 등록해 줘");
    await readyButton(/상품 등록/);

    const desktop = screen.queryByText(
      "채팅으로 수정을 요청하면 오른쪽에 새 초안이 만들어질 수 있어요. 검토한 뒤 등록해 주세요.",
    );
    expect(desktop?.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "lg:inline"]));
    const mobile = screen.queryByText(
      "채팅으로 수정을 요청하면 새 초안이 만들어질 수 있어요. 검토한 뒤 등록해 주세요.",
    );
    expect(mobile?.className ?? "").toContain("lg:hidden");
    expect(screen.queryByText(/바로 반영/)).toBeNull();
  });

  it("[I-8·새 대화] 모바일 초안 결과 화면에서 새 대화를 누르면 채팅 화면으로 돌아간다 — 미해결 승인 기록은 그대로다", async () => {
    replies.push(draftTurn(updateDraft), rejected(500));
    renderPage();
    sendFromInput("가격 내려 줘");
    fireEvent.click(await readyButton(/적용/));
    await turnEnded();
    expect(paneLabel()).toBe("초안 검토"); // 전제 — 결과 화면
    expect(useChatStore.getState().unresolvedApprovals).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "새 대화" }));

    expect(mobileShown(chatPane())).toBe(true);
    expect(mobileShown(workPane())).toBe(false);
    expect(currentTab()).toEqual(["AI 채팅"]);
    expect(useChatStore.getState().results).toEqual([]);
    expect(useChatStore.getState().unresolvedApprovals).toHaveLength(1); // I-5 정책 그대로
  });

  it("[I-8·새 대화] 모바일 작업 목록 탭에서 새 대화를 누르면 그 탭에 머문다 — 기존 동작", async () => {
    renderPage();
    fireEvent.click(tab("상품 관리"));

    fireEvent.click(screen.getByRole("button", { name: "새 대화" }));

    expect(currentTab()).toEqual(["상품 관리"]);
    expect(mobileShown(workPane())).toBe(true);
  });
});
