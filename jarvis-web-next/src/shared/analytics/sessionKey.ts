// sessionKey — FE가 localStorage로 관리, 30분 무활동 시 재발급 (E-1 명세).
// 백엔드가 쿠키에서 읽는 guest_id, 채팅용 jarvis-guest-id와는 별개 축이다.
// (guest_id=게스트 신원 / sessionKey=방문 세션 묶음)

const KEY = "jarvis-session-key";
const TOUCHED_KEY = "jarvis-session-touched";
const IDLE_MS = 30 * 60 * 1000;

// 재발급이 일어났는지 알려준다 — 호출부가 session_start를 쏠지 판단하는 근거.
export interface SessionKeyResult {
  sessionKey: string;
  isNew: boolean;
}

export function getSessionKey(): SessionKeyResult {
  const now = Date.now();

  let stored: string | null = null;
  let touched = 0;
  try {
    stored = localStorage.getItem(KEY);
    touched = Number(localStorage.getItem(TOUCHED_KEY)) || 0;
  } catch {
    // 사파리 프라이빗 모드 등 localStorage 차단 — 세션 단위 추적만 포기하고 진행
  }

  const expired = now - touched > IDLE_MS;
  const sessionKey = stored && !expired ? stored : crypto.randomUUID();
  const isNew = sessionKey !== stored;

  try {
    localStorage.setItem(KEY, sessionKey);
    localStorage.setItem(TOUCHED_KEY, String(now));
  } catch {
    // 위와 동일 — 저장 실패해도 이번 이벤트는 그대로 전송한다
  }

  return { sessionKey, isNew };
}
