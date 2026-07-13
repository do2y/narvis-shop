import { useQuery } from "@tanstack/react-query";
import { fetchOrders } from "./api";

// 주문 내역 — 서버 원본, 배송 상태가 바뀔 수 있어 staleTime 0 (CLAUDE.md 규칙)
export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    staleTime: 0,
  });
}
