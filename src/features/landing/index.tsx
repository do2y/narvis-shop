"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useBuyerCtaHref, useSellerCta } from "./cta";
import { LandingFooter } from "./components/LandingFooter";
import { LandingHeader } from "./components/LandingHeader";
import { BuyerLanding } from "./buyer/BuyerLanding";
import { SellerLanding } from "./seller/SellerLanding";
import { parseTab, type LandingTab } from "./types";

/**
 * 주소창(`?tab=`)을 외부 스토어로 다룬다.
 *
 * 브라우저 히스토리는 React 바깥의 상태다. `popstate`는 뒤로/앞으로 가기에서만
 * 발화하고 `pushState`에는 오지 않으므로, 우리가 직접 바꿀 때는 구독자를 손으로
 * 깨워야 한다 — 그래서 리스너 집합을 따로 둔다.
 */
const urlListeners = new Set<() => void>();

function notifyUrlChange() {
  for (const listener of urlListeners) listener();
}

function subscribeToUrl(onChange: () => void): () => void {
  urlListeners.add(onChange);
  // 뒤로/앞으로 가기 — pushState로 히스토리에 쌓았으므로 이걸 안 들으면
  // 뒤로가기를 눌러도 주소만 바뀌고 화면이 그대로다.
  window.addEventListener("popstate", notifyUrlChange);
  return () => {
    urlListeners.delete(onChange);
    if (urlListeners.size === 0) {
      window.removeEventListener("popstate", notifyUrlChange);
    }
  };
}

function getTabSnapshot(): LandingTab {
  return parseTab(new URLSearchParams(window.location.search).get("tab"));
}

/**
 * 랜딩 — 소비자/판매자 두 탭을 한 페이지에서 전환한다.
 *
 * ## 왜 한 라우트인가
 * `/seller`는 이미 판매자 대시보드가 쓰고 있고(RequireRole 가드), 거기에 공개
 * 랜딩을 얹으려면 대시보드 URL을 옮기고 로그인 후 이동·격리 가드를 전부 고쳐야
 * 한다. 기존 서비스 동선을 건드리지 않으려고 루트(`/`) 한 곳에 둔다
 * (2026-08-12 이전에는 `/landing` 이었다).
 *
 * ## 탭 상태를 URL에 남기는 방법
 * `useSearchParams`를 쓰지 않는다 — 그 훅을 쓰는 컴포넌트는 Suspense 경계에
 * 묶여 **경계 안 전체가 SSR에서 빈 HTML로 나간다**(CLAUDE.md). 랜딩은 공개
 * 페이지라 그 대가가 특히 크다(첫 화면이 통째로 비어 나간다).
 *
 * 대신 초기값은 마운트 후 `window.location.search`에서 한 번 읽고, 이후 갱신은
 * `window.history.pushState`로 한다(CLAUDE.md 라우팅 규칙: 화면 내 쿼리 갱신은
 * pushState). `router.push`를 쓰면 페이지 이동으로 취급돼 주소창 반영이 늦고
 * 스크롤이 초기화된다.
 *
 * 서버 렌더 시점에는 항상 소비자 탭으로 그린다. 판매자 링크로 들어온 경우 첫
 * 프레임이 소비자 탭이었다가 바뀌는데, 그 대가로 SSR을 지킨다 — 이 페이지의
 * 기본 진입은 소비자이고, 검색엔진에 노출되어야 하는 것도 그쪽이다.
 */
export default function LandingPage({
  /** 라우트가 `searchParams`에서 읽어 넘긴 초기 탭 — 서버 렌더의 기준값 */
  initialTab,
}: {
  initialTab: LandingTab;
}) {
  /**
   * 탭은 URL이 소유한다.
   *
   * state로 복제한 뒤 이펙트로 맞추면 두 가지가 어긋난다 — 초기 진입에서 한
   * 프레임 동안 소비자 탭이 스치고(연쇄 렌더), 뒤로가기 때 둘을 따로 갱신해야
   * 한다. `useSyncExternalStore`로 주소창을 직접 읽으면 그 두 문제가 함께 없어진다.
   *
   * 서버 스냅샷은 라우트가 `searchParams`에서 읽어 넘긴 값이다(app/page.tsx).
   * 그래서 `?tab=seller` 링크도 판매자 내용이 담긴 HTML로 나가고, hydration 시
   * 클라이언트가 읽는 주소창 값과 일치해 불일치 경고가 없다.
   */
  const tab = useSyncExternalStore(
    subscribeToUrl,
    getTabSnapshot,
    // 서버 스냅샷은 렌더마다 같은 값이어야 한다 — 라우트가 준 값을 그대로 돌려준다
    useCallback(() => initialTab, [initialTab]),
  );

  const changeTab = useCallback(
    (next: LandingTab) => {
      if (next === tab) return;
      // 화면 내 쿼리 갱신은 pushState (CLAUDE.md 라우팅 규칙).
      // router.push는 페이지 이동이라 주소창 반영이 늦고 스크롤이 초기화된다.
      window.history.pushState(null, "", `/?tab=${next}`);
      // pushState는 popstate를 발화하지 않는다 — 구독자에게 직접 알린다
      notifyUrlChange();
      // 탭을 바꾸면 새 탭은 맨 위부터 읽어야 한다. 헤더·푸터·CrossLink 어디서
      // 눌렀든 같아야 하므로 호출부가 아니라 여기서 한다(헤더만 빠져 있어서
      // 소비자 탭 중간에서 넘어가면 판매자 탭 중간이 보였다).
      // "auto"는 CSS의 `scroll-behavior: smooth`를 따르므로 "instant"로 명시한다
      // — 본문이 통째로 갈린 뒤라 부드럽게 올라가는 동안 엉뚱한 섹션이 스친다.
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [tab],
  );

  const buyerHref = useBuyerCtaHref();
  const sellerCta = useSellerCta();

  const isSeller = tab === "seller";

  return (
    // 한글은 기본값(word-break: normal)에서 음절 단위로 줄이 바뀌어 "여/러"처럼
    // 단어가 갈린다. 랜딩은 문장 위주라 어절 단위로 끊고(break-keep), 공백 없는
    // 긴 문자열만 예외로 쪼개 가로 넘침을 막는다(wrap-break-word).
    <div className="min-h-screen bg-background break-keep wrap-break-word">
      <LandingHeader
        tab={tab}
        onTabChange={changeTab}
        ctaLabel={isSeller ? "판매자 AI 시작하기" : "AI 쇼핑 시작하기"}
        ctaHref={isSeller ? sellerCta.href : buyerHref}
      />

      {/*
        탭이 바뀌면 본문 전체가 갈린다. key로 재마운트해 이전 탭의 데모 타이머·
        IntersectionObserver가 남지 않게 한다 — 정리는 각 훅의 cleanup이 하지만,
        재마운트가 그 실행을 보장하는 가장 단순한 방법이다.
      */}
      <main key={tab}>
        {isSeller ? (
          <SellerLanding onTabChange={changeTab} />
        ) : (
          <BuyerLanding onTabChange={changeTab} />
        )}
      </main>

      <LandingFooter tab={tab} onTabChange={changeTab} />
    </div>
  );
}
