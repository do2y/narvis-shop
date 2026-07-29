"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * react-router의 `const [params, setParams] = useSearchParams()` 대체.
 *
 * Next의 `useSearchParams()`는 읽기 전용 단일 값이라 쓰기 경로가 없다.
 * 원본과 같은 사용감을 유지하려고 [읽기, 쓰기] 튜플로 맞춘다.
 *
 * 쓰기는 **네이티브 History API**로 한다 — Next 문서가 "목록 필터·정렬"을 이 방식으로
 * 안내한다. `router.push`는 페이지 이동(서버 라운드트립)이라 화면 내 필터 갱신에는
 * 주소창이 즉시 반영되지 않는다(2026-07-28 브랜드 정렬에서 실제로 겪음).
 * pushState/replaceState는 Next 라우터와 통합되어 useSearchParams가 갱신되고
 * 뒤로가기도 정상 동작한다. 스크롤도 건드리지 않아 원본 setSearchParams와 같다.
 */
export function useQueryParams(): [
  URLSearchParams,
  (next: URLSearchParams, options?: { replace?: boolean }) => void,
] {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const setParams = useCallback(
    (next: URLSearchParams, options?: { replace?: boolean }) => {
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (options?.replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    },
    [pathname],
  );

  // 호출부가 params를 직접 set한 뒤 넘기는 패턴(원본)을 지원하려면 사본이어야 한다 —
  // Next가 주는 인스턴스는 읽기 전용이라 set 시 런타임 에러가 난다.
  return [new URLSearchParams(searchParams.toString()), setParams];
}
