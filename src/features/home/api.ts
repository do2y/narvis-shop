import { api } from "@/shared/api/client";
import type { Category, PopularProduct, RecommendationResult } from "./types";

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

// 개인화 추천 (P-5) — 로그인 필요.
// FastAPI 실패·신규 회원(프로필 없음)은 백엔드가 인기상품으로 대체해 항상 200 + items를
// 주므로 "추천 실패" 분기가 없다. 401만 실패이고 그건 client 인터셉터가 처리.
//
// 봉투 전체를 그대로 반환한다 — source로 표시 여부를 가르고, 상관키 2종은
// 노출·클릭 이벤트(E-1)에 실어야 해서 items만 꺼내면 둘 다 잃는다.
export async function fetchRecommendedProducts(): Promise<RecommendationResult> {
  const { data } = await api.get<RecommendationResult>(
    "/api/products/recommended",
  );
  return data;
}
