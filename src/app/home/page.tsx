import type { Metadata } from "next";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import HomePage from "@/features/home";
import { getCategories, getPopularProducts } from "@/features/home/serverApi";
import { sharedOpenGraph, sharedTwitter } from "../shared-metadata";

export const metadata: Metadata = {
  title: "Narvis — 대화로 찾는 쇼핑",
  description:
    "찾는 물건을 말로 설명하면 Narvis가 조건에 맞는 상품을 추천해드려요.",
  openGraph: {
    ...sharedOpenGraph,
    title: "Narvis — 대화로 찾는 쇼핑",
    description:
      "찾는 물건을 말로 설명하면 Narvis가 조건에 맞는 상품을 추천해드려요.",
    url: "/home",
  },
  twitter: {
    ...sharedTwitter,
    title: "Narvis — 대화로 찾는 쇼핑",
    description:
      "찾는 물건을 말로 설명하면 Narvis가 조건에 맞는 상품을 추천해드려요.",
  },
};

/**
 * 요청 시 렌더(빌드 시 정적 생성하지 않음).
 *
 * 이유: 홈은 백엔드에서 인기상품·카테고리를 받아야 하는데, CI 빌드 컨테이너 안에는
 * 백엔드가 없어 프리렌더가 반드시 실패한다(`next build`가 통째로 깨짐 — 실제로 겪음).
 * 데이터 자체는 `serverApi`에서 30분 재검증으로 캐시하므로 매 요청 조회하지 않는다.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  // 홈 하위 컴포넌트들은 훅으로 각자 데이터를 가져온다(CLAUDE.md: props 드릴링 대신 도메인 훅).
  // 그 구조를 유지한 채 SSR 데이터를 주려면 캐시에 심어야 하므로 HydrationBoundary를 쓴다.
  // (상품 상세는 쿼리가 1개뿐이라 initialData로 충분했지만, 여기는 여러 개다)
  const queryClient = new QueryClient();

  // 공개 데이터만 미리 채운다. 개인화 추천은 로그인이 필요해 클라이언트가 조회한다.
  // 한쪽이 실패해도 홈 전체가 죽지 않도록 각각 독립적으로 처리한다.
  await Promise.all([
    queryClient
      .prefetchQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
      })
      .catch(() => {}),
    queryClient
      .prefetchQuery({
        queryKey: ["products", "popular", null],
        queryFn: () => getPopularProducts(),
      })
      .catch(() => {}),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomePage />
    </HydrationBoundary>
  );
}
