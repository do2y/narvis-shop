"use client";

import { useSyncExternalStore } from "react";

/**
 * `prefers-reduced-motion` 구독.
 *
 * CSS의 `motion-reduce:` 유틸리티로 끄지 못하는 것이 하나 있다 — **JS 타이머로
 * 도는 자동 데모**다. CSS는 이미 그려진 프레임의 움직임만 줄일 수 있고, "장면을
 * 순서대로 진행시키는 setTimeout" 자체는 멈추지 못한다. 그래서 데모 시퀀서는
 * 이 값을 읽어 아예 마지막(완성) 장면으로 건너뛴다.
 *
 * `useState + useEffect` 대신 `useSyncExternalStore`를 쓴다. 브라우저 설정은
 * React 바깥의 상태이고, 이 훅이 정확히 그것을 구독하기 위한 도구다. 이펙트로
 * 하면 첫 렌더가 항상 "모션 있음"으로 나갔다가 한 프레임 뒤 정정되는데,
 * 그 사이에 데모 타이머가 한 번 걸려 버린다.
 *
 * 서버 스냅샷은 false — 서버에는 matchMedia가 없다. 클라이언트 첫 렌더에서
 * 실제 값으로 맞춰지므로 hydration 불일치가 나지 않는다.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** 서버에는 모션 설정이 없다 — 정적 HTML에는 애니메이션 상태가 없어 무해하다 */
function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
