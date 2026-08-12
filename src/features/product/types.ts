// 상품 상세 데이터 계약 — 백엔드 GET /api/products/{id} 응답과 1:1.

import type { PurchaseState } from "@/shared/types/product";

export interface ProductOption {
  /**
   * 문자열이다 — 숫자가 아니다(2026-08-06 계약 변경).
   * 서버 ID가 64비트라 JS number 로 담으면 MAX_SAFE_INTEGER(9,007,199,254,740,991)를
   * 넘는 값에서 끝자리가 조용히 바뀐다. 실제로 134494416241190242 가
   * 134494416241190240 으로 파싱돼 담기가 CART_OPTION_INVALID 로 거부됐다.
   * 경고 없이 값만 틀어지므로 절대 number 로 되돌리지 말 것.
   */
  optionId: string;
  name: string; // "화이트/M" — 옵션값 조합
  extraPrice: number; // 옵션 추가금. 선택 시 단가 = price + extraPrice
  /**
   * 이 옵션의 남은 재고 (2026-08-09 옵션별 재고 전환).
   * 상품의 stockQuantity 는 구매 가능한 옵션 재고의 합계라 수량 상한으로 쓸 수 없다
   * — 합계로 막으면 "빨강 3개 남음"인데 10개까지 담기고 서버가 거절한다.
   */
  stockQuantity: number;
  /**
   * 옵션은 AVAILABLE·SOLD_OUT 둘뿐이다 — HIDDEN 은 상품 단위 상태라 옵션엔 없다(명세).
   * 상세는 검색(I-1)과 의도적으로 반대로, 품절 옵션을 숨기지 않고 이유를 보여준다
   * — "원래 없는 옵션"인지 "품절"인지 구분돼야 재입고를 기다릴지 판단할 수 있다.
   */
  purchaseState: Extract<PurchaseState, "AVAILABLE" | "SOLD_OUT">;
}

// attributes 맵의 값. 백엔드가 필드마다 다른 모양을 넣는다(문자열/null/배열/메타 객체).
// 객체 케이스를 unknown으로 두어 그대로 렌더하면 컴파일 에러가 나게 한다
// — 이전에 React error #31로 상세 페이지가 통째로 죽은 원인.
export type ProductAttributeValue = string | string[] | null | Record<string, unknown>;

export interface ProductBrand {
  // 문자열이다(브랜드 링크 `/brands/${id}` 가 이 값을 그대로 쓴다).
  // number 로 두면 64비트 id 의 끝자리가 조용히 바뀌어 존재하는 브랜드가 404 가 된다.
  id: string;
  name: string;
  logoUrl: string;
}

export interface ProductCategory {
  // 응답 id 는 문자열(2026-08-06 공통 규약) — ProductBrand.id 와 같은 이유
  id: string;
  name: string;
}

// 리뷰 테이블 실시간 집계(status=VISIBLE만)
export interface ProductRating {
  average: number;
  count: number;
}

// 상품 후기 (P-3) — status=VISIBLE인 것만 내려온다.
export interface ProductReview {
  reviewId: string;
  rating: number;
  content: string;
  authorNickname: string;
  createdAt: string; // "2026-07-01T12:00:00+09:00" — 오프셋 포함(명세)
}

export type ReviewSort = "latest" | "rating";

// 별점 분포 — 키가 "5"~"1" 문자열로 오는 점에 주의(JSON 객체 키).
export type ReviewDistribution = Record<"1" | "2" | "3" | "4" | "5", number>;

export interface ProductReviewPage {
  content: ProductReview[];
  // page=0 응답에만 포함(후기 0개면 0값). page>=1은 생략되므로 FE가 0페이지 값을 재사용한다.
  distribution?: ReviewDistribution;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ProductDetail {
  // SeededProductCard.productId와 같은 값이라 타입도 같아야 한다 —
  // 한쪽만 문자열이면 찜 판정·캐시 시딩이 타입 에러 없이 조용히 어긋난다.
  id: string;
  name: string;
  imageUrl: string; // 대표 이미지 단일(상단 갤러리)
  // 상세 설명 이미지. 위에서 아래로 이어 붙이는 세로 나열이라 갤러리와 성격이 다르다.
  // 없는 상품이 있어 optional — 구버전 응답에는 필드 자체가 없다.
  detailImages?: string[];
  price: number; // 판매가
  originalPrice: number; // 정가
  summary: string;
  description: string;
  // 상품 속성. 값 타입이 섞여 온다:
  //   문자열 "신축성있음" / null(값 없음) / 배열 ["S","M","L"](옵션 축 후보값)
  //   / 객체 { axes, option_count, source }("옵션구성" — 표시용이 아닌 내부 메타데이터)
  // 표시 가능한 것만 골라내는 책임은 toSpecRows(utils/attributes.ts)에 있다.
  attributes: Record<string, ProductAttributeValue>;
  options: ProductOption[];
  brand: ProductBrand;
  category: ProductCategory;
  rating: ProductRating;
  status: string; // ON_SALE 등
  stockQuantity: number;
  // status·stockQuantity로 FE가 파생할 수도 있지만, 화면마다 판정이 갈리지 않게
  // 서버가 계산한 값을 쓴다(P-2는 원자료도 함께 내려준다)
  purchaseState: PurchaseState;
}
