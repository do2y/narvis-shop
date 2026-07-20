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

// 담기 (C-2) — 동일 상품+옵션이 이미 있으면 서버가 수량을 합산한다.
// 응답 quantity는 합산 결과라 요청 수량과 다를 수 있다.
export async function addCartItem(body: {
  productId: number;
  optionId?: number | null;
  quantity: number;
}): Promise<{ cartItemId: number; quantity: number }> {
  const { productId, optionId, quantity } = body;
  const { data } = await api.post<{ cartItemId: number; quantity: number }>(
    "/api/cart/items",
    {
      productId,
      quantity,
      ...(optionId != null ? { optionId } : {}),
    },
  );
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
