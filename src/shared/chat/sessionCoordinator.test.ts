import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatSession } from "@/shared/types/chat";

// API 호출은 전부 가짜로 바꾼다 — 여기서 검증할 것은 캐시·락·방송 규칙이지
// 서버 왕복이 아니다. (vi.mock 은 import 보다 먼저 끌어올려진다)
vi.mock("./sessions", () => ({
  openChatSession: vi.fn(),
  openSellerSession: vi.fn(),
  reissueTicket: vi.fn(),
  claimChatSession: vi.fn(),
}));

import {
  claimSession,
  clearCachedSession,
  ensureSession,
  SessionClaimPendingError,
  subscribeOwnershipChange,
} from "./sessionCoordinator";
import { claimChatSession, openChatSession, reissueTicket } from "./sessions";

const CACHE_KEY = "jarvis:chat:session:SHOPPING";

function session(id: string, ticket = "t"): ChatSession {
  return {
    sessionId: id,
    ttlSeconds: 600,
    streamTicket: ticket,
    ticketTtlSeconds: 60,
    llmSseUrl: "http://ai.test/chat",
  };
}

/** 다른 탭이 캐시에 심어 둔 상태를 흉내 낸다(localStorage 는 탭 간 공유). */
function seedCache(s: ChatSession, storedAt = Date.now()) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ session: s, storedAt }));
}

function readCacheRaw(): { session: ChatSession } | null {
  const raw = localStorage.getItem(CACHE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe("sessionCoordinator", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(openChatSession).mockReset();
    vi.mocked(reissueTicket).mockReset();
    vi.mocked(claimChatSession).mockReset();
  });

  describe("ensureSession — 탭 간 세션 공유", () => {
    it("신선한 캐시가 있으면 서버를 부르지 않는다(탭 N개가 CH-1을 중복 호출하지 않게)", async () => {
      seedCache(session("s1"));

      const got = await ensureSession("SHOPPING");

      expect(got.sessionId).toBe("s1");
      expect(openChatSession).not.toHaveBeenCalled();
    });

    it("캐시가 없으면 발급하고, 그 결과를 다른 탭이 보도록 저장한다", async () => {
      vi.mocked(openChatSession).mockResolvedValue(session("new"));

      const got = await ensureSession("SHOPPING");

      expect(got.sessionId).toBe("new");
      expect(readCacheRaw()?.session.sessionId).toBe("new");
    });

    it("티켓이 오래됐으면(TTL 초과) 재사용하지 않고 재발급한다", async () => {
      // 티켓 TTL 은 30~60초라 캐시는 25초로 잡혀 있다
      seedCache(session("old"), Date.now() - 30_000);
      vi.mocked(reissueTicket).mockResolvedValue(session("old", "fresh"));

      const got = await ensureSession("SHOPPING", "old");

      expect(reissueTicket).toHaveBeenCalledWith("old");
      expect(got.streamTicket).toBe("fresh");
    });

    /**
     * 승계 실패가 미해결인 동안은 새 세션을 만들지 않는다.
     * 조용히 만들면 화면엔 이전 대화가 있는데 AI 는 기억 못 하는 어긋남이 생긴다.
     */
    it("allowCreate=false 면 폴백 대신 SessionClaimPendingError 를 던진다", async () => {
      await expect(
        ensureSession("SHOPPING", null, false),
      ).rejects.toBeInstanceOf(SessionClaimPendingError);
      expect(openChatSession).not.toHaveBeenCalled();
    });

    it("allowCreate=false 면 만료된 세션(404)도 새로 만들지 않는다", async () => {
      vi.mocked(reissueTicket).mockRejectedValue({ code: "SESSION_NOT_FOUND" });

      await expect(
        ensureSession("SHOPPING", "dead", false),
      ).rejects.toBeInstanceOf(SessionClaimPendingError);
      expect(openChatSession).not.toHaveBeenCalled();
    });

    it("평소에는 만료된 세션(404)을 새 세션으로 폴백한다", async () => {
      vi.mocked(reissueTicket).mockRejectedValue({ code: "SESSION_NOT_FOUND" });
      vi.mocked(openChatSession).mockResolvedValue(session("fresh"));

      const got = await ensureSession("SHOPPING", "dead");

      expect(got.sessionId).toBe("fresh");
    });
  });

  describe("claimSession — 로그인 승계", () => {
    it("승계 결과를 캐시에 심어 다른 탭도 회원 티켓을 쓰게 한다", async () => {
      seedCache(session("s1", "guest-ticket"));
      vi.mocked(claimChatSession).mockResolvedValue(
        session("s1", "member-ticket"),
      );

      await claimSession("SHOPPING", "s1");

      expect(readCacheRaw()?.session.streamTicket).toBe("member-ticket");
    });

    it("실패는 그대로 던진다 — 호출부가 code 로 분기해야 한다", async () => {
      vi.mocked(claimChatSession).mockRejectedValue({
        code: "SESSION_FORBIDDEN",
      });

      await expect(claimSession("SHOPPING", "s1")).rejects.toMatchObject({
        code: "SESSION_FORBIDDEN",
      });
    });
  });

  /**
   * 다른 탭이 로그인하면 이 탭의 게스트 티켓은 무효가 된다(AI 가 403 으로 막는다).
   * 방송을 받아 캐시를 비워 두면 다음 전송이 회원 신원으로 재발급받아 통과한다.
   */
  describe("subscribeOwnershipChange — 낡은 게스트 티켓 폐기", () => {
    /** 다른 탭의 방송을 흉내 낸다(BroadcastChannel 은 보낸 탭 자신에게 전달하지 않는다). */
    function broadcastOwnership(sessionId: string, channel = "SHOPPING") {
      const bc = new BroadcastChannel("jarvis:chat");
      bc.postMessage({ type: "ownership", channel, sessionId });
      bc.close();
      // 이벤트 전달은 마이크로태스크 뒤에 일어난다
      return new Promise((r) => setTimeout(r, 0));
    }

    it("구 게스트 티켓(다른 세션)이면 캐시를 버린다", async () => {
      seedCache(session("guest-session"));
      const unsubscribe = subscribeOwnershipChange("SHOPPING");

      await broadcastOwnership("member-session");

      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
      unsubscribe();
    });

    /**
     * claim 한 탭이 회원 티켓을 먼저 심으므로(publish → ownership 순서),
     * 무조건 비우면 방금 심긴 유효한 티켓까지 날려 재발급이 한 번 더 난다.
     */
    it("이미 승계된 세션이면 그대로 둔다 — 방금 심긴 회원 티켓을 지우지 않게", async () => {
      seedCache(session("member-session", "member-ticket"));
      const unsubscribe = subscribeOwnershipChange("SHOPPING");

      await broadcastOwnership("member-session");

      expect(readCacheRaw()?.session.streamTicket).toBe("member-ticket");
      unsubscribe();
    });

    it("다른 채널의 방송은 무시한다 — 구매자·판매자는 서로 다른 접속이다", async () => {
      seedCache(session("guest-session"));
      const unsubscribe = subscribeOwnershipChange("SHOPPING");

      await broadcastOwnership("member-session", "SELLER");

      expect(readCacheRaw()?.session.sessionId).toBe("guest-session");
      unsubscribe();
    });

    it("구독을 해제하면 더는 반응하지 않는다", async () => {
      seedCache(session("guest-session"));
      const unsubscribe = subscribeOwnershipChange("SHOPPING");
      unsubscribe();

      await broadcastOwnership("member-session");

      expect(readCacheRaw()?.session.sessionId).toBe("guest-session");
    });
  });

  it("clearCachedSession 은 그 채널만 비운다", () => {
    seedCache(session("s1"));
    localStorage.setItem("jarvis:chat:session:SELLER", "keep");

    clearCachedSession("SHOPPING");

    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    expect(localStorage.getItem("jarvis:chat:session:SELLER")).toBe("keep");
  });
});
