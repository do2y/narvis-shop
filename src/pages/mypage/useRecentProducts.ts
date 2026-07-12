import { useQuery } from "@tanstack/react-query";
import { fetchRecentProducts } from "./api";

// 최근 본 상품 — 서버 원본. 조회 즉시 갱신될 수 있어 staleTime 0.
export function useRecentProducts() {
  return useQuery({
    queryKey: ["recentProducts"],
    queryFn: fetchRecentProducts,
    staleTime: 0,
  });
}
