// 액션 실패 사유(계약 CH-2 §action).
// message는 AI가 조립한 사용자 노출 문구 → FE는 그대로 표시하고 reason으로만 분기.
export type ActionFailReason =
  | "PRODUCT_NOT_FOUND"
  | "STOCK_INSUFFICIENT" // 재고 부족·품절(OUT_OF_STOCK 통합)
  | "CART_ERROR" // 운영 오류 또는 수량 상한 초과(합산>99)
  | "WISHLIST_ERROR"; // 찜 추가·해제의 그 밖의 실패(2026-08-05 신설)

/**
 * SSE action 이벤트 페이로드(계약 CH-2 §action, 2종 → 10종 확장 2026-08-05 #116·#117).
 * 근거 계약은 I-24(삭제)·I-25(수량 변경)·I-26(찜 추가)·I-27(찜 해제).
 *
 * "이미 그 상태"인 경우는 실패가 아니라 성공으로 온다 — 사용자 목표 상태가 같기 때문이다.
 * (404 CART_ITEM_NOT_FOUND → CART_REMOVED, 409 WISHLIST_DUPLICATE → WISHLIST_ADDED,
 *  404 WISHLIST_NOT_FOUND → WISHLIST_REMOVED)
 */
export type ChatAction =
  // ── SHOPPING : 장바구니 ──
  // cartItemId 는 문자열이다(2026-08-06 공통 규약) — BIGINT 라 number 로 파싱하면
  // 끝자리가 조용히 바뀐다. CartItem.cartItemId 와 같은 축이라 타입도 같아야 한다.
  | { type: "CART_ADDED"; message: string; cartItemId: string }
  | { type: "CART_ADD_FAILED"; message: string; reason: ActionFailReason }
  // CART_REMOVED 도 담기와 같은 필드로 항목 id 를 싣는다(§2.6).
  | { type: "CART_REMOVED"; message: string; cartItemId: string }
  | { type: "CART_REMOVE_FAILED"; message: string; reason: ActionFailReason }
  // 수량 변경 2종은 계약에만 있고 AI 가 아직 발행하지 않는다(I-25 미구현, 대응 이슈 없음).
  // 계약이 확정이라 수신부를 미리 둔다 — 켜질 때 FE 배포를 기다리지 않게.
  | {
      type: "CART_QUANTITY_CHANGED";
      message: string;
      cartItemId: string;
      quantity: number;
    }
  | {
      type: "CART_QUANTITY_CHANGE_FAILED";
      message: string;
      reason: ActionFailReason;
    }
  // ── SHOPPING : 찜 ──
  // 찜 이벤트는 식별자를 싣지 않는다 — 구매자 SSE 가 상품 id 를 싣지 않는 경로 B를 지킨다(§2.6).
  // FE 는 type 만 보고 찜 목록을 재조회한다.
  // 게스트 찜 발화는 action 이 아예 오지 않는다 — 회원 전용(M-4)이라 token 로그인 안내로 degrade.
  | { type: "WISHLIST_ADDED"; message: string }
  | { type: "WISHLIST_ADD_FAILED"; message: string; reason: ActionFailReason }
  | { type: "WISHLIST_REMOVED"; message: string }
  | { type: "WISHLIST_REMOVE_FAILED"; message: string; reason: ActionFailReason }
  // ── SELLER ──
  | { type: "PRODUCT_UPDATED"; message: string; productId: string }
  | { type: "PRODUCT_UPDATE_FAILED"; message: string; productId: string };

/**
 * 장바구니가 실제로 바뀐 액션인가 — 성공 3종만 해당한다(실패는 서버 상태가 그대로다).
 * 재조회 대상을 화면이 아니라 계약 옆에 두는 이유: action type 이 늘어날 때
 * 갱신해야 할 곳이 여기 하나이길 바라서다(2종 → 10종 확장에서 실제로 겪은 문제).
 */
export function isCartMutatingAction(action: ChatAction): boolean {
  return (
    action.type === "CART_ADDED" ||
    action.type === "CART_REMOVED" ||
    action.type === "CART_QUANTITY_CHANGED"
  );
}

/** 찜 목록이 실제로 바뀐 액션인가 — 성공 2종만. 찜 이벤트엔 productId 가 없어 목록 재조회뿐이다. */
export function isWishlistMutatingAction(action: ChatAction): boolean {
  return action.type === "WISHLIST_ADDED" || action.type === "WISHLIST_REMOVED";
}
