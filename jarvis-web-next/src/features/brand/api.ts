import { api } from "@/shared/api/client";
import type { BrandHome, BrandQuery } from "./types";

// 인터셉터가 봉투({success,data})를 벗기므로 data가 곧 BrandHome.
// 기본값(sort=popular·page=0·size=20)은 백엔드가 갖고 있어 미지정 파라미터는 보내지 않는다.
export async function fetchBrandHome(
  brandId: number,
  query: BrandQuery = {},
): Promise<BrandHome> {
  const { data } = await api.get<BrandHome>(`/api/brands/${brandId}`, {
    params: {
      ...(query.category !== undefined ? { category: query.category } : {}),
      ...(query.sort ? { sort: query.sort } : {}),
      ...(query.page ? { page: query.page } : {}),
      ...(query.size ? { size: query.size } : {}),
    },
  });
  return data;
}
