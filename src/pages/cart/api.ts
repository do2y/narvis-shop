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

export async function updateCartQuantity(
  cartItemId: number,
  quantity: number,
): Promise<void> {
  await api.patch(`/api/cart/items/${cartItemId}`, { quantity });
}

export async function removeCartItem(cartItemId: number): Promise<void> {
  await api.delete(`/api/cart/items/${cartItemId}`);
}
