// 상품 상세 데이터 계약 — 백엔드 GET /api/products/{id} 응답과 1:1.

export interface ProductOption {
  optionId: number;
  name: string; // "화이트/M" — 옵션값 조합
  extraPrice: number; // 옵션 추가금. 선택 시 단가 = price + extraPrice
}

export interface ProductBrand {
  id: number;
  name: string;
  logoUrl: string;
}

export interface ProductCategory {
  id: number;
  name: string;
}

// 리뷰 테이블 실시간 집계(status=VISIBLE만)
export interface ProductRating {
  average: number;
  count: number;
}

export interface ProductDetail {
  id: number;
  name: string;
  imageUrl: string; // 대표 이미지 단일
  price: number; // 판매가
  originalPrice: number; // 정가
  summary: string;
  description: string;
  attributes: Record<string, string>; // { "소재": "린넨", "핏": "오버핏" }
  options: ProductOption[];
  brand: ProductBrand;
  category: ProductCategory;
  rating: ProductRating;
  status: string; // ON_SALE 등
  stockQuantity: number;
  purchasable: boolean;
}
