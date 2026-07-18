import { api } from "@/shared/api/client";
import type { Category, PopularProduct } from "./types";

// 인터셉터가 봉투({success,data})를 벗긴 뒤 data 안의 목록 키를 꺼낸다 (API 명세 기준)
export async function fetchCategories(): Promise<Category[]> {
  const { data } = await api.get<{ categories: Category[] }>("/api/categories");
  return data.categories;
}

// size 미지정 시 백엔드 기본값(12) 사용
export async function fetchPopularProducts(
  size?: number,
): Promise<PopularProduct[]> {
  const { data } = await api.get<{ items: PopularProduct[] }>(
    "/api/products/popular",
    { params: size ? { size } : undefined },
  );
  return data.items;
}
