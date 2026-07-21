import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchBrandHome } from "./api";
import type { BrandQuery } from "./types";

const THIRTY_MIN = 30 * 60 * 1000;

// 브랜드 소개·상품 목록은 정적 데이터에 가깝다 → staleTime 30분 (CLAUDE.md React Query 규칙).
// 필터·정렬·페이지가 키에 포함되므로 조합별로 캐시된다.
// keepPreviousData: 칩을 누를 때마다 목록이 스켈레톤으로 깜빡이지 않게 이전 결과를 유지한다.
export function useBrandHome(brandId: number, query: BrandQuery = {}) {
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
  });
}
