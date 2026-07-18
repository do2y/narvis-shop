import { api } from "@/shared/api/client";
import type { Cart, CartRecommendation } from "./types";

// 게스트도 조회 가능(guest_id 쿠키). client의 withCredentials로 쿠키가 동봉된다.
export async function fetchCart(): Promise<Cart> {
  const { data } = await api.get<Cart>("/api/cart");
  return data;
}

export async function fetchCartRecommendations(): Promise<CartRecommendation[]> {
  const { data } = await api.get<{ products: CartRecommendation[] }>(
    "/api/cart/recommendations",
  );
  return data.products;
}

export async function updateCartQuantity(
  cartItemId: number,
  quantity: number,
): Promise<void> {
  await api.patch(`/api/cart/items/${cartItemId}`, { quantity });
}

export async function removeCartItem(cartItemId: number): Promise<void> {
  await api.delete(`/api/cart/items/${cartItemId}`);
}
