import { api } from "@/shared/api/client";
import type { ProductDetail, ProductReviewPage, ReviewSort } from "./types";

export async function fetchProductDetail(id: number): Promise<ProductDetail> {
  const { data } = await api.get<ProductDetail>(`/api/products/${id}`);
  return data;
}

// 상품 후기 (P-3) — 인증 불필요. 없는 상품이면 404 PRODUCT_NOT_FOUND.
// distribution(전체 별점 분포)은 page=0 응답에만 온다 — 재사용은 useProductReviews가 처리.
export async function fetchProductReviews(
  id: number,
  params: { page?: number; size?: number; sort?: ReviewSort } = {},
): Promise<ProductReviewPage> {
  const { data } = await api.get<ProductReviewPage>(
    `/api/products/${id}/reviews`,
    { params },
  );
  return data;
}
