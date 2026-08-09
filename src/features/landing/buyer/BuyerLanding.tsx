"use client";

import { useBuyerCtaHref } from "../cta";
import { CrossLink } from "../components/CrossLink";
import { FinalCta } from "../components/FinalCta";
import type { LandingTab } from "../types";
import { BuyerFeatures } from "./components/BuyerFeatures";
import { BuyerHero } from "./components/BuyerHero";
import { BuyerHowItWorks } from "./components/BuyerHowItWorks";

/**
 * 소비자 랜딩 본문 — Hero부터 Final CTA까지.
 *
 * Header·Footer는 상위(LandingPage)가 두 탭에 공통으로 씌운다. 여기가 `<main>`
 * 안에 들어가는 내용 전부다.
 */
export function BuyerLanding({
  onTabChange,
}: {
  onTabChange: (tab: LandingTab) => void;
}) {
  const ctaHref = useBuyerCtaHref();

  return (
    <>
      <BuyerHero />
      <BuyerFeatures />
      <BuyerHowItWorks />

      <CrossLink
        to="seller"
        question="판매 데이터를 분석하고 싶으신가요?"
        label="판매자 AI 살펴보기"
        onNavigate={onTabChange}
      />

      <FinalCta
        headline={
          <>
            검색어를 고민하는 대신,
            <br />
            원하는 것을 말해보세요.
          </>
        }
        ctaLabel="AI 쇼핑 시작하기"
        ctaHref={ctaHref}
      />
    </>
  );
}
