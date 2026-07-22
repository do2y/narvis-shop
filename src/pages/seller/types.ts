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

// ── 주문 (S-2 GET /api/seller/orders, 2026-07-21 개정 · 아이템→주문 단위) ──

// 대표 상태 배지에 실려오는 order_item.status 정본 6종 (I-19와 동일 어휘, 교환 없음).
// 탭 필터(SellerOrderTab)와 다르다 — 탭은 4종으로 접지만 배지는 6종이 다 온다.
// (예: DELIVERED·CONFIRMED는 "배송완료" 한 탭, CANCELLED·RETURNED는 "취소·반품" 한 탭)
export type SellerOrderStatus =
  | "ORDERED"
  | "SHIPPING"
  | "DELIVERED"
  | "CONFIRMED"
  | "CANCELLED"
  | "RETURNED";

// 활성 클레임(claim.status=REQUESTED)이 있으면 배지를 이 값으로 덮어쓴다.
// 없으면 null → status 사용. (PREPARING 탭은 enum에 PREPARING이 없어 2026-07-21 삭제)
export type SellerClaimStatus = "CANCEL_REQUESTED" | "RETURN_REQUESTED";

// 목록 상단 탭 필터 값 — 서버 status 파라미터로 그대로 전달(ALL은 미전송).
// 취소·반품은 CLAIM 하나로 접는다(계약 §탭↔상태 매핑).
export type SellerOrderTab =
  | "ALL"
  | "ORDERED"
  | "SHIPPING"
  | "DELIVERED"
  | "CLAIM";

/** 주문의 대표 상품 — 자사 아이템 중 금액 최대 1건 */
export interface SellerOrderRepProduct {
  productId: number;
  name: string;
  imageUrl: string;
  optionName: string;
}

export interface SellerOrder {
  orderId: number;
  orderNo: string; // "ORD-20260716-0342" — 화면은 ORD- 접두사를 떼고 표시
  orderedAt: string; // ISO8601 +09:00
  recipientName: string; // 배송지 수령인명(마스킹 없음)
  paymentMethod: string; // MVP: MOCK_CARD / MOCK_FAIL
  myItemsAmount: number; // 자사 아이템 스냅샷 가격 합(타사 금액 제외)
  myItemCount: number; // 자사 아이템 수 → "외 (myItemCount-1)건"
  representativeProduct: SellerOrderRepProduct;
  status: SellerOrderStatus;
  claimStatus: SellerClaimStatus | null; // 있으면 배지를 취소요청/반품요청으로 덮어씀
}

export interface SellerOrderPage {
  content: SellerOrder[];
  // 필터와 무관하게 항상 전량 기준 — 탭 전환 시 재호출 불필요
  tabCounts: Record<SellerOrderTab, number>;
  page: number; // 0-base
  size: number;
  totalElements: number;
  totalPages: number;
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
