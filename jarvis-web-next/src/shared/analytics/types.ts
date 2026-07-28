// 행동 이벤트 수집 계약 — 백엔드 POST /api/events (E-1, 2026-07-17 확정)와 1:1.

// 8종 화이트리스트. 그 외 타입은 서버가 버리므로(경고 로그) 타입으로 막는다.
export type BehaviorEventType =
  | "session_start"
  | "page_view"
  | "search"
  | "product_view"
  | "add_to_cart"
  | "checkout_start"
  | "purchase_complete"
  | "login";

// properties에 개인정보를 넣지 않는다(명세). 식별자·금액·수량 등 집계용 값만.
export type EventProperties = Record<string, string | number | boolean | null>;

export interface BehaviorEvent {
  id: string; // client_event_id — 서버 UNIQUE로 중복 영구 차단
  sessionKey: string;
  eventType: BehaviorEventType;
  productId?: number;
  properties?: EventProperties;
  occurredAt: string; // 발생 시각(로컬). 서버는 created_at을 수신 시각으로 별도 기록
}
