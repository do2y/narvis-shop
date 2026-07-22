/** 판매자 페이지 API 계약 — 백엔드 확정 전까지 mocks/handlers.ts와 1:1 */
import type { SellerProductStat } from "@/shared/types/chat";

// ── 대시보드 (S-1 GET /api/seller/summary, 2026-07-21 개정) ──
//
// 대시보드 진입 1회 호출로 전 블록을 덮는다(별도 엔드포인트로 분리하지 않음).
// brandId는 서버가 JWT의 memberId에서 도출 — 클라이언트는 보내지 않는다(IDOR 방지).

export interface SellerSummaryParams {
  from?: string; // YYYY-MM-DD, 생략 시 서버가 오늘로
  to?: string;
  lowStockThreshold?: number; // 기본 10, 1~999
  trendDays?: number; // 기본 7, 1~90
}

/** 재고 부족 목록의 한 행 — 상품 목록(SellerProductStat)보다 필드가 적다 */
export interface SellerLowStockItem {
  productId: number;
  name: string;
  imageUrl: string;
  stockQuantity: number;
}

export interface SellerSummary {
  period: { from: string; to: string };

  orderStatus: {
    counts: Record<SellerOrderStatus, number>;
    activeTotal: number; // CANCELLED·RETURNED 제외 합계
    avgDeliveryDays: number;
  };

  today: {
    sales: number;
    orderCount: number;
    avgOrderValue: number;
    activeVisitors: number;
    // 어제가 0이면 null — 화면은 "—"로 표기한다(0%와 구분)
    salesChangeRate: number | null;
    orderCountChangeRate: number | null;
    avgOrderValueChangeRate: number | null;
  };

  salesTrend: {
    total: number;
    points: { date: string; sales: number }[];
  };

  lowStock: {
    threshold: number;
    count: number; // items는 상위 일부만 올 수 있어 전체 수는 이 값을 쓴다
    items: SellerLowStockItem[];
  };

  // 화면에는 쓰지 않는다 — AI 채팅·타 화면이 소비하는 상품 퍼널 데이터
  products: {
    productId: number;
    name: string;
    viewCount: number;
    cartCount: number;
    salesCount: number;
  }[];
}

// ── 주문 ──

// order_item.status 정본 6종 (I-19와 동일 어휘, 교환 없음).
// PREPARING은 enum에 없어 2026-07-21자로 화면·탭에서 삭제됨 —
// 운송장 컬럼이 DDL에 없어 "배송 준비/송장 대기"를 산출할 수 없다.
export type SellerOrderStatus =
  | "ORDERED"
  | "SHIPPING"
  | "DELIVERED"
  | "CONFIRMED"
  | "CANCELLED"
  | "RETURNED";

export interface SellerOrder {
  orderId: string;
  productName: string;
  productImageUrl: string;
  extraItemCount: number; // "외 N건"
  ordererName: string;
  amount: number;
  payMethod: string;
  orderedAt: string;
  status: SellerOrderStatus;
}

export interface SellerOrderPage {
  orders: SellerOrder[];
  page: number;
  totalPages: number;
  counts: Record<SellerOrderStatus | "ALL", number>;
}

// ── 상품 ──

export type SellerProductTab = "ALL" | "ON_SALE" | "SOLD_OUT" | "HIDDEN";

export interface SellerProduct extends SellerProductStat {
  categoryName: string;
  createdAt: string;
}

export interface SellerProductPage {
  products: SellerProduct[];
  page: number;
  totalPages: number;
  counts: Record<SellerProductTab, number>;
}
