import { ApiError } from "@/shared/api/client";
import { StreamStartError } from "@/shared/chat/streamChat";

/**
 * 중단(abort) 판정 — 사용자가 스스로 끊은 것이라 오류로 표시하지 않는다.
 *
 * 이름으로 보는 이유: fetch 중단은 DOMException("AbortError")로 오지만 axios 경로는
 * CanceledError 로 오고, jsdom·polyfill 환경에서는 DOMException 생성자가 다를 수 있어
 * instanceof 가 어긋난다. 이름은 세 경우 모두에서 안정적이다.
 */
export function isAbortError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === "AbortError" || name === "CanceledError";
}

/**
 * 세션 축출(404) 판정 — 출처가 둘이라 타입도 둘이다.
 * 스트림 fetch 는 StreamStartError(status), 티켓 재발급은 ApiError(code/status).
 */
export function isNotFound(err: unknown): boolean {
  if (err instanceof StreamStartError) return err.status === 404;
  if (err instanceof ApiError) {
    return err.status === 404 || err.code === "SESSION_NOT_FOUND";
  }
  return false;
}

/**
 * 스트림 시작 전 거부를 사용자 안내로 옮긴다(계약 CH-2 §실패 응답).
 * 상태별로 재시도가 의미 있는지가 달라 retryable 을 함께 정한다.
 */
export function describeStreamStartError(err: StreamStartError): {
  message: string;
  retryable: boolean;
} {
  switch (err.status) {
    case 403:
      // 티켓은 유효하나 scope 불일치(예: 판매자 티켓으로 구매자 스트림).
      // 같은 티켓으로 다시 걸어도 결과가 같다.
      return {
        message: "이 대화를 열 권한이 없어요. 새로고침 후 다시 시도해 주세요.",
        retryable: false,
      };
    case 409:
      // STREAM_IN_PROGRESS — 같은 방에 활성 스트림이 있다.
      // 진행 중인 응답이 끝나야 풀리므로 즉시 재시도는 또 409 다.
      return {
        message: "다른 대화가 진행 중이에요. 잠시 후 다시 시도해 주세요.",
        retryable: false,
      };
    case 429:
      // RATE_LIMITED — 재시도 버튼을 주면 사용자가 눌러 상황을 더 악화시킨다.
      return {
        message: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
        retryable: false,
      };
    case 504:
      // UPSTREAM_TIMEOUT(first-token) — 일시적이라 재시도가 유효하다.
      return {
        message: "응답이 지연되고 있어요. 다시 시도해 주세요.",
        retryable: true,
      };
    default:
      return {
        message: "응답을 받지 못했어요. 다시 시도해 주세요.",
        retryable: true,
      };
  }
}
