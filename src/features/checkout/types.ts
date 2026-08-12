import type { Address } from "@/shared/types/address";
import type { CheckoutItem } from "@/shared/types/checkout";

// 주문 항목 전달 계약(CheckoutItem·CheckoutState)은 상세·장바구니에서도 만들므로
// shared/types/checkout.ts로 승격됨. 이 파일에는 checkout 내부 계약만 남긴다.
export type { CheckoutItem, CheckoutState } from "@/shared/types/checkout";

// ── 주문 생성 (O-1) ────────────────────────────────────────────
// 라인아이템 출처는 cartItemIds / items 중 정확히 하나만 보낸다(둘 다·둘 다 없음 400).
// 금액 필드는 보내지 않는다 — 서버가 스냅샷 가격으로 재계산(클라이언트 신뢰 안 함).

export interface OrderAddressInput {
  recipient: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2?: string;
}

export interface DirectOrderItem {
  // productId·optionId 모두 문자열이다 — 64비트 ID(ProductOption 주석 참조)
  productId: string;
  optionId?: string;
  quantity: number;
}

export interface CreateOrderRequest {
  // 요청 id 는 숫자·문자열 모두 수용된다(2026-08-06 공통 규약) — 응답에서 받은
  // 문자열을 변환 없이 그대로 실어 보낸다. 숫자로 만들면 그 과정에서 끝자리가 바뀐다.
  cartItemIds?: string[];
  items?: DirectOrderItem[];
  addressId?: string;
  address?: OrderAddressInput;
  deliveryRequest?: string;
  paymentMethod: PaymentMethod;
}

// MOCK_FAIL은 무조건 실패(시연 재현용), 그 외는 무조건 성공 — 랜덤 실패 없음.
export type PaymentMethod = "MOCK_CARD" | "MOCK_FAIL";

/**
 * 결제 실패 사유(O-1·O-2, 2026-08-05). 성공(PAID)이면 null.
 *
 * 재결제가 의미 있는지가 갈린다 — 카드 거절은 다시 시도하면 되지만,
 * 재고 부족은 재결제해도 절대 성공하지 않으므로 장바구니로 보내야 한다.
 * 이 필드가 없던 동안 사용자는 실패한 재결제를 무한히 반복할 수 있었다.
 */
export type PaymentFailureReason = "MOCK_DECLINED" | "OUT_OF_STOCK";

// 결제 성공·실패 모두 HTTP 200. 결과는 status로 구분한다.
export interface CreateOrderResponse {
  // 응답 id 는 문자열(2026-08-06 공통 규약)
  orderId: string;
  orderNo: string;
  status: "PAID" | "PAYMENT_FAILED";
  // O-2 재결제도 같은 모양으로 온다. 구버전 응답 대비로 optional.
  failureReason?: PaymentFailureReason | null;
}

// 배송지 타입은 마이페이지와 공유 — shared/types/address.ts 참조.

// 결제 완료 후 완료 화면으로 넘기는 주문 결과.
// orderId·orderNo는 서버가 발급한 값. 금액은 화면 표시용(정본은 주문 상세 API).
export interface OrderResult {
  orderId: string;
  orderNo: string;
  items: CheckoutItem[];
  address: Address;
  method: string;
  itemsTotal: number;
  discount: number;
  finalTotal: number;
}

// router.push("/checkout/complete", { state })로 전달되는 페이로드.
export interface OrderCompleteState {
  order: OrderResult;
}
