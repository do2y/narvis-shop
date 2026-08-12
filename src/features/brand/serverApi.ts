import { cachedGet, serverGet } from "@/shared/api/server";
import type { BrandHome, BrandQuery } from "./types";

/**
 * 브랜드 홈 — 서버 컴포넌트용. (클라이언트용은 `api.ts`)
 *
 * 쿼리 조합을 하나의 문자열 키로 받는 이유: React `cache()`는 인자를 참조 동등성으로
 * 비교하므로 객체를 그대로 넘기면 매번 다른 인자로 취급되어 중복 제거가 되지 않는다.
 * 원시값 인자로 고정해 generateMetadata와 page의 호출이 1회로 합쳐지게 한다.
 */
const getBrandHomeByKey = cachedGet(
  (brandId: string, search: string): Promise<BrandHome> =>
    serverGet<BrandHome>(
      `/api/brands/${brandId}${search ? `?${search}` : ""}`,
    ),
);

/** 기본값(sort=popular·page=0·size=20)은 백엔드가 갖고 있어 미지정 파라미터는 보내지 않는다. */
export function getBrandHome(
  brandId: string,
  query: BrandQuery = {},
): Promise<BrandHome> {
  const params = new URLSearchParams();
  if (query.category !== undefined) params.set("category", query.category);
  if (query.sort) params.set("sort", query.sort);
  if (query.page) params.set("page", String(query.page));
  if (query.size) params.set("size", String(query.size));
  return getBrandHomeByKey(brandId, params.toString());
}
