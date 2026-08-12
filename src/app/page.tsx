import type { Metadata } from "next";
import LandingPage from "@/features/landing";
import { parseTab } from "@/features/landing/types";
import { sharedOpenGraph, sharedTwitter } from "./shared-metadata";

export const metadata: Metadata = {
  title: "Narvis — 대화로 끝내는 쇼핑, 물어보는 판매 분석",
  description:
    "원하는 상황과 취향을 말하면 이유와 함께 상품을 추천해 드려요. 판매자는 판매 데이터를 자연어로 묻고 보고서와 개선안을 받아볼 수 있어요.",
  openGraph: {
    ...sharedOpenGraph,
    title: "Narvis — 대화로 끝내는 쇼핑, 물어보는 판매 분석",
    description:
      "소비자는 대화로 상품을 찾고, 판매자는 데이터를 물어봅니다. Narvis 서비스 소개.",
    url: "/",
  },
  twitter: {
    ...sharedTwitter,
    title: "Narvis — 대화로 끝내는 쇼핑, 물어보는 판매 분석",
    description:
      "소비자는 대화로 상품을 찾고, 판매자는 데이터를 물어봅니다. Narvis 서비스 소개.",
  },
};

/**
 * 랜딩 = 사이트 루트(`/`) — 소비자/판매자 탭을 한 페이지에서 전환한다(`?tab=`).
 *
 * 주소창에 도메인만 친 사람은 서비스를 아직 모르는 경우가 많아, 루트에서
 * "무엇을 할 수 있는지"를 먼저 설명한다. 쇼핑몰 진입점은 `/home` 으로 분리했다
 * (2026-08-12 이전에는 반대였다 — 루트가 홈, 랜딩이 `/landing`).
 * 둘은 목적이 다르므로 한 화면에 합치지 않는다 — 합치면 양쪽 다 흐려진다.
 *
 * ## 탭을 서버에서 읽는 이유
 * `?tab=seller` 링크를 받은 사람에게 판매자 내용이 **HTML에 담겨** 나가야 한다.
 * 클라이언트에서만 읽으면 공유 링크가 소비자 화면으로 먼저 그려지고, 검색엔진에도
 * 판매자 내용이 색인되지 않는다.
 *
 * 서버 컴포넌트의 `searchParams`를 쓴다(Next 16에서 **async**다). 클라이언트에서
 * `useSearchParams`를 쓰면 그 컴포넌트가 Suspense 경계에 묶여 경계 안 전체가
 * SSR에서 빈 HTML이 된다(CLAUDE.md) — 공개 랜딩에서 가장 피해야 할 결과다.
 *
 * 데이터 조회는 없다. searchParams를 읽으므로 요청 시 렌더되지만, 백엔드를
 * 부르지 않아 CI 빌드에서 실패할 여지가 없다.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <LandingPage initialTab={parseTab(tab)} />;
}
