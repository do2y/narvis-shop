import { api } from "@/shared/api/client";
import type {
  SellerOrderPage,
  SellerOrderStatus,
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

export async function fetchSellerOrders(params: {
  status: SellerOrderStatus | "ALL";
  page: number;
}): Promise<SellerOrderPage> {
  const { data } = await api.get<SellerOrderPage>("/api/seller/orders", {
    params,
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
