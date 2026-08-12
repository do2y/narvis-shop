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
import { formatPrice } from "@/shared/utils/formatPrice";
import type { PopularProduct, RecommendedProduct } from "../types";

interface ProductCardProps {
  product: PopularProduct | RecommendedProduct;
  recommendation?: EventRecommendation;
}

function normalizeProductDisplayName(name: string) {
  return name.replace(/\s+[xX]\s+(?=\d)/g, " \u00D7 ");
}

export function ProductCard({ product, recommendation }: ProductCardProps) {
  const goToProduct = useGoToProduct();
  const hasReviews = product.reviewCount > 0;
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
    recommendation
      ? `${recommendation.listId}:${product.productId}`
      : undefined,
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

  const displayName = normalizeProductDisplayName(product.name);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={handleClick}
      aria-label={`${product.name} \uC0C1\uC138 \uBCF4\uAE30`}
      className="group flex h-full min-w-0 flex-col text-left transition-transform duration-150 ease-out active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wordmark/20 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100 sm:hover:-translate-y-0.5"
    >
      <div className="overflow-hidden rounded-[12px] bg-[#F7F7F7] ring-1 ring-black/[0.04]">
        <div className="flex aspect-square items-center justify-center sm:aspect-[4/3]">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            className="size-full object-contain transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none sm:group-hover:scale-[1.02]"
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col px-0.5 pt-3 sm:pt-4">
        <div className="flex flex-col gap-2 sm:gap-2.5">
          <div className="flex min-w-0 items-center justify-between gap-2 sm:min-h-[1.125rem]">
            <span className="min-w-0 truncate text-[11px] leading-4 text-muted-foreground/90 sm:text-[12px]">
              {product.brandName}
            </span>

            {hasReviews && (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] leading-4 text-muted-foreground/90 sm:text-[13px]">
                <Star className="size-[13px] shrink-0 fill-[#D6A13C] text-[#D6A13C] sm:size-[14px]" />
                <span className="font-medium text-foreground/85">
                  {product.rating.toFixed(1)}
                </span>
                <span className="text-muted-foreground">
                  ({product.reviewCount.toLocaleString("ko-KR")})
                </span>
              </span>
            )}
          </div>

          <h3
            title={product.name}
            className="product-card-two-line text-[14px] font-medium text-foreground [--product-card-two-line-lh:1.4] sm:text-[15px] sm:[--product-card-two-line-lh:1.45]"
          >
            {displayName}
          </h3>
        </div>

        <div className="pt-4 sm:pt-[28px]">
          <div className="min-h-[1.6rem] sm:min-h-[1.75rem]">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:gap-x-2.5">
              <span className="text-[17px] font-bold tracking-tight text-foreground sm:text-[18px]">
                {formatPrice(product.price)}
              </span>

              {hasDiscount && (
                <span className="flex items-baseline gap-1.5 whitespace-nowrap sm:gap-2">
                  <span className="text-[12px] leading-4 text-muted-foreground line-through sm:text-[13px]">
                    {formatPrice(product.originalPrice)}
                  </span>
                  <span className="text-[13px] font-semibold tracking-[-0.01em] text-red-500/90 sm:text-[14px]">
                    {discountRate}%
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <Skeleton className="aspect-square rounded-[12px] bg-muted/80 sm:aspect-[4/3]" />
      <div className="mt-3 flex flex-1 flex-col px-0.5 sm:mt-4">
        <div className="flex flex-col gap-2 sm:gap-2.5">
          <div className="flex items-center justify-between gap-2 sm:min-h-[1.125rem]">
            <Skeleton className="h-3 w-2/5 rounded-full sm:h-3.5" />
            <Skeleton className="h-3.5 w-1/4 rounded-full sm:h-4" />
          </div>

          <div className="space-y-1">
            <Skeleton className="h-4 rounded-full sm:h-4.5" />
            <Skeleton className="h-4 w-4/5 rounded-full sm:h-4.5" />
          </div>
        </div>

        <div className="pt-4 sm:pt-[18px]">
          <div className="space-y-1">
            <Skeleton className="h-5 w-3/4 rounded-full sm:h-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
