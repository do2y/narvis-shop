// 홈 화면 데이터 계약 — mocks/handlers.ts와 1:1. 변경 시 목과 함께 갱신.

// 백엔드 GET /api/categories 계약 — 2단 트리(대분류 + children 소분류).
// emoji는 백엔드에 없어 프론트 매핑(categoryEmoji.ts)으로 표시 시점에 붙인다.
export interface Category {
  // 응답 id 는 문자열(2026-08-06 공통 규약 — category.id 포함)
  id: string;
  name: string; // 표시명 (칩은 #{name} 형태로 렌더)
  children: CategoryChild[]; // 소분류. 현재 화면 미사용, 계약 보존용
}

export interface CategoryChild {
  id: string;
  name: string;
}

// 인기상품 카드 — 백엔드 GET /api/products/popular (P-4) 계약.
// 판매수·조회수 기반 단순 집계라 추천 이유(reason)가 없다.
// reason은 LLM이 추천하는 챗봇 상품 카드(shared/types/chat.ts)에만 존재.
// 할인율은 백엔드가 주지 않아 originalPrice·price에서 파생.
export interface PopularProduct {
  productId: string;
  name: string;
  brandName: string;
  imageUrl: string;
  price: number; // 판매가
  originalPrice: number; // 정가 (할인 전, 할인 없으면 price와 동일)
  rating: number;
  reviewCount: number;
}

/**
 * 추천 출처 (P-5, 2026-08-07 개명 — 구 `AI_RECOMMENDED`|`POPULAR_FALLBACK`).
 *
 * `NOT_PERSONALIZED` = 서버가 개인화에 실패해 P-4(인기상품)로 대체한 결과.
 * 신규 회원·후보 부족·AI 장애를 FE는 구분하지 않는다(사유는 와이어에 없다).
 */
export type RecommendationSource = "PERSONALIZED" | "NOT_PERSONALIZED";

// 추천 카드 — P-4 카드 + 카드별 추천 이유.
// reason은 NOT_PERSONALIZED일 때 서버가 null을 넣는다(필드 자체는 유지).
export interface RecommendedProduct extends PopularProduct {
  reason: string | null;
}

/**
 * GET /api/products/recommended (P-5) 응답.
 *
 * items 배열 순서가 곧 순위다 — FE는 재정렬하지 않는다.
 * 상관키 2종은 fallback 응답에도 실린다(Spring 발급) — 없으면 노출·클릭
 * 이벤트가 고아가 되어 E-1 서버 검증에서 버려진다.
 */
export interface RecommendationResult {
  source: RecommendationSource;
  recommendationRequestId: string;
  listId: string;
  items: RecommendedProduct[];
}
