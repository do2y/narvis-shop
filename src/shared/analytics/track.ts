import { sendWithAuthRetry } from "./retry";
import { getSessionKey } from "./sessionKey";
import {
  EVENT_SCHEMA_VERSION,
  type BehaviorEvent,
  type BehaviorEventType,
  type EventProperties,
  type EventRecommendation,
} from "./types";

// 행동 이벤트 배치 전송 (E-1). 버퍼 10건 or 5초 — 명세 값.
// 수집은 부가 기능이므로 어떤 실패도 앱 동작을 막지 않는다(전부 무시하고 진행).

const FLUSH_SIZE = 10;
const FLUSH_MS = 5000;
/**
 * 배치 상한. 초과하면 서버가 400 으로 **배치 전체를 버리므로** 나눠 보낸다.
 * 평시엔 FLUSH_SIZE(10)에서 나가지만, 오프라인·백그라운드로 큐가 밀렸다가
 * 한꺼번에 flush 될 때 넘길 수 있다.
 */
const MAX_BATCH = 100;
const ENDPOINT = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api/events`;

let queue: BehaviorEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function send(events: BehaviorEvent[]) {
  if (events.length === 0) return;

  // 인증은 선택(JWT 있으면 서버가 검증). member_id·guest_id는 서버가 JWT·쿠키에서
  // 주입하므로 body에 신원을 넣지 않는다(위조 방지, 명세 ①).
  // api 인스턴스를 쓰지 않는 이유: 202 무본문 응답이라 봉투 언래핑이 불필요하고,
  // 401이 나도 로그인 리다이렉트를 타면 안 되기 때문(수집은 배경 작업이다).
  const post = async (): Promise<number | null> => {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ events }),
        keepalive: true, // 탭 종료 중에도 전송 보장
      });
      return res.status;
    } catch {
      // 네트워크 오류 — 서버가 받았는지 알 수 없다. 아래에서 재전송 대상이 아니다.
      return null;
    }
  };

  // 수집 실패는 삼킨다 — **401 하나만 예외다.**
  //
  // 일반 재시도를 넣지 않는 판단은 그대로다(재시도하면 중복·부하만 는다). 401 만
  // 가르는 이유는 성질이 다르기 때문이다: 서버가 요청을 받고 명시적으로 거부한
  // 것이라 적재가 안 됐음이 확실하고, AT 재발급이라는 고칠 방법이 있다.
  // 반면 5xx·네트워크 오류는 서버가 받았는지조차 모른다.
  //
  // ⚠️ 이 예외를 5xx 로 넓히지 말 것 — 그러면 위 판단이 말한 중복·부하가 실제로 생긴다.
  //
  // 방치하면 AT 만료 구간(수명 30분)의 배치가 통째로 사라진다. 전송 전에 큐를
  // 비우므로 잃으면 복구 경로가 없고, 활발한 사용자일수록 많이 잃는다.
  void sendWithAuthRetry(post);
}

function flush() {
  clearTimer();
  const batch = queue;
  queue = [];
  // 100건 초과는 배치 전체가 거부되므로 나눠 보낸다
  for (let i = 0; i < batch.length; i += MAX_BATCH) {
    send(batch.slice(i, i + MAX_BATCH));
  }
}

export function track(
  eventType: BehaviorEventType,
  payload?: {
    productId?: string;
    properties?: EventProperties;
    /** 추천에서 비롯된 이벤트에만 — 서버가 listId 로 지면·순위를 도출해 붙인다 */
    recommendation?: EventRecommendation;
  },
) {
  const { sessionKey } = getSessionKey();

  queue.push({
    id: crypto.randomUUID(),
    schemaVersion: EVENT_SCHEMA_VERSION,
    sessionKey,
    eventType,
    ...(payload?.productId !== undefined ? { productId: payload.productId } : {}),
    ...(payload?.recommendation ? { recommendation: payload.recommendation } : {}),
    ...(payload?.properties ? { properties: payload.properties } : {}),
    // UTC(Z) 고정 — 오프셋 없는 로컬 시각을 보내면 서버가 어긋난 줄도 모른 채 저장한다(명세 E-1)
    occurredAt: new Date().toISOString(),
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
