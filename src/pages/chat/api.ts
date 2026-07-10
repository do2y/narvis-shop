import { api } from "@/shared/api/client";
import type { ProductCard } from "@/shared/types/chat";

// 인기상품 목 응답(home PopularProduct 계약 + categoryId) — 채팅 카드로 변환해 사용
interface PopularProductRaw {
  productId: number;
  name: string;
  brand: string;
  imageUrl: string;
  price: number;
  listPrice: number;
  rating: number;
  reviewCount: number;
  reason: string;
}

// PopularProduct → 채팅 ProductCard (필드명 매핑: brand→brandName, listPrice→originalPrice)
function toProductCard(p: PopularProductRaw): ProductCard {
  return {
    productId: p.productId,
    name: p.name,
    brandName: p.brand,
    price: p.price,
    originalPrice: p.listPrice,
    imageUrl: p.imageUrl,
    rating: p.rating,
    reviewCount: p.reviewCount,
    reason: p.reason,
  };
}

// 채팅 초기 표시용 인기상품. categoryId 있으면 해당 카테고리만.
export async function fetchPopularAsCards(
  categoryId?: number,
): Promise<ProductCard[]> {
  const { data } = await api.get<{ products: PopularProductRaw[] }>(
    "/api/products/popular",
    { params: categoryId ? { categoryId } : undefined },
  );
  return data.products.map(toProductCard);
}
