// 찜한 상품 — 백엔드 GET /api/wishlist 계약과 1:1.
// 마이페이지 찜 목록·상품 상세·챗봇 카드가 함께 쓰므로 shared에 둔다.
// 상세 진입 시 캐시 시딩이 가능하도록 카드 수준 데이터를 그대로 포함한다.
import type { PurchaseState } from "./product";

export interface WishlistProduct {
  productId: string;
  name: string;
  brandName: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  // 찜한 뒤 품절·판매종료된 상품도 목록에 남는다 — 사유에 따라 안내가 다르다
  purchaseState: PurchaseState;
}