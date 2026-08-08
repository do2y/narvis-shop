"use client";

import { Star } from "lucide-react";
import { ProductImage } from "@/shared/ui/ProductImage";
import { useGoToProduct } from "@/shared/hooks/useGoToProduct";
import { track } from "@/shared/analytics/track";
import {
  useVisibleOnce,
  VISIBLE_MS,
  VISIBLE_RATIO,
} from "@/shared/analytics/useVisibleOnce";
import type { EventRecommendation } from "@/shared/analytics/types";
import type { PopularProduct, RecommendedProduct } from "../types";
import { formatPrice } from "@/shared/utils/formatPrice";

interface ProductCardProps {
  product: PopularProduct | RecommendedProduct;
  /**
   * 추천 상관키. 추천 섹션에서만 넘어온다 —
   * 인기상품은 귀속시킬 목록이 없어 노출·클릭을 수집하지 않는다(E-1).
   */
  recommendation?: EventRecommendation;
}

export function ProductCard({ product, recommendation }: ProductCardProps) {
  const goToProduct = useGoToProduct();
  const hasDiscount = product.originalPrice > product.price;
  const discountRate = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  // CTR 분모. 같은 목록 안에서는 재발화하지 않는다(listId+productId 로 대상을 고정).
  const cardRef = useVisibleOnce<HTMLButtonElement>(
    () => {
      if (!recommendation) return;
      track("product_visible", {
        productId: product.productId,
        recommendation,
        properties: { visibleRatio: VISIBLE_RATIO, visibleMs: VISIBLE_MS },
      });
    },
    recommendation
      ? `${recommendation.listId}:${product.productId}`
      : undefined,
  );

  // CTR 분자. 홈 카드는 카드 전체가 하나의 버튼이라 clickTarget 이 "card" 뿐이다.
  const handleClick = () => {
    if (recommendation) {
      track("product_click", {
        productId: product.productId,
        recommendation,
        properties: { clickTarget: "card" },
      });
    }
    goToProduct(product);
  };

  // NOT_PERSONALIZED 응답은 서버가 null 을 넣는다(필드는 유지) → 영역을 그리지 않는다.
  const reason = "reason" in product ? product.reason : null;

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={handleClick}
      aria-label={`${product.name} 상세 보기`}
      className="group flex flex-col overflow-hidden rounded-sm border bg-background text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md active:translate-y-0 active:scale-[0.99]"
    >
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="size-full object-cover transition-transform duration-300 will-change-transform group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs font-medium text-muted-foreground">
          {product.brandName}
        </span>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          {product.name}
        </h3>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
          <span className="font-medium text-foreground">{product.rating}</span>
          <span>({product.reviewCount.toLocaleString("ko-KR")})</span>
        </div>

        {/* 인기상품(단순 집계) 카드는 추천 이유가 없어 영역 자체를 그리지 않음 */}
        {reason && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{reason}</p>
        )}

        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-1">
          <span className="text-base font-bold">
            {formatPrice(product.price)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.originalPrice)}
              </span>
              <span className="text-sm font-bold text-red-500">
                {discountRate}%
              </span>
            </>
          )}
        </div>

      </div>
    </button>
  );
}
