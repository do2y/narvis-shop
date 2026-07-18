import { useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchPopularProducts } from "./api";

const THIRTY_MIN = 30 * 60 * 1000;

// 카테고리는 정적 데이터 → staleTime 30분 (CLAUDE.md React Query 규칙)
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: THIRTY_MIN,
  });
}

// 인기상품도 자주 바뀌지 않는 큐레이션 → 30분
// size 미지정 시 백엔드 기본값(12). queryFn을 직접 넘기면 React Query context가
// 첫 인자로 들어가므로 명시적으로 호출한다.
export function usePopularProducts(size?: number) {
  return useQuery({
    queryKey: ["products", "popular", size ?? null],
    queryFn: () => fetchPopularProducts(size),
    staleTime: THIRTY_MIN,
  });
}
