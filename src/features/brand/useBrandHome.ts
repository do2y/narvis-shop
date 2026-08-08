"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchBrandHome } from "./api";
import type { BrandHome, BrandQuery } from "./types";

const THIRTY_MIN = 30 * 60 * 1000;

// 브랜드 소개·상품 목록은 정적 데이터에 가깝다 → staleTime 30분 (CLAUDE.md React Query 규칙).
// 필터·정렬·페이지가 키에 포함되므로 조합별로 캐시된다.
// keepPreviousData: 칩을 누를 때마다 목록이 스켈레톤으로 깜빡이지 않게 이전 결과를 유지한다.
//
// initialData: 서버 컴포넌트가 SSR에서 받아온 결과.
//
// ⚠️ 반드시 "서버가 렌더한 그 조합"에만 넣어야 한다. 모든 키에 그대로 주면
// 정렬·필터를 바꿔 새 키가 생겼을 때도 옛 데이터가 초기값으로 들어가고,
// staleTime(30분) 때문에 fresh로 간주되어 **재조회조차 하지 않는다**
// → 화면이 바뀌지 않아 "정렬이 안 먹는다"로 보인다(2026-07-28 실제 발생).
//
// serverQuery는 서버가 SSR에 사용한 조합. 지금 보고 있는 조합과 같을 때만 승계한다.
export function useBrandHome(
  brandId: string,
  query: BrandQuery = {},
  initialData?: BrandHome,
  serverQuery?: BrandQuery,
) {
  const normalize = (q: BrandQuery) => ({
    category: q.category ?? null,
    sort: q.sort ?? "popular",
    page: q.page ?? 0,
  });

  const current = normalize(query);
  const isServerRenderedCombo =
    serverQuery !== undefined &&
    JSON.stringify(current) === JSON.stringify(normalize(serverQuery));

  return useQuery({
    queryKey: ["brands", brandId, current],
    queryFn: () => fetchBrandHome(brandId, query),
    staleTime: THIRTY_MIN,
    // brandId 는 문자열이다 — Number.isFinite 를 쓰면 항상 false 가 되어 쿼리가 안 돈다
    enabled: brandId.length > 0,
    placeholderData: keepPreviousData,
    initialData: isServerRenderedCombo ? initialData : undefined,
  });
}
