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
import type { ComponentProps } from "react";
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
import { SellerWorkspace } from "./components/SellerWorkspace";

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

// 초안 턴은 프레임을 **한 청크**로 보낸다. 청크가 나뉘면 draft 와 done 사이에 렌더가 끼어
// done{replace} 가 카드를 가린다 — 별도 결함(07-issues I-3)이라 이 테스트의 관심(재시도)과 분리한다.
const draftTurn = (target: SellerDraft = draft) =>
  sse(
    [
      frame("meta", { lane: "product" }),
      frame("token", { text: "초안을 만들었어요." }),
      frame("draft", target),
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
      fireEvent.click(await screen.findByRole("button", { name: confirmButton }));

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

  /**
   * 이전 초안을 치운다. 패널은 초안 **수가 늘 때만** 결과로 전환해, 교체된 새 초안은 카드가 보이지 않는다(07-issues I-3).
   * 별도 결함이라 이 테스트의 관심(경고)과 분리하려고, 새 초안을 받기 전에 이전 초안을 없앤다.
   */
  const closeOldDraft = () =>
    act(() => {
      useChatStore.setState({ results: [] });
    });

  /** 초안을 받아 승인까지 누른다 */
  async function approve(target: SellerDraft, button: RegExp) {
    sendFromInput("초안 만들어 줘");
    fireEvent.click(await screen.findByRole("button", { name: button }));
    await waitFor(() => expect(useChatStore.getState().isStreaming).toBe(false));
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
    fireEvent.click(await screen.findByRole("button", { name: /적용/ }));
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

    closeOldDraft();
    sendFromInput("다시 만들어 줘");
    expect(await screen.findByText(WARNING)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /적용/ }));

    // 1단계 — 아직 나가지 않는다
    expect(screen.queryByRole("button", { name: /확인했고 승인/ })).not.toBeNull();
    expect(screen.queryByRole("link", { name: /상품 목록 보기/ })).not.toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(aiCalls).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /돌아가기/ }));
    expect(aiCalls).toHaveLength(3);

    fireEvent.click(await screen.findByRole("button", { name: /적용/ }));
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

    closeOldDraft();
    sendFromInput("다시 만들어 줘");

    expect(await screen.findByText(WARNING)).toBeTruthy();
  });

  it("[I-5·화면] 등록은 대상을 구분할 id 가 없어 미해결 등록이 있으면 새 등록 초안에 경고한다", async () => {
    replies.push(draftTurn(draft), rejected(500), draftTurn(newCreate));
    renderPage();
    await approve(draft, /상품 등록/);

    closeOldDraft();
    sendFromInput("다시 만들어 줘");

    expect(await screen.findByText(WARNING)).toBeTruthy();
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

    closeOldDraft();
    sendFromInput("다른 상품 가격 내려 줘");
    const apply = await screen.findByRole("button", { name: /적용/ });
    expect(screen.queryByText(WARNING)).toBeNull();
    fireEvent.click(apply);

    await waitFor(() => expect(aiCalls).toHaveLength(4));
    expect(aiBody(3)).toMatchObject({ draftId: otherProduct.draftId });
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
    closeOldDraft();
    sendFromInput("다시 만들어 줘");
    await screen.findByRole("button", { name: /적용/ });
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

  // 입력창 전송은 패널을 "auto"로 돌려 카드가 가려진다(I-3) — 화면 전체로는 닿지 않아 패널을 직접 렌더한다
  it("[I-5·카드] 마지막 말풍선이 실패여도 수정 카드는 초안 상태로만 잠긴다", () => {
    const props = {
      tab: "products",
      filters: {},
      onTabChange: noop,
      onBackToList: noop,
      results: [{ kind: "draft", draft: updateDraft }],
      showResults: true,
      isStreaming: false,
      analysisReport: null,
      analysisLoading: false,
      streamError: "다른 질문이 실패했어요",
      onConfirmDraft: noop,
      onCancelDraft: noop,
    } as unknown as ComponentProps<typeof SellerWorkspace>;
    render(<SellerWorkspace {...props} />);

    expect(screen.queryByRole("button", { name: /적용/ })).not.toBeNull();
    expect(screen.queryByRole("link", { name: /상품 목록 보기/ })).toBeNull();
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
