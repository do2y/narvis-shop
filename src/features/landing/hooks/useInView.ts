"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 요소가 뷰포트에 들어왔는지 한 번만 알린다(스크롤 등장 연출용).
 *
 * 한 번 켜지면 observer를 즉시 끊는다 — 랜딩은 위아래로 오가는 화면이라
 * 계속 관찰하면 스크롤을 되돌릴 때마다 요소가 다시 사라졌다 나타나 산만하다.
 * 등장은 "처음 읽는 순간"을 돕는 것이지 반복 볼거리가 아니다.
 *
 * `shared/analytics/useVisibleOnce`와 목적이 다르다 — 그쪽은 노출 **수집**이라
 * 체류 시간(1초)·가시 비율 조건이 붙고 콜백만 준다. 여기는 그리기 상태가 필요하다.
 */
export function useInView<T extends HTMLElement>(options?: {
  /** 화면 아래쪽에서 얼마나 일찍 켤지 — 기본값은 "조금 올라오면 바로" */
  rootMargin?: string;
  threshold?: number;
}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // IntersectionObserver가 없는 환경(구형·테스트 jsdom)에서는 연출을 포기하고
    // 완성 상태로 둔다. 내용을 못 읽는 것보다 낫다.
    //
    // 이펙트 본문에서 곧바로 setState 하지 않고 한 틱 미룬다 — 동기 호출은
    // 연쇄 렌더를 만든다(react-hooks/set-state-in-effect). 이 경로는 관찰 자체가
    // 불가능한 폴백이라 한 프레임 늦어도 보이는 차이가 없다.
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setInView(true), 0);
      return () => window.clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      {
        rootMargin: options?.rootMargin ?? "0px 0px -12% 0px",
        threshold: options?.threshold ?? 0.15,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
    // options는 호출부에서 인라인 객체로 오는 게 보통이라 의존성에 넣으면
    // 매 렌더 observer를 다시 만든다. 값이 바뀌는 사용처가 없어 마운트 1회로 고정.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, inView };
}
