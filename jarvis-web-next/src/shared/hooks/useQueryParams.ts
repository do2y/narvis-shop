"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * react-router의 `const [params, setParams] = useSearchParams()` 대체.
 *
 * Next의 `useSearchParams()`는 읽기 전용 단일 값이라 쓰기 경로가 없다.
 * 원본과 같은 사용감을 유지하려고 [읽기, 쓰기] 튜플로 맞춘다.
 *
 * 쓰기는 `router.replace/push`로 수행한다. scroll:false — 원본 setSearchParams는
 * 스크롤을 건드리지 않으므로 동작을 맞춘다(필터 변경 시 위치 유지).
 */
export function useQueryParams(): [
  URLSearchParams,
  (next: URLSearchParams, options?: { replace?: boolean }) => void,
] {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const setParams = useCallback(
    (next: URLSearchParams, options?: { replace?: boolean }) => {
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (options?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, router],
  );

  // 호출부가 params를 직접 set한 뒤 넘기는 패턴(원본)을 지원하려면 사본이어야 한다 —
  // Next가 주는 인스턴스는 읽기 전용이라 set 시 런타임 에러가 난다.
  return [new URLSearchParams(searchParams.toString()), setParams];
}
