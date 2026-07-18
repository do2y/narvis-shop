import { api } from "./client";
import type { Cart } from "@/shared/types/cart";

// 장바구니 조회 (C-1) — 게스트도 가능(guest_id 쿠키). client의 withCredentials로 쿠키 동봉.
// 헤더 뱃지가 여러 페이지에서 이 데이터를 쓰므로 shared에 둔다(장바구니 페이지 전용 아님).
export async function fetchCart(): Promise<Cart> {
  const { data } = await api.get<Cart>("/api/cart");
  return data;
}
