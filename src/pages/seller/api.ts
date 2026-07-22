import { api } from "@/shared/api/client";
import type {
  SellerOrderPage,
  SellerOrderTab,
  SellerProductPage,
  SellerProductTab,
  SellerSummary,
  SellerSummaryParams,
} from "./types";

// 대시보드 전 블록을 한 번에 받는다. 파라미터는 전부 선택 —
// 생략 시 서버 기본값(기간=오늘, threshold=10, trendDays=7)이 적용된다.
export async function fetchSellerSummary(
  params: SellerSummaryParams = {},
): Promise<SellerSummary> {
  const { data } = await api.get<SellerSummary>("/api/seller/summary", {
    params,
  });
  return data;
}

// 주문 목록(주문 단위). page는 0-base. tab이 ALL이면 status를 보내지 않는다(생략=전체).
export async function fetchSellerOrders(params: {
  tab: SellerOrderTab;
  page: number;
  size?: number;
}): Promise<SellerOrderPage> {
  const { tab, page, size } = params;
  const { data } = await api.get<SellerOrderPage>("/api/seller/orders", {
    params: {
      ...(tab !== "ALL" && { status: tab }),
      page,
      ...(size && { size }),
    },
  });
  return data;
}

export async function fetchSellerProducts(params: {
  tab: SellerProductTab;
  page: number;
}): Promise<SellerProductPage> {
  const { data } = await api.get<SellerProductPage>("/api/seller/products", {
    params,
  });
  return data;
}
