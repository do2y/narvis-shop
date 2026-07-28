export type { Cart, CartItem } from "@/shared/types/cart";

// 함께 구매 추천 상품 — 카드 표시용.
export interface CartRecommendation {
  productId: number;
  name: string;
  brand: string;
  imageUrl: string;
  price: number;
}
