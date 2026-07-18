/** 판매자 페이지 API 계약 — 백엔드 확정 전까지 mocks/handlers.ts와 1:1 */
import type { SellerMetric, SellerProductStat } from "@/shared/types/chat";

// ── 대시보드 ──

export interface SellerOrderSummary {
  status: SellerOrderStatus;
  label: string;
  count: number;
  caption: string;
  primary?: boolean; // 강조 카드(새 주문 등)
}

export interface SellerDashboard {
  todo: {
    totalCount: number;
    orderSummaries: SellerOrderSummary[];
    lowStock: SellerProductStat[];
  };
  metrics: SellerMetric[];
  revenueTrend: { x: string; y: number }[];
  aiRevenue: {
    amount: number;
    deltaRate: number;
    contributionRate: number; // AI 추천 매출 기여도(%)
  };
}

// ── 주문 ──

export type SellerOrderStatus =
  | "NEW"
  | "PREPARING"
  | "SHIPPING"
  | "DELIVERED"
  | "CLAIM";

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
