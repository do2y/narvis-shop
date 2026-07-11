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
