"use client";

import { useEffect, useRef } from "react";

/**
 * MRC 광고 노출 기준 — 면적 50% 이상이 1초 이상 연속 노출.
 *
 * 임의로 정하면 나중에 근거를 댈 수 없고, **기준이 흔들리면 CTR 자체가 비교 불가능해진다**
 * — 알고리즘을 안 바꿔도 FE 구현이 바뀌면 수치가 출렁인다(E-1 명세).
 * 바꾸려면 배포가 필요하므로 변경 시점을 기록해 집계에서 구간을 나눠야 한다.
 */
export const VISIBLE_RATIO = 0.5;
export const VISIBLE_MS = 1000;

/**
 * 요소가 노출 기준을 만족하면 1회만 콜백한다(E-1 product_visible·recommendation_impression).
 *
 * "1회만"이 핵심이다 — 스크롤로 같은 카드가 다시 보여도 재발화하지 않는다.
 * 재발화하면 노출 수가 뻥튀기돼 CTR 분모가 부풀려진다.
 *
 * key 가 바뀌면 다른 대상으로 보고 다시 관찰한다(목록이 교체되는 경우).
 * 기준 미달이면 아예 발화하지 않는다 — 서버가 아니라 FE 가 판단해 이벤트 수를 줄인다.
 */
export function useVisibleOnce<T extends HTMLElement>(
  onVisible: () => void,
  key?: string | number,
) {
  const ref = useRef<T>(null);
  // 콜백이 매 렌더 새로 만들어져도 옵저버를 다시 붙이지 않도록 ref 로 최신값을 들고 있는다
  const onVisibleRef = useRef(onVisible);
  useEffect(() => {
    onVisibleRef.current = onVisible;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 구형 브라우저·테스트 환경 — 수집만 못 하고 화면은 정상 동작한다
    if (typeof IntersectionObserver === "undefined") return;

    let fired = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clear = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (fired) return;

        // 기준 미달로 내려가면 타이머를 접는다 — "연속 1초"라 중간에 가려지면 다시 세야 한다
        if (!entry.isIntersecting || entry.intersectionRatio < VISIBLE_RATIO) {
          clear();
          return;
        }
        if (timer !== null) return; // 이미 세는 중

        timer = setTimeout(() => {
          fired = true;
          clear();
          observer.disconnect(); // 1회 발화 후 관찰 중단
          onVisibleRef.current();
        }, VISIBLE_MS);
      },
      { threshold: VISIBLE_RATIO },
    );

    observer.observe(el);
    return () => {
      clear();
      observer.disconnect();
    };
  }, [key]);

  return ref;
}
