import { api } from "@/shared/api/client";
import type {
  SellerDashboard,
  SellerOrderPage,
  SellerOrderStatus,
  SellerProductPage,
  SellerProductTab,
} from "./types";

export async function fetchSellerDashboard(): Promise<SellerDashboard> {
  const { data } = await api.get<SellerDashboard>("/api/seller/dashboard");
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
