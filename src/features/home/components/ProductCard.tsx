"use client";

import { Star } from "lucide-react";
import { ProductImage } from "@/shared/ui/ProductImage";
import { Skeleton } from "@/shared/ui/skeleton";
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
  recommendation?: EventRecommendation;
}

export function ProductCard({ product, recommendation }: ProductCardProps) {
  const goToProduct = useGoToProduct();
  const hasDiscount = product.originalPrice > product.price;
  const discountRate = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  const cardRef = useVisibleOnce<HTMLButtonElement>(
    () => {
      if (!recommendation) return;
      track("product_visible", {
        productId: product.productId,
        recommendation,
        properties: { visibleRatio: VISIBLE_RATIO, visibleMs: VISIBLE_MS },
      });
    },
    recommendation ? `${recommendation.listId}:${product.productId}` : undefined,
  );

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

  const reason = "reason" in product ? product.reason : null;

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={handleClick}
      aria-label={`${product.name} 상세 보기`}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-background text-left shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-[transform,box-shadow] duration-150 ease-out active:scale-[0.985] sm:rounded-sm sm:shadow-sm sm:hover:-translate-y-1 sm:hover:shadow-md"
    >
      <div className="aspect-square overflow-hidden bg-muted sm:aspect-[4/3]">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="size-full object-cover transition-transform duration-300 will-change-transform sm:group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 min-w-0 flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-4">
        <span className="truncate text-[11px] leading-4 text-muted-foreground sm:text-xs sm:font-medium">
          {product.brandName}
        </span>

        <h3 className="line-clamp-2 min-h-[2.2rem] text-[13px] font-semibold leading-[1.35] text-foreground sm:min-h-0 sm:text-sm sm:leading-snug">
          {product.name}
        </h3>

        <div className="flex min-w-0 items-center gap-1 text-[11px] leading-4 text-muted-foreground sm:text-sm">
          <Star className="size-3 shrink-0 fill-yellow-400 text-yellow-400 sm:size-3.5" />
          <span className="font-medium text-foreground">{product.rating}</span>
          <span className="truncate">({product.reviewCount.toLocaleString("ko-KR")})</span>
        </div>

        {reason && (
          <p className="hidden line-clamp-2 text-sm text-muted-foreground sm:block">
            {reason}
          </p>
        )}

        <div className="mt-auto min-h-[2.45rem] pt-0.5 sm:min-h-0 sm:pt-1">
          <div className="flex items-baseline gap-x-1.5 gap-y-0.5 sm:flex-wrap sm:gap-x-2">
            <span className="text-[15px] font-bold tracking-tight text-foreground sm:text-base">
              {formatPrice(product.price)}
            </span>

            {hasDiscount && (
              <span className="order-2 text-[11px] font-bold text-red-500 sm:order-3 sm:text-sm">
                {discountRate}%
              </span>
            )}

            {hasDiscount && (
              <span className="order-3 basis-full text-[11px] leading-none text-muted-foreground line-through sm:order-2 sm:basis-auto sm:text-sm">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-background p-2.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:rounded-sm sm:p-4 sm:shadow-sm">
      <Skeleton className="aspect-square rounded-lg sm:aspect-[4/3] sm:rounded-sm" />
      <div className="mt-2.5 flex flex-1 flex-col gap-1.5 sm:mt-3 sm:gap-2">
        <Skeleton className="h-3 w-2/5 rounded-full sm:h-3.5" />
        <Skeleton className="h-8 rounded-md sm:h-9" />
        <Skeleton className="h-3.5 w-1/2 rounded-full sm:h-4" />
        <div className="mt-auto space-y-1 pt-1">
          <Skeleton className="h-4 w-1/2 rounded-full sm:h-5" />
          <Skeleton className="h-3 w-1/3 rounded-full sm:h-4" />
        </div>
      </div>
    </div>
  );
}
