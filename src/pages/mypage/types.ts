// 마이페이지 데이터 계약 — mocks/handlers.ts와 1:1. 변경 시 목과 함께 갱신.

// 주문 건별 배송 상태 (별도 배송 조회 페이지 없음 — 이 값으로 상태 표시)
export type OrderStatus =
  | "PREPARING" // 배송준비중
  | "SHIPPING" // 배송중
  | "DELIVERED" // 배송완료
  | "CONFIRMED"; // 구매확정

// 주문 항목 — 상세 캐시 시딩을 위해 카드 수준 데이터를 포함(브랜드/이미지/가격)
export interface OrderItem {
  productId: number;
  name: string;
  brand: string;
  imageUrl: string;
  option: string; // "아이보리 / S" 형태 표시값
  quantity: number;
  price: number; // 결제 단가
}

export interface Order {
  orderId: string; // "ORD-20250601"
  orderedAt: string; // ISO 날짜 (YYYY-MM-DD)
  status: OrderStatus;
  items: OrderItem[];
}

// 주문 배송지 스냅샷 — 주문 시점 배송 정보(현재 배송지 관리와 별개로 고정 저장).
export interface OrderShipping {
  recipient: string;
  phone: string;
  zipCode: string; // "06292"
  address: string; // 도로명 기본주소 + 상세주소 합친 표시값
  request: string; // 배송 요청사항 ("" 가능)
}

// 주문 상세 — 목록(Order)에 배송지·결제·금액 분해를 더한 단건 조회 응답.
// checkout OrderResult와 동일한 금액 모델(상품금액/할인/배송비/총액).
export interface OrderDetail extends Order {
  shipping: OrderShipping;
  paymentMethod: string; // 표시값 "신용카드", "카카오페이" 등
  itemsTotal: number; // 상품 금액 합계
  discount: number; // 할인 금액(양수)
  shippingFee: number; // 배송비
  finalTotal: number; // 최종 결제 금액
}

// 최근 본 상품 — 카드 표시용. 상세 진입 시 캐시 시딩하도록 카드 수준 데이터 포함.
// viewedAt으로 최신순 정렬(서버가 정렬해 내려주는 것을 기준으로 표시).
export interface RecentProduct {
  productId: number;
  name: string;
  brand: string;
  imageUrl: string;
  price: number;
  viewedAt: string; // ISO 일시 — 최신순 정렬 기준
}

// 찜한 상품 — 카드 표시용(상세 캐시 시딩) + 찜 등록 시각(최신순 정렬 기준).
export interface WishlistProduct {
  productId: number;
  name: string;
  brand: string;
  imageUrl: string;
  price: number;
  wishedAt: string; // ISO 일시 — 최신순 정렬 기준
}

// 취소·반품 신청 종류
export type ClaimType =
  | "CANCEL" // 취소 (배송 전)
  | "RETURN"; // 반품(환불)

// 신청 처리 상태 (스크린샷: 처리중 / 완료)
export type ClaimStatus =
  | "REQUESTED" // 접수
  | "PROCESSING" // 처리중
  | "COMPLETED" // 완료
  | "REJECTED"; // 반려

export interface Claim {
  claimId: string; // "CLM-20250520"
  orderId: string; // 원 주문번호 "ORD-20250515"
  productId: number;
  productName: string;
  type: ClaimType;
  status: ClaimStatus;
  reason: string; // 사유 표시값 "단순 변심"
  requestedAt: string; // ISO 날짜 (YYYY-MM-DD) — 최신순 정렬 기준
}

// 반품 신청 요청 — 주문 내역에서 접수. 백엔드 POST /api/mypage/claims 계약.
// detail(상세 설명)은 선택. type은 RETURN(반품)만 이 흐름에서 사용.
export interface CreateClaimRequest {
  orderId: string;
  productId: number;
  type: ClaimType;
  reason: string;
  detail?: string;
}

// 문의 처리 상태 (스크린샷: 처리중 / 답변완료) — 문의 챗봇에서 접수, 읽기 전용.
export type InquiryStatus =
  | "PENDING" // 처리중 (관리자 답변 대기)
  | "ANSWERED"; // 답변완료

// 문의 내역 — 문의 챗봇(9번)에서 접수한 문의. 답변완료 시 answer 포함.
export interface Inquiry {
  inquiryId: string; // "INQ-20250602"
  title: string; // "환불 처리 기간이 얼마나 걸리나요?"
  status: InquiryStatus;
  content: string; // 문의 본문
  answer: string | null; // 답변 (PENDING이면 null)
  createdAt: string; // ISO 날짜 (YYYY-MM-DD) — 최신순 정렬 기준
  answeredAt: string | null; // 답변 일시 (PENDING이면 null)
}

// 후기 작성 요청 — 백엔드 POST /api/reviews 계약. 사진은 백엔드 붙을 때 필드 추가.
export interface CreateReviewRequest {
  orderId: string;
  productId: number;
  rating: number; // 1~5
  content: string;
}

// 배송지 타입은 결제 화면과 공유 — shared/types/address.ts 참조.
