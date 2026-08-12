import { api } from "@/shared/api/client";

// 담기(addCartItem)는 상세·챗봇·찜에서도 쓰므로 shared/api/cart.ts로 승격됨.

// 수량 변경 (C-3) — 게스트 허용(본인 소유 아이템만). quantity 1~99.
// 남의 아이템이면 403 AUTH_FORBIDDEN, 없는 항목이면 404 CART_ITEM_NOT_FOUND.
export async function updateCartQuantity(
  cartItemId: string,
  quantity: number,
): Promise<{ cartItemId: string; quantity: number }> {
  const { data } = await api.patch<{ cartItemId: string; quantity: number }>(
    `/api/cart/items/${cartItemId}`,
    { quantity },
  );
  return data;
}

export async function removeCartItem(cartItemId: string): Promise<void> {
  await api.delete(`/api/cart/items/${cartItemId}`);
}
