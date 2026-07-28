import { cachedGet, serverGet } from "@/shared/api/server";
import type { Category, PopularProduct } from "./types";

/**
 * 홈 공개 데이터 — 서버 컴포넌트용. (클라이언트용은 `api.ts`)
 *
 * 개인화 추천(`/api/products/recommended`)은 로그인이 필요해 여기 없다 —
 * 서버는 AT를 갖고 있지 않으므로 그대로 클라이언트에서 조회한다(계획서 비목표).
 *
 * 카테고리·인기상품은 자주 바뀌지 않는 큐레이션이라 30분 재검증으로 캐시한다
 * (클라이언트 staleTime 30분과 같은 값 — 서버·클라이언트 판단을 맞춘다).
 */
const THIRTY_MIN_SEC = 30 * 60;

export const getCategories = cachedGet(async (): Promise<Category[]> => {
  const data = await serverGet<{ categories: Category[] }>("/api/categories", {
    revalidate: THIRTY_MIN_SEC,
  });
  return data.categories;
});

export const getPopularProducts = cachedGet(
  async (size?: number): Promise<PopularProduct[]> => {
    const data = await serverGet<{ items: PopularProduct[] }>(
      `/api/products/popular${size ? `?size=${size}` : ""}`,
      { revalidate: THIRTY_MIN_SEC },
    );
    return data.items;
  },
);
