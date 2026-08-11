"use client";

import { Heart, ShoppingCart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/shared/analytics/track";
import {
  VISIBLE_MS,
  VISIBLE_RATIO,
  useVisibleOnce,
} from "@/shared/analytics/useVisibleOnce";
import { useAddCartItem } from "@/shared/hooks/useCart";
import { useWishlistToggleWithToast } from "@/shared/hooks/useWishlist";
import type { ProductCard } from "@/shared/types/chat";
import { ProductImage } from "@/shared/ui/ProductImage";
import { formatPrice } from "@/shared/utils/formatPrice";

function normalizeProductDisplayName(name: string) {
  return name.replace(/\s+[xX]\s+(?=\d)/g, " \u00D7 ");
}

export function ChatProductCard({ product }: { product: ProductCard }) {
  const {
    wished: optimisticWished,
    isPending,
    toggle,
  } = useWishlistToggleWithToast(product.productId);
  const addCart = useAddCartItem();
  const { optionChoices } = addCart;
  const rec = product.recommendationContext;
  const hasReviews = product.reviewCount > 0;
  const hasDiscount = product.originalPrice > product.price;
  const discountRate = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;
  const detailHref = `/products/${product.productId}`;
  const displayName = normalizeProductDisplayName(product.name);

  const cardRef = useVisibleOnce<HTMLDivElement>(
    () => {
      if (!rec) return;
      track("product_visible", {
        productId: product.productId,
        recommendation: rec,
        properties: { visibleRatio: VISIBLE_RATIO, visibleMs: VISIBLE_MS },
      });
    },
    rec ? `${rec.listId}:${product.productId}` : undefined,
  );

  const trackClick = (clickTarget: "card" | "button") => {
    if (!rec) return;
    track("product_click", {
      productId: product.productId,
      recommendation: rec,
      properties: { clickTarget },
    });
  };

  const addToCart = (optionId?: string) => {
    addCart.mutate({
      productId: product.productId,
      ...(optionId !== undefined ? { optionId } : {}),
      quantity: 1,
      recommendationContext: product.recommendationContext,
    });
  };

  const toggleWishlist = () => {
    toggle({
      name: product.name,
      brandName: product.brandName,
      price: product.price,
      originalPrice: product.originalPrice,
      imageUrl: product.imageUrl,
      rating: product.rating,
      reviewCount: product.reviewCount,
      purchaseState: "AVAILABLE",
    });
  };

  return (
    <div
      ref={cardRef}
      className="group flex h-full min-w-0 flex-col text-left transition-transform duration-150 ease-out motion-reduce:transition-none sm:hover:-translate-y-0.5"
    >
      <div className="relative overflow-hidden rounded-[12px] bg-[#F7F7F7] ring-1 ring-black/[0.04]">
        <div className="flex aspect-square items-center justify-center sm:aspect-[4/3]">
          <a
            href={detailHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick("card")}
            aria-label={`${product.name} 상세 보기 (새 탭)`}
            className="block size-full"
          >
            <ProductImage
              src={product.imageUrl}
              alt={product.name}
              className="size-full object-contain transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none sm:group-hover:scale-[1.02]"
            />
          </a>
        </div>

        <button
          type="button"
          onClick={toggleWishlist}
          disabled={isPending}
          aria-label={optimisticWished ? "찜 해제" : "찜하기"}
          aria-pressed={optimisticWished}
          className="absolute right-2.5 top-2.5 flex size-9 items-center justify-center rounded-full bg-white/88 text-muted-foreground shadow-[0_1px_8px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-all duration-150 ease-out hover:bg-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wordmark/20 disabled:opacity-60 sm:right-3 sm:top-3 sm:size-10"
        >
          <Heart
            className={cn(
              "size-4 transition-all duration-200 sm:size-[18px]",
              optimisticWished
                ? "scale-110 fill-red-500 text-red-500"
                : "text-muted-foreground",
            )}
          />
        </button>
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
            className="line-clamp-2 min-h-[2.45rem] text-[14px] font-medium leading-[1.4] text-foreground sm:min-h-[2.7rem] sm:text-[15px] sm:leading-[1.45]"
          >
            <a
              href={detailHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick("card")}
              className="transition-colors hover:text-foreground/80 focus-visible:outline-none"
            >
              {displayName}
            </a>
          </h3>
        </div>

        <div className="pt-4 sm:pt-[18px]">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
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

            <button
              type="button"
              onClick={() => {
                trackClick("button");
                addToCart();
              }}
              disabled={addCart.isPending}
              aria-label="장바구니에 담기"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-muted-foreground transition-all duration-150 ease-out hover:bg-black/[0.03] hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wordmark/20 disabled:opacity-50 sm:size-10"
            >
              <ShoppingCart className="size-4" />
            </button>
          </div>
        </div>

        {optionChoices && (
          <div className="flex flex-wrap gap-1.5 pt-3 sm:pt-3.5">
            {optionChoices.map((opt) => (
              <button
                key={opt.optionId}
                type="button"
                onClick={() => addToCart(opt.optionId)}
                disabled={addCart.isPending}
                className="rounded-full border border-black/[0.08] px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-black/[0.03] hover:text-foreground disabled:opacity-50 sm:px-3 sm:text-xs"
              >
                {opt.name}
                {opt.extraPrice > 0 && ` +${formatPrice(opt.extraPrice)}`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
