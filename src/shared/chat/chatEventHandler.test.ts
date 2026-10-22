import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChatEvent,
  ProductGroup,
  SellerDraft,
  SellerReport,
} from "@/shared/types/chat";
import { createTurnHandler } from "./chatEventHandler";
import { useChatStore } from "./store";

/**
 * SSE 이벤트 순서 → 스토어 상태 회귀 방지.
 *
 * 여기서 지키려는 것은 계약(CH-2·S-4)이 정한 "순서에 따른 규칙"이다. 이벤트 하나만 보면
 * 맞는 처리가, 특정 순서로 오면 틀린 화면을 남긴다 — 수동 테스트로는 그 순서를
 * 재현하기 어려워(서버가 그렇게 보내야 한다) 지금까지 확인한 적이 없던 영역이다.
 */

const fetchChatListGroup = vi.fn<(listId: string) => Promise<ProductGroup>>();
vi.mock("@/shared/chat/lists", () => ({
  fetchChatListGroup: (listId: string) => fetchChatListGroup(listId),
}));

// 카드 0개 + 드롭 1개 — 핸들러가 "보여줄 거리가 있는 묶음"으로 받아들이는 최소 형태
function group(title: string): ProductGroup {
  return {
    title,
    items: [],
    recommendation: { listType: "PICK_ONE", itemsDropped: 1 },
  };
}

function report(title: string): SellerReport {
  return {
    title,
    period: { from: "2026-08-01", to: "2026-08-07" },
    generatedAt: "2026-08-08T10:00:00+09:00",
    summary: "",
    body: `${title} 본문`,
    findings: [],
    limitations: [],
    chartRequested: false,
    charts: [],
    recommendations: [],
    applyGuide: "",
  };
}

function draft(op: SellerDraft["op"], draftId: string): SellerDraft {
  return { draftId, op, productId: null, changes: [], summary: "" };
}

/** 한 턴을 시작한다 — useChat.run 이 스트림 전에 하는 것과 같다(빈 assistant 말풍선). */
function startTurn(opts?: Parameters<typeof createTurnHandler>[0]) {
  useChatStore
    .getState()
    .addMessage({ id: crypto.randomUUID(), role: "assistant", text: "" });
  const turn = createTurnHandler(opts ?? {});
  return {
    ...turn,
    feed: (...events: ChatEvent[]) => events.forEach((e) => turn.onEvent(e)),
  };
}

const lastMessage = () => useChatStore.getState().messages.slice(-1)[0];

describe("createTurnHandler", () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    fetchChatListGroup.mockReset();
  });

  describe("report — 커밋 신호는 done{replace} 다", () => {
    it("report 뒤 done{replace} 로 끝나면 리포트가 패널에 들어간다", () => {
      const { feed } = startTurn();
      feed(
        { type: "meta", data: { lane: "analysis" } },
        { type: "report", data: report("이번 주") },
        { type: "done", data: { finishReason: "stop", panel: "replace" } },
      );
      expect(useChatStore.getState().analysisReport?.title).toBe("이번 주");
    });

    it("report 뒤 error 로 끝나면 패널에 남지 않는다", () => {
      const { feed } = startTurn();
      feed(
        { type: "meta", data: { lane: "analysis" } },
        { type: "report", data: report("실패한 턴") },
        { type: "error", data: { code: "INTERNAL", message: "x" } },
      );
      expect(useChatStore.getState().analysisReport).toBeNull();
      expect(lastMessage().error).toBeTruthy();
    });

    it("error 뒤에 done 이 잘못 따라와도 실패한 턴의 리포트를 커밋하지 않는다", () => {
      // 계약상 error 는 종결이라 done 이 뒤따르지 않는다. 그래도 보관함을 비워 두는 건
      // 이 순서가 와도 실패한 리포트가 패널에 꽂히지 않게 하려는 방어다.
      const { feed } = startTurn();
      feed(
        { type: "meta", data: { lane: "analysis" } },
        { type: "report", data: report("실패한 턴") },
        { type: "error", data: { code: "INTERNAL", message: "x" } },
        { type: "done", data: { finishReason: "stop", panel: "replace" } },
      );
      expect(useChatStore.getState().analysisReport?.title).toBeUndefined();
    });

    it("done 없이 끊긴 턴의 리포트가 다음 턴으로 새지 않는다", () => {
      // 1턴: report 만 받고 done 이 오지 않음(스트림 중단)
      startTurn().feed(
        { type: "meta", data: { lane: "analysis" } },
        { type: "report", data: report("끊긴 턴") },
      );
      // 2턴: report 없이 token 연문으로만 답하고 done{replace}
      startTurn().feed(
        { type: "meta", data: { lane: "analysis" } },
        { type: "token", data: { text: "연문 답변" } },
        { type: "done", data: { finishReason: "stop", panel: "replace" } },
      );
      const panel = useChatStore.getState().analysisReport;
      expect(panel?.title).toBeUndefined();
      expect(panel?.body).toBe("연문 답변");
    });
  });

  describe("progress — 정리는 done·error 가 맡는다", () => {
    it("token 이 진행 표시를 지우지 않는다 — publishing 은 근거 token 뒤에 온다", () => {
      const { feed } = startTurn();
      feed(
        { type: "token", data: { text: "근거 " } },
        { type: "progress", data: { stage: "publishing" } },
        { type: "token", data: { text: "더" } },
      );
      expect(useChatStore.getState().progress).toBe("추천 목록을 준비하고 있어요");

      feed({ type: "done", data: { finishReason: "stop" } });
      expect(useChatStore.getState().progress).toBeNull();
    });

    it("모르는 stage(문구 없음)는 직전 진행 문구를 덮지 않는다", () => {
      const { feed } = startTurn();
      feed(
        { type: "progress", data: { stage: "searching" } },
        { type: "progress", data: { stage: "retrying" } },
      );
      expect(useChatStore.getState().progress).toBe("상품을 검색하고 있어요");
    });
  });

  describe("products.ready — 경로 B 조회", () => {
    it("단수 listId 로 와도 조회한다(AI 서버 과도기)", async () => {
      fetchChatListGroup.mockResolvedValue(group("단수"));
      const { feed, settle } = startTurn();
      feed({ type: "products.ready", data: { listId: "L1" } });
      await settle();

      expect(fetchChatListGroup).toHaveBeenCalledWith("L1");
      const [first] = useChatStore.getState().results;
      expect(first?.kind === "products" && first.groups[0].title).toBe("단수");
    });

    it("응답이 늦게 온 묶음도 listIds 순서를 지킨다", async () => {
      fetchChatListGroup.mockImplementation(
        (id) =>
          new Promise((resolve) =>
            setTimeout(() => resolve(group(id)), id === "A" ? 20 : 0),
          ),
      );
      const { feed, settle } = startTurn();
      feed({ type: "products.ready", data: { listIds: ["A", "B"] } });
      await settle();

      const [first] = useChatStore.getState().results;
      expect(
        first?.kind === "products" && first.groups.map((g) => g.title),
      ).toEqual(["A", "B"]);
    });

    it("하나도 못 가져오면 이전 턴 카드를 그대로 두고 안내만 붙인다", async () => {
      useChatStore
        .getState()
        .setResults([{ kind: "products", groups: [group("이전 턴")] }]);
      fetchChatListGroup.mockRejectedValue(new Error("404"));
      const { feed, settle } = startTurn();
      feed({ type: "products.ready", data: { listIds: ["X"] } });
      await settle();

      const [kept] = useChatStore.getState().results;
      expect(kept?.kind === "products" && kept.groups[0].title).toBe("이전 턴");
      expect(lastMessage().text).toContain("이전 결과를 그대로 두었어요");
      expect(lastMessage().error).toBeUndefined();
    });
  });

  it("턴의 첫 결과는 이전 턴 결과를 교체하고, 같은 턴의 다음 결과는 누적한다", () => {
    useChatStore
      .getState()
      .setResults([{ kind: "draft", draft: draft("update", "old") }]);
    const { feed } = startTurn();
    feed(
      { type: "draft", data: draft("update", "d1") },
      { type: "draft", data: draft("update", "d2") },
    );
    const ids = useChatStore
      .getState()
      .results.map((r) => (r.kind === "draft" ? r.draft.draftId : null));
    expect(ids).toEqual(["d1", "d2"]);
  });

  it("zero_result 인데 AI 안내가 없으면 기본 문구를 채운다", () => {
    startTurn().feed({ type: "done", data: { finishReason: "zero_result" } });
    expect(lastMessage().text).toContain("조건에 맞는 상품을 찾지 못했어요");
  });

  describe("action", () => {
    it("message 를 그대로 붙이고 채널 후처리를 부른다", () => {
      const onAction = vi.fn();
      const action = {
        type: "CART_ADDED",
        message: "담았어요",
        cartItemId: "1",
      } as const;
      startTurn({ onAction }).feed({ type: "action", data: action });

      expect(lastMessage().text).toBe("\n\n담았어요");
      expect(onAction).toHaveBeenCalledWith(action);
    });

    it("등록 성공은 productId 가 없는 create 초안을 확정하고 초안 모드를 푼다", () => {
      const { feed } = startTurn();
      feed({ type: "draft", data: draft("create", "c1") });
      expect(useChatStore.getState().activeDraft?.draftId).toBe("c1");

      feed({
        type: "action",
        data: { type: "PRODUCT_UPDATED", message: "등록했어요", productId: "77" },
      });
      const [card] = useChatStore.getState().results;
      expect(card?.kind === "draft" && card.settled?.type).toBe("PRODUCT_UPDATED");
      expect(useChatStore.getState().activeDraft).toBeNull();
    });
  });
});
