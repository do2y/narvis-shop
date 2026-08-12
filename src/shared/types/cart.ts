// 장바구니 데이터 계약 — 백엔드 GET /api/cart 명세와 1:1.
// 헤더 뱃지·장바구니 페이지·상품 상세(담기)에서 함께 쓰므로 shared에 둔다.

import type { PurchaseState } from "./product";

/**
 * 추천 출처 — 추천 카드에서 담기(C-2)·바로 구매(O-1) 할 때만 싣는다.
 * 서버가 이 2개로 지면·순위를 조회해 붙이므로 FE는 더 보내지 않는다.
 *
 * 빠지면 추천이 만든 전환이 성과 집계에서 사라진다(담기→주문 시 order_item으로 복사됨).
 * 반대로 **이전 목록의 값이 남아 딸려오면** 하지 않은 전환이 추천 성과로 잡힌다 —
 * 서버가 소유자·포함 여부를 검증해 어긋나면 이 필드만 버리고 담기는 정상 처리하지만,
 * 검증을 통과하는 낡은 값은 그대로 저장되므로 카드에 실린 값만 쓰고 따로 보관하지 않는다.
 */
export interface RecommendationContext {
  recommendationRequestId: string;
  listId: string;
}

// 장바구니 항목. 결제 이동을 위해 카드 수준 데이터를 포함.
export interface CartItem {
  /**
   * 장바구니 라인 식별(같은 상품 다른 옵션 구분).
   *
   * 응답 id 는 전부 문자열이다(2026-08-06 공통 규약) — JS 안전 정수를 넘는 BIGINT 가
   * number 로 파싱되면 끝자리가 조용히 바뀐다. 절대 number 로 되돌리지 말 것.
   * 요청은 숫자·문자열 둘 다 받으므로 받은 문자열을 그대로 실어 보내면 된다.
   */
  cartItemId: string;
  productId: string;
  name: string;
  brandId: string;
  brandName: string;
  imageUrl: string;
  // 옵션 없는 상품은 null. 문자열인 이유는 ProductOption 주석 참조(64비트 ID)
  optionId: string | null;
  optionName: string | null; // "화이트/M" — 슬래시로 구분. 옵션 없는 상품은 null
  quantity: number;
  price: number; // 현재가(담은 시점 가격 아님)
  originalPrice: number; // 정가 — 할인 표시·합산용
  // 품절·판매종료 상품도 목록에 남는다 — 합계·주문에서만 제외된다
  purchaseState: PurchaseState;
  /**
   * 수량 스테퍼 상한 — 서버가 min(재고, 담기 상한 99)을 계산해 내린다(C-1, 2026-08-05).
   * 재고 숫자를 받아 FE가 99와 비교하면 서버 규칙을 FE가 아는 게 되므로 계산된 값을 받는다.
   * 조회 시점 스냅샷이라 담기 실패(CART_STOCK_INSUFFICIENT)는 그대로 남는다.
   */
  maxQuantity: number;
}

// 장바구니 전체 — 합계는 서버 계산값을 그대로 쓴다(FE 계산 금지).
export interface Cart {
  items: CartItem[];
  totalOriginal: number;
  totalSale: number;
  discount: number;
}
