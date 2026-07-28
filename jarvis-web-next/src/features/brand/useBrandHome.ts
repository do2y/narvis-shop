"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchBrandHome } from "./api";
import type { BrandHome, BrandQuery } from "./types";

const THIRTY_MIN = 30 * 60 * 1000;

// 브랜드 소개·상품 목록은 정적 데이터에 가깝다 → staleTime 30분 (CLAUDE.md React Query 규칙).
// 필터·정렬·페이지가 키에 포함되므로 조합별로 캐시된다.
// keepPreviousData: 칩을 누를 때마다 목록이 스켈레톤으로 깜빡이지 않게 이전 결과를 유지한다.
//
// initialData: 서버 컴포넌트가 SSR에서 받아온 결과. 서버가 렌더한 그 조합(쿼리스트링)
// 에만 해당하므로, 필터를 바꾸면 키가 달라져 자연히 클라이언트 조회로 넘어간다.
export function useBrandHome(
  brandId: number,
  query: BrandQuery = {},
  initialData?: BrandHome,
) {
  return useQuery({
    queryKey: [
      "brands",
      brandId,
      {
        category: query.category ?? null,
        sort: query.sort ?? "popular",
        page: query.page ?? 0,
      },
    ],
    queryFn: () => fetchBrandHome(brandId, query),
    staleTime: THIRTY_MIN,
    enabled: Number.isFinite(brandId),
    placeholderData: keepPreviousData,
    initialData,
  });
}
