"use client";

import type { ChatMessage } from "./store";

/**
 * 로그인 왕복 동안 대화를 맡아 두는 곳.
 *
 * 채팅 스토어는 persist 하지 않는다 — 새로고침 소실이 의도된 동작이다(CLAUDE.md).
 * 그 원칙을 깨지 않으면서 로그인만 예외로 두기 위해, 화면을 떠나기 직전에 명시적으로
 * 맡기고 돌아와서 되찾은 뒤 즉시 지운다. 새로고침으로는 저장되지 않으므로
 * "자리를 비우면 초기화된다"는 성질은 그대로다.
 *
 * 서버 쪽 맥락은 CH-7 승계가 잇는다(sessionId 유지) — 여기서 나르는 건 화면의 말풍선뿐이다.
 * 둘이 짝이라 승계에 실패하면 복원해도 AI 는 이전 대화를 모른다.
 */

const KEY = "chat:handoff";

interface ChatHandoff {
  messages: ChatMessage[];
  /** 맡길 당시의 세션 — 승계 대상. 스토어가 비워져도 이 값으로 CH-7 을 부른다. */
  sessionId: string | null;
}

/** 로그인하러 떠나기 직전 호출. 대화가 없으면 맡기지 않는다. */
export function saveChatForLogin(handoff: ChatHandoff): void {
  if (typeof window === "undefined") return;
  if (!handoff.messages.length) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(handoff));
  } catch {
    // 저장소 차단·용량 초과 — 대화 복원만 못 하고 로그인은 정상 진행된다
  }
}

/**
 * 돌아와서 되찾는다. **읽는 즉시 지운다** — 한 번의 로그인 왕복에만 쓰는 값이라
 * 남겨 두면 나중에 채팅에 들어왔을 때 옛 대화가 되살아난다(결제 handoff 에서 겪은 문제).
 */
export function takeChatAfterLogin(): ChatHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as ChatHandoff;
  } catch {
    clearChatHandoff();
    return null;
  }
}

/** 로그인을 포기하고 돌아온 경우 등 — 남은 값을 정리한다. */
export function clearChatHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 무시 — 다음 저장 때 덮어쓴다
  }
}
