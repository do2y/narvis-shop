// 브랜드 홈 데이터 계약 — 백엔드 GET /api/brands/{id} (인증 불필요).
// mocks/handlers/brands.ts와 1:1. 변경 시 목과 함께 갱신.
import type {
  PurchaseState,
  SeededProductCard,
} from "@/shared/types/product";

// 브랜드가 판매 중인 상품의 소분류 — 카테고리 필터 축(07-17 확정).
// 필터 쿼리는 name이 아니라 id로 보낸다.
export interface BrandCategory {
  // 응답 id 는 문자열(2026-08-06 공통 규약) — 아래 Brand.id 와 같은 이유
  id: string;
  name: string;
}

export interface Brand {
  // 문자열이다. 64비트라 number 로 두면 JSON.parse 시점에 끝자리가 조용히 바뀐다
  // (productId 와 같은 이유 — shared/types/product.ts 참조).
  id: string;
  name: string;
  logoUrl: string;
  description: string;
  categories: BrandCategory[];
}

// 브랜드 상품 카드 — 응답 필드가 시딩 계약(SeededProductCard)과 정확히 겹친다.
// SeededProductCard를 확장해 시딩 필수 필드(productId·name·brandName·price·
// originalPrice·imageUrl·rating·reviewCount)를 타입으로 고정한다.
// 특히 brandName은 카드에 표시하지 않아(브랜드 홈은 전부 같은 브랜드) 불필요해 보이지만,
// 지우면 useGoToProduct 시딩이 깨져 상세 렌더가 무너진다 — 확장으로 삭제를 막는다.
export interface BrandProduct extends SeededProductCard {
  // P-6은 재고를 거르지 않아 SOLD_OUT이 섞여 온다(HIDDEN은 브랜드 목록에서 빠진다)
  purchaseState?: PurchaseState;
}

// 백엔드 페이지 응답
export interface BrandProductPage {
  content: BrandProduct[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface BrandHome {
  brand: Brand;
  products: BrandProductPage;
}

export type BrandSort = "popular" | "latest" | "price_asc" | "price_desc";

export const BRAND_SORTS: { value: BrandSort; label: string }[] = [
  { value: "popular", label: "인기순" },
  { value: "latest", label: "최신순" },
  { value: "price_asc", label: "낮은 가격순" },
  { value: "price_desc", label: "높은 가격순" },
];

export interface BrandQuery {
  // 카테고리 ID. 미지정 = 전체. 문자열이다 — 64비트라 number 로 두면 끝자리가 바뀐다
  category?: string;
  sort?: BrandSort; // 기본 popular
  page?: number; // 기본 0
  size?: number; // 기본 20
}
