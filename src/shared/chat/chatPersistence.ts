"use client";

import type { ChatMessage } from "./store";
import type { ChatResult } from "@/shared/types/chat";

/**
 * 대화를 탭 단위로 살려 두는 곳(sessionStorage).
 *
 * 새로고침·탭 복구(Ctrl+Shift+T)로 대화가 돌아오고, 탭을 완전히 닫으면 사라진다.
 * 저장 범위를 탭으로 잡은 이유: 서버 맥락 TTL 이 10분(sliding)이라 그보다 오래 남겨 두면
 * 화면엔 대화가 있는데 AI 는 기억하지 못하는 어긋난 상태가 길어진다. 탭 수명이
 * 세션 수명과 대체로 겹쳐 그 간극이 가장 작다.
 *
 * 로그인 왕복(CH-7 승계)도 같은 저장소를 쓴다 — 저장 주체가 둘이면 서로 덮어써서
 * 대화가 유실된다. 승계는 여기 담긴 sessionId 로 이뤄진다.
 */

const KEY = "chat:session";

export interface PersistedChat {
  messages: ChatMessage[];
  /** 서버 세션 — 승계(CH-7)와 맥락 연결의 키. 발급 전이면 null */
  sessionId: string | null;
  /** 우측 패널 카드(추천 목록 등). 없으면 빈 배열 */
  results: ChatResult[];
  /**
   * 승계에 실패한 게스트 sessionId — 재시도 대상.
   *
   * sessionId 와 따로 두는 이유: 승계 실패 시 sessionId 는 null 로 비워야 하지만
   * (구 게스트 티켓으로 스트림을 열면 AI 가 403 으로 막는다) 재시도하려면 그 값을
   * 알아야 한다. 여기 남겨 두면 새로고침 후에도 배너와 재시도가 살아남는다.
   */
  claimFailedSessionId?: string | null;
}

/**
 * 대화를 저장한다. 빈 대화는 저장하지 않는다 — 빈 값을 써 두면 다른 탭에서 시작한
 * 대화를 이 탭이 덮어쓸 여지가 생긴다.
 */
export function saveChat(chat: PersistedChat): void {
  if (typeof window === "undefined") return;
  if (!chat.messages.length) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(chat));
  } catch {
    // 저장소 차단(프라이버시 모드)·용량 초과 — 복원만 못 하고 대화는 정상 진행된다
  }
}

/**
 * 저장된 대화를 읽는다. 지우지 않는다 — 새로고침이 반복돼도 계속 복원돼야 한다.
 * (로그인 왕복 한 번만 쓰던 종전 동작과 달라진 점이다.)
 */
export function loadChat(): PersistedChat | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedChat;
    // 형태가 깨졌으면(구버전 키·수동 편집) 없는 것으로 친다
    if (!Array.isArray(parsed.messages)) return null;
    return {
      messages: parsed.messages,
      sessionId: parsed.sessionId ?? null,
      results: Array.isArray(parsed.results) ? parsed.results : [],
      claimFailedSessionId: parsed.claimFailedSessionId ?? null,
    };
  } catch {
    clearChat();
    return null;
  }
}

/** "새 대화" 등 명시적으로 비울 때. */
export function clearChat(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 무시 — 다음 저장에서 덮어쓴다
  }
}
