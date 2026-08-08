// 행동 이벤트 수집 계약 — 백엔드 POST /api/events (E-1, 2026-07-17 확정)와 1:1.

// FE 전송 10종 화이트리스트. 그 외 타입은 서버가 버리므로(경고 로그) 타입으로 막는다.
//
// 서버 전용 4종(recommendation_generated·add_to_cart·remove_from_cart·purchase_complete)은
// 여기에 없다. HTTP 로 들어오면 드롭되기 때문이다.
//
// 장바구니 2종: BE CartService 가 적재한다(A 문서, 2026-08-06) — FE 가 SSE 경로에서
// quantity·price 를 채울 수 없어 _incomplete 로 쌓이던 문제를, 데이터가 변경되는
// 지점에서 남기는 것으로 해결한 것.
//
// purchase_complete: 주문 성사는 서버가 정본이다. FE 는 결제 성공 응답을 받아야만
// 쏠 수 있어, 응답 직전에 탭이 닫히거나 네트워크가 끊기면 이미 서버에 생성된 주문이
// 집계에서 통째로 빠진다(매출 누락). 적재는 BE 주문 처리에서 한다.
//
// checkout_start 는 FE 에 남는다 — 주문서 진입은 서버로 가는 요청이 없어 FE 만 아는
// 사실이다. 빼면 "주문서 진입 → 결제 완료" 전환율을 만들 수 없다.
export type BehaviorEventType =
  | "session_start"
  | "page_view"
  | "search"
  | "product_view"
  | "checkout_start"
  | "login"
  // 추천 성과 측정 4종(2026-07-28 추가)
  | "recommendation_impression" // 추천 영역이 화면에 나타남
  | "product_visible" // 개별 카드가 실제로 보임 (CTR 분모)
  | "product_click" // 카드를 누름 (CTR 분자)
  | "recommendation_dismiss"; // 추천을 닫음 = 명시적 비선호

/**
 * page_view 의 화면 종류 14종(구매자 10 · 판매자 4).
 * 정본은 E-1 이며 CH-2·S-4 요청의 screen.pageType 이 이 어휘를 공유한다 —
 * 화면을 가리키는 이름은 하나여야 한다.
 */
export type PageType =
  // 구매자 10
  | "home"
  | "category"
  | "search"
  | "product_detail"
  | "cart"
  | "checkout"
  | "order_complete"
  | "my"
  | "chat"
  | "auth"
  // 판매자 4
  | "seller_dashboard"
  | "seller_orders"
  | "seller_products"
  | "seller_chat";

// properties에 개인정보를 넣지 않는다(명세). 식별자·금액·수량 등 집계용 값만.
// 배열을 허용하는 이유: checkout_start.productIds[] 가 판매자 퍼널 3단의 근거라 필수다.
export type EventProperties = Record<
  string,
  string | number | boolean | null | number[] | string[]
>;

/**
 * 추천에서 비롯된 이벤트에만 싣는 선택 필드.
 * 이 2개뿐이며 지면·순위는 서버가 listId 로 조회해 붙인다 — FE 가 보낸 값을 신뢰하지 않는다.
 */
export interface EventRecommendation {
  recommendationRequestId: string;
  listId: string;
}

/**
 * 이벤트 스키마 버전. 필드 추가는 NULL 로 구분되지만 의미 변경은 구분이 안 되므로 남긴다.
 * 전용 컬럼 없이 properties 에 담겨 저장된다(2026-07-30 확정).
 */
export const EVENT_SCHEMA_VERSION = 2;

export interface BehaviorEvent {
  id: string; // client_event_id — 서버 UNIQUE로 중복 영구 차단. 필수(빈 값이면 배치 전체 거부)
  schemaVersion: number;
  sessionKey: string;
  eventType: BehaviorEventType;
  productId?: string;
  recommendation?: EventRecommendation;
  properties?: EventProperties;
  occurredAt: string; // 발생 시각, ISO 8601 UTC(Z). 서버는 created_at을 수신 시각으로 별도 기록
}
