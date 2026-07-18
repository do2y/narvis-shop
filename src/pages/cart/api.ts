import { api } from "@/shared/api/client";
import type { Cart, CartItem, CartRecommendation } from "./types";

// 실제 백엔드 응답은 명세와 필드명이 다르다(name → productName 등).
// 앱 내부는 명세(CartItem)를 따르고, 차이는 여기서만 흡수한다.
// 백엔드가 명세대로 고쳐지면 이 타입과 매핑만 지우면 됨.
interface CartItemResponse extends Omit<CartItem, "name"> {
  productName: string;
  brandId?: number;
  brandName?: string;
}

// 게스트도 조회 가능(guest_id 쿠키). client의 withCredentials로 쿠키가 동봉된다.
export async function fetchCart(): Promise<Cart> {
  const { data } = await api.get<Omit<Cart, "items"> & {
    items: CartItemResponse[];
  }>("/api/cart");

  return {
    ...data,
    items: data.items.map(({ productName, ...rest }) => ({
      ...rest,
      name: productName,
    })),
  };
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
