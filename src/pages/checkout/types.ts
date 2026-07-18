import type { ProductCard } from "@/shared/types/chat";

// 결제 화면으로 넘어온 주문 항목 — 상세 "바로 구매"에서 선택한 옵션·수량을 담는다.
// 상품 원본(가격/이미지/브랜드)은 카드 데이터를 그대로 승계해 재조회 없이 렌더.
export interface CheckoutItem {
  product: Pick<
    ProductCard,
    "productId" | "name" | "price" | "originalPrice" | "imageUrl"
  > &
    // 장바구니 경유 주문에는 브랜드가 없다(GET /api/cart 응답에 brand 필드 없음).
    Partial<Pick<ProductCard, "brandName">>;
  // 옵션 표기는 진입 경로에 따라 다르다:
  // 상세 "바로 구매"는 그룹명→선택값 맵, 장바구니 경유는 서버가 준 optionName 문자열.
  options?: Record<string, string>;
  optionName?: string | null;
  quantity: number;
}

// navigate("/checkout", { state })로 전달되는 페이로드.
// 새로고침 시 state가 사라지는 건 의도된 동작(주문 데이터는 서버 원본이 아직 없음).
export interface CheckoutState {
  items: CheckoutItem[];
}

// 배송지 — 계약 전 placeholder. 실제로는 회원 배송지 API로 대체.
export interface Address {
  id: string;
  label: string; // "집", "회사"
  recipient: string;
  phone: string;
  address: string;
  isDefault?: boolean;
}

// 결제 완료 후 완료 화면으로 넘기는 주문 결과.
// 주문 생성 API 계약 전이라 주문번호·금액은 목으로 만들어 넘긴다.
export interface OrderResult {
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
