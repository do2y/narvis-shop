// 홈 화면 데이터 계약 — mocks/handlers.ts와 1:1. 변경 시 목과 함께 갱신.

// 백엔드 GET /api/categories 계약 — 2단 트리(대분류 + children 소분류).
// emoji는 백엔드에 없어 프론트 매핑(categoryEmoji.ts)으로 표시 시점에 붙인다.
export interface Category {
  id: number;
  name: string; // 표시명 (칩은 #{name} 형태로 렌더)
  children: CategoryChild[]; // 소분류. 현재 화면 미사용, 계약 보존용
}

export interface CategoryChild {
  id: number;
  name: string;
}

// 인기상품 카드 — 백엔드 GET /api/products/popular (P-4) 계약.
// 판매수·조회수 기반 단순 집계라 추천 이유(reason)가 없다.
// reason은 LLM이 추천하는 챗봇 상품 카드(shared/types/chat.ts)에만 존재.
// 할인율은 백엔드가 주지 않아 originalPrice·price에서 파생.
export interface PopularProduct {
  productId: number;
  name: string;
  brandName: string;
  imageUrl: string;
  price: number; // 판매가
  originalPrice: number; // 정가 (할인 전, 할인 없으면 price와 동일)
  rating: number;
  reviewCount: number;
  purchasable?: boolean; // 명세엔 없으나 실제 응답에 포함. 품절 표시용으로 보존
}
