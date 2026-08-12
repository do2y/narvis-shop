// 대시보드 요약 카드·그래프용 표현 타입.
// (판매자 챗 계약 v2에서 metrics/analysis 이벤트가 사라져 챗 타입에서 이리로 옮겼다.
//  대시보드는 GET /api/seller/summary 응답을 이 형태로 매핑해 MetricCards·AnalysisChart에 넘긴다.)

/** 매출·주문 요약 카드 한 칸 */
export interface SellerMetric {
  key: string; // "revenue" | "orders" | "aov" | "conversion" …
  label: string;
  value: number;
  unit: "KRW" | "COUNT" | "PERCENT";
  // 이전 대비 증감률(%). 3-state로 의미가 다르다:
  //  number → 정상 증감률(부호로 상승·하락)  ·  null → 비교 데이터 없음(어제 0 등, "—" 표기)
  //  undefined(필드 없음) → 증감률 개념이 없는 지표(실시간 방문자 등, 줄 자체를 숨김)
  deltaRate?: number | null;
  caption?: string; // "어제 대비"
}

/** 판매 분석 그래프 */
export interface SellerAnalysis {
  title: string;
  chartType: "line" | "bar";
  // PERCENT 는 report.charts(계약 §3.2)가 전환율 차트를 실으면서 추가됐다.
  // 대시보드 매핑은 KRW·COUNT 만 쓰지만 같은 타입을 공유한다.
  unit: "KRW" | "COUNT" | "PERCENT";
  series: { label: string; points: { x: string; y: number }[] }[];
  summary?: string; // AI 한 줄 해석
}

// ── 챗 워크스페이스 ──

/** 오른쪽 작업 영역 목록 종류. 대상 선택은 채팅 자연어로 처리한다(선택 상태 없음). */
export type SellerWorkspaceTab = "orders" | "products";

export interface SellerSummaryParams {
  from?: string; // YYYY-MM-DD, 생략 시 서버가 오늘로
  to?: string;
  lowStockThreshold?: number; // 기본 10, 1~999
  trendDays?: number; // 기본 7, 1~90
}

/**
 * S-1 AI 추천 경유 매출 (2026-08-07 신설).
 *
 * 화면에서 쓰는 4개 필드만 선언한다 — 응답에는 confirmedSales·estimatedSales·
 * funnel·coverage·policyVersion·windowDays·aiOrderCount 도 오지만 이번 카드는 싣지 않는다.
 */
export interface SellerAiAttribution {
  totalSales: number;
  aiSales: number;
  directSales: number;
  // 분모(전체 매출)가 0이면 null — 0%가 아니라 "계산 불가"다.
  // today 의 *ChangeRate 와 같은 규칙이라 표기도 똑같이 "—" 로 맞춘다.
  aiShare: number | null;
}

/**
 * 재고 부족 목록의 한 행 — 상품 목록(SellerProductStat)보다 필드가 적다.
 *
 * 2026-08-09 재고가 옵션별로 내려가면서 **한 줄 = 상품이 아니라 옵션**이 됐다.
 * 한 상품의 여러 옵션이 동시에 부족하면 같은 productId가 여러 줄로 나온다
 * (판매자가 채워넣을 대상이 상품이 아니라 옵션이라 묶지 않는다 — 명세).
 * optionId·optionName은 옵션 없는 상품에서 둘 다 null이다.
 */
export interface SellerLowStockItem {
  productId: string;
  name: string;
  imageUrl: string;
  stockQuantity: number;
  optionId: string | null;
  optionName: string | null;
}

export interface SellerSummary {
  period: { from: string; to: string };

  orderStatus: {
    counts: Record<SellerOrderStatus, number>;
    activeTotal: number; // CANCELLED·RETURNED 제외 합계
    // 배송 완료 건이 없으면 null 이 온다(집계할 표본이 없음).
    // S-1 조인 교체(C 문서, 2026-08-06)로 null 이 나올 확률이 올라가 타입에 명시한다.
    //
    // 화면에는 쓰지 않는다(2026-08-09) — 종전엔 "배송중" 카드에 붙였으나
    // 표본이 없으면 그 줄만 비어 카드 높이가 어긋났다. 서버가 계속 내려주는
    // 필드라 계약은 남긴다.
    avgDeliveryDays: number | null;
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

  // null 가능 — S-1 은 서브쿼리 8개를 한 응답에 묶는데 귀속 집계 3개만 실패를 격리한다
  // (대시보드 전체가 500이 되면 안 되므로). 나머지 5개는 하나만 실패해도 전체 500이지만
  // 이 블록은 실패 시 null 로 내려온다. `| null` 을 빼면 집계가 실패하는 날 런타임에서 터진다.
  aiAttribution: SellerAiAttribution | null;
}

// ── 주문  ──

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
  productId: string;
  name: string;
  imageUrl: string;
  optionName: string;
}

export interface SellerOrder {
  // 응답 id 는 문자열(2026-08-06 공통 규약)
  orderId: string;
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

// 탭 = displayStatus 기준(원본 status가 아님). SOLD_OUT은 status='ON_SALE' AND 재고 0의 파생.
export type SellerProductTab = "ALL" | "ON_SALE" | "SOLD_OUT" | "HIDDEN";

// 원본 product.status — DDL 어휘 2종뿐(SOLD_OUT 없음). 챗봇 수정(I-11)이 토글할 대상.
export type SellerProductRawStatus = "ON_SALE" | "HIDDEN";
// 화면 배지용 파생값 3종 — 서버가 재고·원본status로 산출해 내려준다.
export type SellerProductDisplayStatus = "ON_SALE" | "SOLD_OUT" | "HIDDEN";

export type SellerProductSort = "latest" | "sales" | "stock" | "price";

// S-3 화면 전용. 챗봇용 SellerProductStat(shared)과 필드가 달라 상속하지 않는다
// (code 없음, stockQuantity/displayedSalesCount, displayStatus·createdAt은 화면 전용).
export interface SellerProduct {
  productId: string;
  name: string;
  imageUrl: string;
  category: string; // 소분류(leaf) 이름만
  price: number;
  originalPrice: number; // 화면은 price만 쓰나 할인 배지 확장 대비로 보관
  stockQuantity: number;
  displayedSalesCount: number; // base_sales_count + order_item 집계
  status: SellerProductRawStatus; // 원본(토글 대상)
  displayStatus: SellerProductDisplayStatus; // 배지 표시용
  createdAt: string; // ISO8601 +09:00 (등록일)
  updatedAt: string;
}

export interface SellerProductPage {
  content: SellerProduct[];
  // 필터와 무관하게 항상 전량 기준 — 탭 전환 시 재호출 불필요
  tabCounts: Record<SellerProductTab, number>;
  page: number; // 0-base
  size: number;
  totalElements: number;
  totalPages: number;
}
