import { api } from "@/shared/api/client";
import type { ProductCard } from "@/shared/types/chat";

// 인기상품 응답(GET /api/products/popular, P-4) — 채팅 초기 화면 카드로 변환해 사용.
// 단순 집계라 추천 이유가 없다(reason은 LLM 추천 카드에만 존재).
interface PopularProductRaw {
  productId: number;
  name: string;
  brandName: string;
  imageUrl: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviewCount: number;
}

// 인기상품 → 채팅 ProductCard. reason은 LLM 추천이 아니므로 빈 문자열
// (카드 렌더러가 빈 값이면 이유 영역을 그리지 않음)
function toProductCard(p: PopularProductRaw): ProductCard {
  return {
    productId: p.productId,
    name: p.name,
    brandName: p.brandName,
    price: p.price,
    originalPrice: p.originalPrice,
    imageUrl: p.imageUrl,
    rating: p.rating,
    reviewCount: p.reviewCount,
    reason: "",
  };
}

// 채팅 초기 표시용 인기상품.
// 명세(P-4)의 파라미터는 size뿐이라 categoryId는 보내지 않는다.
// 카테고리별 인기상품이 필요하면 백엔드에 파라미터 추가를 요청해야 한다.
export async function fetchPopularAsCards(
  size?: number,
): Promise<ProductCard[]> {
  const { data } = await api.get<{ items: PopularProductRaw[] }>(
    "/api/products/popular",
    { params: size ? { size } : undefined },
  );
  return data.items.map(toProductCard);
}
