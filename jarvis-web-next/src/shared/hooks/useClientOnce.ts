"use client";

import { useRef, useSyncExternalStore } from "react";

// 구독자가 없는 스냅샷 — 값이 마운트 후 한 번만 결정되면 되므로 변경 알림이 필요 없다.
const noopSubscribe = () => () => {};
const serverSnapshot = () => null;

/**
 * 브라우저에서만 읽을 수 있는 값(sessionStorage·location 등)을 하이드레이션 안전하게 가져온다.
 *
 * 서버 렌더와 하이드레이션 첫 패스에서는 `null`, 그 뒤로는 read()의 결과를 준다.
 * `useEffect` + `setState`와 결과는 같지만 연쇄 렌더를 만들지 않는다.
 *
 * read는 **최초 1회만** 실행하고 결과를 고정한다. useSyncExternalStore의 getSnapshot은
 * 호출마다 동일 참조를 돌려줘야 하는데, JSON.parse처럼 매번 새 객체를 만드는 read를
 * 그대로 쓰면 무한 렌더가 된다. 이 훅이 쓰이는 값(페이지 진입 시 전달된 state,
 * 최초 쿼리스트링)은 모두 "한 번 읽고 끝"이라 이 고정이 의도한 동작이다.
 */
export function useClientValue<T>(read: () => T): T | null {
  const cache = useRef<{ value: T } | null>(null);

  return useSyncExternalStore(
    noopSubscribe,
    () => {
      cache.current ??= { value: read() };
      return cache.current.value;
    },
    serverSnapshot,
  );
}
