import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatSession } from "@/shared/types/chat";

vi.mock("./sessionCoordinator", () => ({
  claimSession: vi.fn(),
  clearCachedSession: vi.fn(),
}));

import {
  claimChatSessionAfterLogin,
  dismissClaimFailure,
  retryClaimChatSession,
} from "./claimOnLogin";
import { loadChat, saveChat } from "./chatPersistence";
import { claimSession } from "./sessionCoordinator";
import { useChatStore } from "./store";

function session(id: string): ChatSession {
  return {
    sessionId: id,
    ttlSeconds: 600,
    streamTicket: "t",
    ticketTtlSeconds: 60,
    llmSseUrl: "http://ai.test/chat",
  };
}

/** 로그인 직전 상태 — 게스트로 대화하다 세션을 발급받은 탭. */
function seedGuestChat(sessionId: string | null = "guest-1") {
  saveChat({
    messages: [{ id: "1", role: "user", text: "안녕" }],
    sessionId,
    results: [],
  });
  useChatStore.getState().setSessionId(sessionId);
}

describe("claimOnLogin", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    useChatStore.getState().reset();
    vi.mocked(claimSession).mockReset();
  });

  describe("로그인 직후 승계", () => {
    it("성공하면 같은 sessionId 로 대화가 이어진다", async () => {
      seedGuestChat("guest-1");
      vi.mocked(claimSession).mockResolvedValue(session("guest-1"));

      await claimChatSessionAfterLogin("SHOPPING");

      expect(useChatStore.getState().sessionId).toBe("guest-1");
      expect(useChatStore.getState().claimFailure).toBeNull();
    });

    it("맡겨 둔 대화가 없으면 승계를 시도하지 않는다", async () => {
      // 상세페이지 등에서 로그인한 경우 — 모든 로그인에 대화를 귀속시키지 않는다
      await claimChatSessionAfterLogin("SHOPPING");
      expect(claimSession).not.toHaveBeenCalled();
    });

    /**
     * 실패 처리를 err instanceof ApiError 로 좁혔더니 응답 자체가 없는 실패
     * (네트워크 단절·타임아웃)가 걸리지 않아 배너 없이 조용히 넘어갔다.
     * 없애려던 "조용한 실패"가 그 경로로 남아 있던 것 — 종류로 거르지 않는다.
     */
    it("응답 없는 실패(네트워크 단절)도 배너로 알린다", async () => {
      seedGuestChat("guest-1");
      vi.mocked(claimSession).mockRejectedValue(new Error("Network Error"));

      await claimChatSessionAfterLogin("SHOPPING");

      expect(useChatStore.getState().claimFailure).toMatchObject({
        sessionId: "guest-1",
        retrying: false,
      });
    });

    it("서버가 코드로 거절한 실패도 배너로 알린다", async () => {
      seedGuestChat("guest-1");
      vi.mocked(claimSession).mockRejectedValue({ code: "SESSION_FORBIDDEN" });

      await claimChatSessionAfterLogin("SHOPPING");

      expect(useChatStore.getState().claimFailure).not.toBeNull();
    });

    it("실패해도 말풍선은 남긴다 — 로그인했더니 대화가 사라지면 안 된다", async () => {
      seedGuestChat("guest-1");
      vi.mocked(claimSession).mockRejectedValue(new Error("boom"));

      await claimChatSessionAfterLogin("SHOPPING");

      expect(loadChat()?.messages).toHaveLength(1);
    });

    it("실패 시 sessionId 는 비우되 재시도 대상은 저장소에 남긴다", async () => {
      seedGuestChat("guest-1");
      vi.mocked(claimSession).mockRejectedValue(new Error("boom"));

      await claimChatSessionAfterLogin("SHOPPING");

      // 구 게스트 티켓으로 스트림을 열면 AI 가 403 으로 막으므로 sessionId 는 null,
      // 그래도 재시도하려면 그 값을 알아야 하므로 별도 필드로 살려 둔다
      expect(useChatStore.getState().sessionId).toBeNull();
      expect(loadChat()?.sessionId).toBeNull();
      expect(loadChat()?.claimFailedSessionId).toBe("guest-1");
    });
  });

  describe("재시도", () => {
    async function failFirst() {
      seedGuestChat("guest-1");
      vi.mocked(claimSession).mockRejectedValue(new Error("boom"));
      await claimChatSessionAfterLogin("SHOPPING");
      vi.mocked(claimSession).mockReset();
    }

    it("성공하면 배너가 사라지고 세션이 되살아난다", async () => {
      await failFirst();
      vi.mocked(claimSession).mockResolvedValue(session("guest-1"));

      const ok = await retryClaimChatSession("SHOPPING");

      expect(ok).toBe(true);
      expect(useChatStore.getState().claimFailure).toBeNull();
      expect(useChatStore.getState().sessionId).toBe("guest-1");
      expect(loadChat()?.claimFailedSessionId).toBeNull();
    });

    it("또 실패해도 배너를 유지해 다시 누를 수 있게 한다", async () => {
      await failFirst();
      vi.mocked(claimSession).mockRejectedValue(new Error("again"));

      const ok = await retryClaimChatSession("SHOPPING");

      expect(ok).toBe(false);
      expect(useChatStore.getState().claimFailure).toMatchObject({
        retrying: false,
      });
    });

    it("재시도 중에는 중복 요청하지 않는다(버튼 연타 방어)", async () => {
      await failFirst();
      vi.mocked(claimSession).mockImplementation(
        () => new Promise(() => {}), // 끝나지 않는 요청
      );

      const first = retryClaimChatSession("SHOPPING");
      await retryClaimChatSession("SHOPPING"); // 두 번째는 즉시 반환돼야 한다

      expect(claimSession).toHaveBeenCalledTimes(1);
      void first;
    });

    it("승계 실패 상태가 아니면 아무 일도 하지 않는다", async () => {
      expect(await retryClaimChatSession("SHOPPING")).toBe(false);
      expect(claimSession).not.toHaveBeenCalled();
    });
  });

  /**
   * 막으려던 건 "조용히 맥락이 끊기는 것"이지 사용자의 선택이 아니다 —
   * 알고 고른다면 맥락 없이 계속하는 것도 정당한 선택이라 길을 열어 둔다.
   */
  describe("기억 없이 계속", () => {
    it("배너만 걷고 대화는 남긴다", async () => {
      seedGuestChat("guest-1");
      vi.mocked(claimSession).mockRejectedValue(new Error("boom"));
      await claimChatSessionAfterLogin("SHOPPING");

      dismissClaimFailure();

      expect(useChatStore.getState().claimFailure).toBeNull();
      expect(loadChat()?.messages).toHaveLength(1);
    });

    it("저장소의 재시도 대상도 비운다 — 새로고침에 배너가 되살아나지 않게", async () => {
      seedGuestChat("guest-1");
      vi.mocked(claimSession).mockRejectedValue(new Error("boom"));
      await claimChatSessionAfterLogin("SHOPPING");

      dismissClaimFailure();

      expect(loadChat()?.claimFailedSessionId).toBeNull();
    });
  });
});
