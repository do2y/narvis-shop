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
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof window === "undefined") return;

    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      setRevealed(true);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

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
  }, [rootMargin, threshold]);

  return { ref, revealed };
}
