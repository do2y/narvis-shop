"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/client";

/**
 * 429 RATE_LIMITED 차단 상태 (A-1·A-2, 2026-08-04).
 *
 * 로그인·가입은 IP당·계정당 두 축으로 세고(10분 창 / 계정 5회 · IP 30회) 어느 쪽이든
 * 넘으면 429가 나온다. 계정 잠금이 아니라 일시 차단이라 Retry-After 초가 지나면
 * 자동으로 풀린다 — 그래서 사용자를 영구히 막지 않고 남은 시간을 세어 보여준다.
 *
 * Retry-After가 없거나 파싱되지 않으면(명세는 항상 준다지만 프록시가 떼는 경우가 있다)
 * 카운트다운 없이 안내 문구만 남긴다 — 초를 모른다고 입력을 영영 막을 수는 없다.
 */
export function useRateLimit(error: unknown) {
  const isRateLimited = error instanceof ApiError && error.status === 429;
  const retryAfter = isRateLimited ? error.retryAfterSeconds : undefined;

  // 새 429 마다 타이머를 다시 잡기 위한 키. error 객체의 정체성이 재시도마다 바뀌므로
  // 같은 429 가 error 에 남아 있는 동안에는 유지되고, 새로 맞으면 이펙트가 다시 돈다.
  //
  // 남은 초는 state 로 들고 setInterval 이 줄인다 — 렌더 중 Date.now() 를 읽으면
  // 같은 입력에 다른 결과가 나와(순수성 위반) 렌더가 불안정해진다.
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!isRateLimited || !retryAfter) {
      // 이펙트 본문에서 곧바로 setState 하지 않는다(cascading render).
      // 차단이 아닌 상태의 남은 초는 항상 0이므로 다음 틱에 접어도 늦지 않다.
      const clear = setTimeout(() => setRemaining(0), 0);
      return () => clearTimeout(clear);
    }

    const start = setTimeout(() => setRemaining(retryAfter), 0);
    const timer = setInterval(() => {
      setRemaining((prev) => {
        // 0 에 닿으면 타이머를 멈춘다 — 차단이 풀린 뒤에도 1초마다 리렌더가 도는 걸 막는다.
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [error, isRateLimited, retryAfter]);

  return {
    // 남은 초를 아는 동안만 제출을 막는다. 초를 모르면 서버가 다시 429로 거절할 뿐이라
    // 입력을 잠그는 것보다 한 번 더 시도하게 두는 편이 덜 답답하다.
    blocked: remaining > 0,
    remaining,
  };
}

// "잠시 후" 대신 남은 시간을 말해준다 — 10분 창이라 막연히 기다리라고 하면
// 사용자가 계속 눌러보고, 그 시도가 다시 카운터를 올린다.
export function formatRetryAfter(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}분`;
  }
  return `${seconds}초`;
}
