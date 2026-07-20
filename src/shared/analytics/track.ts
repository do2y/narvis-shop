import { getSessionKey } from "./sessionKey";
import type { BehaviorEvent, BehaviorEventType, EventProperties } from "./types";

// 행동 이벤트 배치 전송 (E-1). 버퍼 10건 or 5초 — 명세 값.
// 수집은 부가 기능이므로 어떤 실패도 앱 동작을 막지 않는다(전부 무시하고 진행).

const FLUSH_SIZE = 10;
const FLUSH_MS = 5000;
const ENDPOINT = `${import.meta.env.VITE_API_BASE_URL}/api/events`;

let queue: BehaviorEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

// 로컬 시각 "2026-07-17T10:00:00" — 명세 예시가 오프셋 없는 형태라 맞춘다.
function localIsoNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function send(events: BehaviorEvent[]) {
  if (events.length === 0) return;
  // 인증은 선택(JWT 있으면 서버가 검증). member_id·guest_id는 서버가 JWT·쿠키에서
  // 주입하므로 body에 신원을 넣지 않는다(위조 방지, 명세 ①).
  // api 인스턴스를 쓰지 않는 이유: 202 무본문 응답이라 봉투 언래핑이 불필요하고,
  // 401이 나도 refresh·로그인 리다이렉트를 타면 안 되기 때문.
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ events }),
    keepalive: true, // 탭 종료 중에도 전송 보장
  }).catch(() => {
    // 수집 실패는 삼킨다 — 재시도하면 중복·부하만 는다(서버가 UNIQUE로 막긴 하지만)
  });
}

export function flush() {
  clearTimer();
  const batch = queue;
  queue = [];
  send(batch);
}

export function track(
  eventType: BehaviorEventType,
  payload?: { productId?: number; properties?: EventProperties },
) {
  const { sessionKey } = getSessionKey();

  queue.push({
    id: crypto.randomUUID(),
    sessionKey,
    eventType,
    ...(payload?.productId !== undefined ? { productId: payload.productId } : {}),
    ...(payload?.properties ? { properties: payload.properties } : {}),
    occurredAt: localIsoNow(),
  });

  if (queue.length >= FLUSH_SIZE) {
    flush();
    return;
  }
  timer ??= setTimeout(flush, FLUSH_MS);
}

/**
 * 앱 시작 시 1회. session_start는 sessionKey가 새로 발급됐을 때만 쏜다
 * (새로고침·재방문마다 쏘면 세션 수가 부풀려짐).
 */
export function initAnalytics() {
  const { isNew } = getSessionKey();
  if (isNew) track("session_start");

  // 탭 종료·백그라운드 전환 시 남은 큐 전송. pagehide는 모바일 사파리 대응.
  // visibilitychange는 탭 전환마다 불리지만 큐가 비어 있으면 no-op이라 무해.
  const flushOnLeave = () => flush();
  window.addEventListener("pagehide", flushOnLeave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnLeave();
  });
}
