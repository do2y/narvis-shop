"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { toPageType } from "./pageType";
import { initAnalytics, track } from "./track";

/**
 * 이벤트 수집 초기화 + page_view 자동 발화.
 * 루트 레이아웃에 1회 마운트한다.
 *
 * usePathname 을 쓰는 이유: 라우트 변경마다 발화해야 하는데 App Router 는 클라이언트
 * 내비게이션에서 컴포넌트를 다시 마운트하지 않아 mount effect 로는 못 잡는다.
 * useSearchParams 는 쓰지 않는다 — 이 컴포넌트가 Suspense 경계에 묶이면
 * 그 안의 화면 전체가 SSR 에서 빈 HTML 로 나간다(CLAUDE.md).
 */
export function AnalyticsProvider() {
  const pathname = usePathname();
  const started = useRef(false);
  // StrictMode 의 이펙트 2회 실행과 같은 경로 재발화를 함께 막는다
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    initAnalytics();
  }, []);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    // 어휘에 없는 화면은 발화하지 않는다(toPageType 이 null 을 준다)
    const pageType = toPageType(pathname);
    if (pageType) track("page_view", { properties: { pageType } });
  }, [pathname]);

  return null;
}
