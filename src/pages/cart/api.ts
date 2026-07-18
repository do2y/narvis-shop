import { api } from "@/shared/api/client";
import type { CartRecommendation } from "./types";

// fetchCart는 헤더 뱃지도 쓰므로 shared/api/cart.ts로 승격됨(경로 유지를 위해 재수출).
export { fetchCart } from "@/shared/api/cart";

export async function fetchCartRecommendations(): Promise<
  CartRecommendation[]
> {
  const { data } = await api.get<{ products: CartRecommendation[] }>(
    "/api/cart/recommendations",
  );
  return data.products;
}

export async function addCartItem(body: {
  productId: number;
  optionId?: number | null;
  quantity: number;
}): Promise<{ cartItemId: number }> {
  const { productId, optionId, quantity } = body;
  const { data } = await api.post<{ cartItemId: number }>("/api/cart/items", {
    productId,
    quantity,
    ...(optionId != null ? { optionId } : {}),
  });
  return data;
}

// 수량 변경 (C-3) — 게스트 허용(본인 소유 아이템만). quantity 1~99.
// 남의 아이템이면 403 AUTH_FORBIDDEN, 없는 항목이면 404 CART_ITEM_NOT_FOUND.
export async function updateCartQuantity(
  cartItemId: number,
  quantity: number,
): Promise<{ cartItemId: number; quantity: number }> {
  const { data } = await api.patch<{ cartItemId: number; quantity: number }>(
    `/api/cart/items/${cartItemId}`,
    { quantity },
  );
  return data;
}

export async function removeCartItem(cartItemId: number): Promise<void> {
  await api.delete(`/api/cart/items/${cartItemId}`);
}
