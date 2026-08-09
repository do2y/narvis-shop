"use client";

import { useSellerCta } from "../cta";
import { CrossLink } from "../components/CrossLink";
import { FinalCta } from "../components/FinalCta";
import type { LandingTab } from "../types";
import { SellerFeatures } from "./components/SellerFeatures";
import { SellerHero } from "./components/SellerHero";
import { SellerHowItWorks } from "./components/SellerHowItWorks";
import { SellerTrust } from "./components/SellerTrust";

/** 판매자 랜딩 본문 — Hero부터 Final CTA까지. Header·Footer는 상위가 공통으로 씌운다. */
export function SellerLanding({
  onTabChange,
}: {
  onTabChange: (tab: LandingTab) => void;
}) {
  const cta = useSellerCta();

  return (
    <>
      <SellerHero />
      <SellerFeatures />
      <SellerTrust />
      <SellerHowItWorks />

      <CrossLink
        to="buyer"
        question="AI 쇼핑을 경험하고 싶으신가요?"
        label="소비자 AI 쇼핑 살펴보기"
        onNavigate={onTabChange}
      />

      <FinalCta
        headline={
          <>
            데이터를 보는 시간을 줄이고,
            <br />
            결정에 더 집중하세요.
          </>
        }
        ctaLabel="판매자 AI 시작하기"
        ctaHref={cta.href}
        notice={cta.notice}
      />
    </>
  );
}
