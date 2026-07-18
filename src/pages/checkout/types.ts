import type { ProductCard } from "@/shared/types/chat";

// 결제 화면으로 넘어온 주문 항목 — 상세 "바로 구매"에서 선택한 옵션·수량을 담는다.
// 상품 원본(가격/이미지/브랜드)은 카드 데이터를 그대로 승계해 재조회 없이 렌더.
export interface CheckoutItem {
  product: Pick<
    ProductCard,
    "productId" | "name" | "price" | "originalPrice" | "imageUrl"
  > &
    Partial<Pick<ProductCard, "brandName">>;
  // 옵션 표기는 진입 경로에 따라 다르다:
  // 상세 "바로 구매"는 그룹명→선택값 맵, 장바구니 경유는 서버가 준 optionName 문자열.
  options?: Record<string, string>;
  optionName?: string | null;
  // 주문 생성 시 서버로 보내는 옵션 식별자. 옵션 없는 상품은 null.
  optionId?: number | null;
  // 장바구니 경유 주문이면 이 값으로 cartItemIds[]를 만든다(바로 구매는 없음).
  cartItemId?: number;
  quantity: number;
}

// navigate("/checkout", { state })로 전달되는 페이로드.
// 새로고침 시 state가 사라지는 건 의도된 동작(주문 데이터는 서버 원본이 아직 없음).
export interface CheckoutState {
  items: CheckoutItem[];
}

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
  productId: number;
  optionId?: number;
  quantity: number;
}

export interface CreateOrderRequest {
  cartItemIds?: number[];
  items?: DirectOrderItem[];
  addressId?: number;
  address?: OrderAddressInput;
  deliveryRequest?: string;
  paymentMethod: PaymentMethod;
}

// MOCK_FAIL은 무조건 실패(시연 재현용), 그 외는 무조건 성공 — 랜덤 실패 없음.
export type PaymentMethod = "MOCK_CARD" | "MOCK_FAIL";

// 결제 성공·실패 모두 HTTP 200. 결과는 status로 구분한다.
export interface CreateOrderResponse {
  orderId: number;
  orderNo: string;
  status: "PAID" | "PAYMENT_FAILED";
}

// 배송지 — 백엔드 GET /api/addresses 응답과 1:1 (M-8).
export interface Address {
  addressId: number;
  label: string; // "집", "회사"
  recipient: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2?: string;
  isDefault?: boolean;
}

// 배송지 생성·수정 입력. addressId·isDefault는 서버가 관리.
export type AddressInput = Omit<Address, "addressId" | "isDefault">;

// 결제 완료 후 완료 화면으로 넘기는 주문 결과.
// orderId·orderNo는 서버가 발급한 값. 금액은 화면 표시용(정본은 주문 상세 API).
export interface OrderResult {
  orderId: number;
  orderNo: string;
  items: CheckoutItem[];
  address: Address;
  method: string;
  itemsTotal: number;
  discount: number;
  finalTotal: number;
}

// navigate("/checkout/complete", { state })로 전달되는 페이로드.
export interface OrderCompleteState {
  order: OrderResult;
}
