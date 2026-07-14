import { useQuery } from "@tanstack/react-query";
import { fetchOrder, fetchOrders } from "./api";

// 주문 내역 — 서버 원본, 배송 상태가 바뀔 수 있어 staleTime 0 (CLAUDE.md 규칙)
export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    staleTime: 0,
  });
}

// 주문 상세 — 단건. 목록과 별개 키로 두어 배송지·금액 분해까지 캐시.
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => fetchOrder(orderId),
    staleTime: 0,
  });
}
