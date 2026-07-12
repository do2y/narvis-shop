import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatPrice } from "../utils/formatPrice";
import type { RecentProduct } from "../types";

export function RecentProductCard({ product }: { product: RecentProduct }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 캐시 승계: 카드 데이터를 상세 캐시에 시딩해 상세 진입 시 즉시 렌더.
  // 최근 본 상품 계약은 카드 수준 필드만 담아 부분 시딩 → 부족분은 상세 API가 채움.
  const goToDetail = () => {
    queryClient.setQueryData(["products", product.productId], {
      productId: product.productId,
      name: product.name,
      brandName: product.brand,
      price: product.price,
      imageUrl: product.imageUrl,
    });
    navigate(`/products/${product.productId}`);
  };

  return (
    <button
      type="button"
      onClick={goToDetail}
      aria-label={`${product.name} 상세 보기`}
      className="group flex flex-col text-left"
    >
      <div className="aspect-square overflow-hidden rounded-xl bg-muted">
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          className="size-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{product.brand}</p>
      <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug group-hover:underline">
        {product.name}
      </p>
      <p className="mt-1 text-sm font-bold">{formatPrice(product.price)}</p>
    </button>
  );
}
