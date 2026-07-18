import { api } from "@/shared/api/client";
import type { ProductDetail } from "./types";

export async function fetchProductDetail(id: number): Promise<ProductDetail> {
  const { data } = await api.get<ProductDetail>(`/api/products/${id}`);
  return data;
}
