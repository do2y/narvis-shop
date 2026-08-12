// 마이페이지 데이터 계약 — mocks/handlers.ts와 1:1. 변경 시 목과 함께 갱신.

import type { PurchaseState } from "@/shared/types/product";

// 주문 상태 — 아이템 단위 상태. 주문 대표 상태(representativeStatus)도 같은 값을 쓴다.
// 명세에는 한국어 표시 문자열("배송중")로 적혀 있으나 실제 응답은 영문 enum이라
// 여기에 맞추고 표시 문자열은 프론트에서 매핑한다(ORDER_STATUS_LABEL).
// 취소·반품은 주문 상태가 아니라 클레임(Claim)으로 관리된다. 주문 쪽은 진행 여부만
// CLAIM_IN_PROGRESS로 알리고, 취소/반품 구분과 처리 단계는 Claim이 답한다.
export type OrderStatus =
  | "PENDING" // 결제 대기
  | "PAYMENT_FAILED" // 결제 실패 — 재결제 가능
  | "ORDERED" // 주문 완료
  | "SHIPPING" // 배송중
  | "DELIVERED" // 배송 완료
  | "CONFIRMED" // 구매확정
  | "CLAIM_IN_PROGRESS" // 취소·반품 처리 중
  // 서버는 클레임 종류까지 구분해 내려준다(판매자 SellerClaimStatus 와 같은 어휘).
  // CLAIM_IN_PROGRESS 로 뭉뚱그리지 않는 이유: 구매자에게 "취소 요청"과 "반품 요청"은
  // 이후 절차가 다르다 — 반품은 물건을 보내야 하고 취소는 아니다.
  | "CANCEL_REQUESTED" // 취소 요청 — 접수됐고 승인 대기
  | "RETURN_REQUESTED" // 반품 요청 — 접수됐고 승인 대기
  | "CANCELLED" // 취소 완료 — 클레임이 승인돼 종결된 줄
  | "RETURNED" // 반품 완료
  | "COMPLETED"; // 처리 완료(클레임 종결 포함)

// 알 수 없는 상태가 와도 화면이 깨지지 않도록 fallback을 둔다
// (백엔드가 상태를 추가해도 목록은 계속 뜨게).
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "결제 대기",
  PAYMENT_FAILED: "결제 실패",
  ORDERED: "주문 완료",
  SHIPPING: "배송중",
  DELIVERED: "배송 완료",
  CONFIRMED: "구매확정",
  CLAIM_IN_PROGRESS: "취소/반품 처리중",
  // 판매자 화면은 "취소요청"·"반품요청"(받은 요청을 처리할 대상으로 봄).
  // 구매자 쪽은 "-중"을 붙여 승인 대기 상태임을 드러낸다 — "요청함"은 행위가
  // 끝난 것처럼 읽혀 아직 확정 전이라는 사실이 가려진다.
  CANCEL_REQUESTED: "취소 요청 중",
  RETURN_REQUESTED: "반품 요청 중",
  CANCELLED: "취소 완료",
  RETURNED: "반품 완료",
  COMPLETED: "처리 완료",
};

// 주문 항목 — 상세 캐시 시딩을 위해 카드 수준 데이터를 포함(이미지/가격).
export interface OrderItem {
  // 응답 id 는 전부 문자열이다(2026-08-06 공통 규약). BIGINT 가 number 로 파싱되면
  // 끝자리가 조용히 바뀌고, === 비교·Map 키에서 엉뚱한 줄이 잡힌다.
  orderItemId: string;
  productId: string;
  productName: string;
  imageUrl: string;
  optionName: string | null; // 옵션 없는 상품은 null
  quantity: number;
  price: number; // 주문 시점 스냅샷 단가
  status: OrderStatus;
}

export interface Order {
  orderId: string;
  orderNo: string; // "ORD-20260713-1001" — 파생값(저장 안 함)
  orderedAt: string; // ISO 일시
  representativeStatus: OrderStatus; // 아이템 상태들에서 도출한 대표 상태
  totalAmount: number;
  items: OrderItem[];
}

// 페이지네이션 응답 — GET /api/orders는 { content, page, size, ... } 형태.
export interface OrderPage {
  content: Order[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// 주문 배송지 스냅샷 — 주문 시점 배송 정보(현재 배송지 관리와 별개로 고정 저장).
export interface OrderShipping {
  recipient: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2?: string | null;
}

// 주문 결제 상태 — 배송 진행 상태(OrderStatus)와 별개 축이다.
export type OrderPaymentStatus = "PENDING" | "PAID" | "PAYMENT_FAILED";

// 주문 상세 아이템 — 목록 아이템에 원가와 액션 가능 여부가 더해진다.
export interface OrderDetailItem extends OrderItem {
  originalPrice: number;
  canCancel: boolean;
  canReturn: boolean;
  canReview: boolean;
}

// 주문 상세 — 단건 조회 응답. 금액 분해(할인·배송비)는 서버가 주지 않아
// 화면에서 items로 계산한다.
export interface OrderDetail extends Omit<Order, "items"> {
  status: OrderPaymentStatus;
  paymentMethod: string; // "MOCK_CARD" 등
  paidAt: string | null;
  // 주문 1회성 배송 지시 — 값이 없으면 키 자체가 생략된다.
  deliveryRequest?: string;
  address: OrderShipping;
  items: OrderDetailItem[];
}

// 최근 본 상품 — behavior_events의 product_view 기반(중복 제거 후 최신 20개).
// 정렬은 서버가 최신순으로 내려준 것을 그대로 쓴다(응답에 viewedAt은 없음).
// 필드 구성은 찜 목록(WishlistProduct)과 동일한 카드 계약이다.
export interface RecentProduct {
  productId: string;
  name: string;
  brandName: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  // 본 뒤 품절·판매종료된 상품도 목록에 남는다
  purchaseState: PurchaseState;
}

// 찜 타입은 상품 상세·챗봇과 공유 — shared/types/wishlist.ts 참조.

// 취소·반품 신청 종류
export type ClaimType =
  | "CANCEL" // 취소 (배송 전)
  | "RETURN"; // 반품(환불)

/**
 * 이 상태의 주문 상품에 해당 신청을 걸 수 있는가 — 버튼 노출 판정.
 *
 * 최종 허용은 서버가 정한다(FE 판정을 통과해도 CLAIM_NOT_ALLOWED 가 올 수 있다).
 * 여기서 거르는 목적은 **눌러도 반드시 거부될 버튼을 처음부터 안 보이게** 하는 것이다.
 *
 * 경계는 배송이다: 아직 안 갔으면 취소, 받았으면 반품. 배송중(SHIPPING)은 둘 다
 * 불가라 어느 쪽 버튼도 뜨지 않는다 — 이 구간은 서버 매트릭스도 막는다.
 * PENDING·PAYMENT_FAILED 는 결제가 성립하지 않아 취소할 결제가 없다.
 *
 * CONFIRMED(구매확정)에는 반품도 뜨지 않는다 — 확정은 "이 거래를 끝냈다"는
 * 사용자 선언이라 되돌릴 대상이 아니다. 후기는 확정 뒤에도 쓸 수 있어
 * canReviewItemStatus 와 허용 상태가 갈린다(같아 보여도 합치지 말 것).
 */
export function canClaimItem(status: OrderStatus, type: ClaimType): boolean {
  if (type === "CANCEL") return status === "ORDERED";
  return status === "DELIVERED";
}

/**
 * 취소·반품으로 빠진 줄인가 — 진행 중과 종결을 함께 본다.
 *
 * 사용자에겐 "이 상품은 안 온다"는 한 가지 사실이라 처리 단계로 나누지 않는다.
 * 세부 진행은 클레임 내역(/mypage/claims)이 답한다.
 */
export function isClaimedItemStatus(status: OrderStatus): boolean {
  return (
    status === "CLAIM_IN_PROGRESS" ||
    status === "CANCEL_REQUESTED" ||
    status === "RETURN_REQUESTED" ||
    status === "CANCELLED" ||
    status === "RETURNED"
  );
}

/**
 * 한 주문 안에서 상품별 상태가 갈리는가 — 목록 카드의 아이템별 배지 노출 판정.
 *
 * 대표 상태(representativeStatus)는 주문에 하나뿐이라, 4개 중 1개만 취소해도
 * 주문 전체가 "취소/반품 처리중"으로 보인다. 어느 상품이 취소된 것인지
 * 목록에서 알 수 없어, 취소하지 않은 상품까지 취소된 줄로 읽힌다.
 *
 * 그래서 상태가 섞인 주문에서만 각 줄에 상태를 덧붙인다. 전부 같은 상태면
 * 대표 배지가 이미 답이라 줄마다 반복하는 것은 노이즈일 뿐이다.
 */
export function hasMixedItemStatus(items: readonly OrderItem[]): boolean {
  return items.some((i) => i.status !== items[0]?.status);
}

/**
 * 주문에서 취소·반품으로 빠진 줄을 종류별로 센다 — 안내 문구·헤더 표기용.
 *
 * 취소와 반품을 묶어 "취소·반품 N개"로 적으면 어느 쪽인지 알 수 없고,
 * 실제로는 한 종류만 있는 경우가 대부분이라 부정확하기까지 하다. 세어서
 * 나눠 두면 호출부가 실제 상태에 맞는 문구를 고를 수 있다.
 *
 * 진행 중(CLAIM_IN_PROGRESS)은 취소·반품 어느 쪽인지 주문 응답만으로 알 수 없다
 * — 그 구분은 클레임(Claim)이 답한다. 그래서 따로 센다.
 *
 * 반면 *_REQUESTED 는 종류가 이미 드러나 있으므로 각각 취소·반품으로 센다.
 * 아직 승인 전이지만 사용자에겐 "이 상품은 빠진다"는 같은 사실이다.
 */
export function countClaimedItems(items: readonly OrderItem[]): {
  cancelled: number;
  returned: number;
  inProgress: number;
  total: number;
} {
  const cancelled = items.filter(
    (i) => i.status === "CANCELLED" || i.status === "CANCEL_REQUESTED",
  ).length;
  const returned = items.filter(
    (i) => i.status === "RETURNED" || i.status === "RETURN_REQUESTED",
  ).length;
  const inProgress = items.filter(
    (i) => i.status === "CLAIM_IN_PROGRESS",
  ).length;
  return {
    cancelled,
    returned,
    inProgress,
    total: cancelled + returned + inProgress,
  };
}

/**
 * 헤더 배지에 쓸 상태 — 항목 상태가 전부 같으면 그것을, 갈리면 대표 상태를 쓴다.
 *
 * 대표 상태(representativeStatus)는 클레임이 얽히면 실제 항목과 어긋난다.
 * 전량 취소된 주문이 "처리 완료"로 뜨는 게 그 예다 — 틀린 말은 아니지만
 * 무엇이 어떻게 끝났는지 답하지 않아, 취소된 주문임을 알 수 없다.
 * 항목이 만장일치일 때는 그 상태가 주문 상태이기도 하므로 그대로 쓴다.
 */
export function resolveHeaderStatus(order: Order): OrderStatus {
  const [first, ...rest] = order.items;
  if (first && rest.every((i) => i.status === first.status)) return first.status;
  return order.representativeStatus;
}

/**
 * 부분 취소·반품 안내 문구 — "상품 4개 중 1개가 취소되었습니다" 형태.
 *
 * 종류가 하나면 그 이름을 쓰고(취소/반품/취소·반품 신청), 섞였을 때만 묶는다.
 * 전부 빠졌거나 하나도 없으면 null — 안내할 "나머지"가 없어 문장이 성립하지 않는다.
 * (전량 취소는 대표 배지가 이미 정확히 답한다)
 */
export function buildClaimedNotice(items: readonly OrderItem[]): string | null {
  const { cancelled, returned, inProgress, total } = countClaimedItems(items);
  if (total === 0 || total === items.length) return null;

  const prefix = `상품 ${items.length}개 중 ${total}개가`;

  // 진행 중만 있으면 아직 끝난 게 아니라 "되었습니다"로 단정할 수 없다
  if (cancelled === 0 && returned === 0) {
    return `${prefix} 취소·반품 신청 중입니다`;
  }
  // 종결된 것 중 한 종류뿐이면 그 이름으로 정확히 적는다 (가장 흔한 경우)
  if (returned === 0 && inProgress === 0) return `${prefix} 취소되었습니다`;
  if (cancelled === 0 && inProgress === 0) return `${prefix} 반품되었습니다`;

  return `${prefix} 취소·반품되었습니다`;
}

/**
 * 이 상태의 주문 상품에 후기를 쓸 수 있는가 — 목록 카드의 버튼 노출 판정.
 *
 * 상세는 이걸 쓰지 않는다. 서버가 아이템마다 주는 `canReview` 가 정본이고,
 * 그쪽은 "이미 작성함"까지 반영한다(상태만으로는 알 수 없다).
 * 목록 응답에는 그 필드가 없어 상태로 근사할 수밖에 없다 — 그래서 목록 버튼은
 * 작성 화면이 아니라 주문 상세로 보낸다.
 */
export function canReviewItemStatus(status: OrderStatus): boolean {
  return status === "DELIVERED" || status === "CONFIRMED";
}

// 신청 처리 상태 — 서버 enum 3종(O-5·O-6)과 일치.
// 시안에 있던 PROCESSING(처리중)은 서버에 없는 값이라 제거했다(2026-08 대조).
export type ClaimStatus =
  | "REQUESTED" // 접수
  | "COMPLETED" // 완료
  | "REJECTED"; // 반려

// 취소·반품 내역 항목 — GET /api/claims 계약.
// 상품 식별은 orderItemId(주문 줄)이며 productId는 내려오지 않는다.
export interface Claim {
  claimId: string;
  orderNo: string; // 원 주문번호 "ORD-20260713-1001"
  type: ClaimType;
  status: ClaimStatus;
  reason: string; // 사유 표시값 "단순 변심"
  requestedAt: string; // ISO 일시(+09:00) — 최신순 정렬 기준
  processedAt: string | null; // 미처리 시 null
  orderItemId: string;
  productName: string;
  optionName: string | null;
  quantity: number;
  refundAmount: number; // price × quantity
}

// 페이지네이션 응답 — GET /api/claims는 { content, page, size, ... } 형태.
export interface ClaimPage {
  content: Claim[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// 취소·반품 신청 요청 — POST /api/order-items/{orderItemId}/claims 계약.
// 대상은 path의 orderItemId로 지정하므로 body에는 종류·사유만 담는다.
// (같은 상품을 옵션만 다르게 담은 주문에서 orderId+productId는 줄을 특정하지 못한다)
export interface CreateClaimRequest {
  type: ClaimType;
  reason?: string;
}

// 신청 접수 응답 — 목록의 Claim과 같은 축이라 id 타입도 같다(문자열).
export interface CreateClaimResponse {
  claimId: string;
  orderItemId: string;
  type: ClaimType;
  status: ClaimStatus;
  requestedAt: string; // ISO 일시(+09:00)
}

// 후기 작성 요청 — POST /api/reviews 계약. 대상은 주문 줄(orderItemId) 기준.
// 등록만 지원하며 수정·삭제 API는 없다(02 D29). 사진은 백엔드 붙을 때 필드 추가.
export interface CreateReviewRequest {
  // 요청 id 는 숫자·문자열 모두 수용된다 — 받은 문자열을 그대로 보낸다
  orderItemId: string;
  rating: number; // 1~5 정수
  // 최대 2000자. 별점만 남기는 경우 빈 문자열로 나간다 — 필드를 빼지 않는 이유는
  // 계약이 필수로 정의돼 있어서다. 서버가 빈 값을 거부하면 계약부터 고쳐야 한다.
  content: string;
}

// 후기 등록 응답 — 작성 후 상품 리뷰 캐시 무효화에 productId가 필요하다.
export interface CreateReviewResponse {
  reviewId: string;
  orderItemId: string;
  productId: string;
  rating: number;
  content: string;
  createdAt: string; // ISO 일시(+09:00)
}

// 배송지 타입은 결제 화면과 공유 — shared/types/address.ts 참조.
