import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "./store";

/**
 * 등록 초안 모드(activeDraft) — 만료 타이머의 기준값 회귀 방지.
 *
 * 여기서 지키려는 것은 하나다: **수정 턴에서 만료 시각이 갱신된다.**
 * 갱신되지 않으면 첫 초안 기준 10분에 새 초안이 사라진다. 이 어긋남은
 * 10분 뒤에야 드러나 수동 테스트로는 거의 잡히지 않는다.
 */

const TTL_MS = 10 * 60_000;

describe("activeDraft", () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    vi.useRealTimers();
  });

  it("초안 진입 시 만료 시각을 10분 뒤로 잡는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T10:00:00Z"));

    useChatStore.getState().setActiveDraft("draft-A");

    const active = useChatStore.getState().activeDraft;
    expect(active?.draftId).toBe("draft-A");
    expect(active?.expiresAt).toBe(Date.now() + TTL_MS);
  });

  it("수정 턴에서 draftId 와 만료 시각이 함께 갱신된다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T10:00:00Z"));
    useChatStore.getState().setActiveDraft("draft-A");
    const first = useChatStore.getState().activeDraft;

    // 5분 뒤 수정 요청으로 새 초안이 온 상황
    vi.advanceTimersByTime(5 * 60_000);
    useChatStore.getState().setActiveDraft("draft-B");
    const second = useChatStore.getState().activeDraft;

    expect(second?.draftId).toBe("draft-B");
    // 새 초안 기준으로 다시 10분 — 첫 초안 시각을 물려받으면 5분 만에 죽는다
    expect(second!.expiresAt).toBe(first!.expiresAt + 5 * 60_000);
  });

  it("null 을 주면 초안 모드가 풀린다", () => {
    useChatStore.getState().setActiveDraft("draft-A");
    useChatStore.getState().setActiveDraft(null);
    expect(useChatStore.getState().activeDraft).toBeNull();
  });

  it("새 대화(reset)는 초안 모드도 비운다", () => {
    // 초안을 띄운 채 새 대화를 시작하면 서버 맥락이 끊긴다 —
    // 화면에만 초안 안내가 남아 있으면 판매자가 없는 초안을 고치려 든다.
    useChatStore.getState().setActiveDraft("draft-A");
    useChatStore.getState().reset();
    expect(useChatStore.getState().activeDraft).toBeNull();
  });
});
