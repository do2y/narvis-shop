"use client";

import { useEffect, useRef, useState } from "react";

interface UseRevealOnceOptions {
  rootMargin?: string;
  threshold?: number | number[];
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function useRevealOnce<T extends HTMLElement>({
  rootMargin = "0px 0px -12% 0px",
  threshold = 0.16,
}: UseRevealOnceOptions = {}) {
  const ref = useRef<T>(null);

  // 관찰 없이 바로 보여줄 조건은 첫 렌더 때 이미 정해져 있다 — 초기값으로 판정한다.
  // effect 안에서 setState 로 켜면 한 프레임 늦어 깜빡이고,
  // 그걸 rAF 로 감싸도 지연은 그대로다(react-hooks/set-state-in-effect 도 걸린다).
  // SSR 에서는 window 가 없어 false 로 시작하고, 관찰은 아래 effect 가 이어받는다.
  const [revealed, setRevealed] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia(REDUCED_MOTION_QUERY).matches ||
        typeof IntersectionObserver === "undefined"),
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window === "undefined") return;
    if (revealed) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setRevealed(true);
        observer.disconnect();
      },
      { rootMargin, threshold },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [rootMargin, threshold, revealed]);

  return { ref, revealed };
}
