"use client";

import { Heart, Star } from "lucide-react";
import { ProductImage } from "@/shared/ui/ProductImage";
import { Skeleton } from "@/shared/ui/skeleton";
import { useGoToProduct } from "@/shared/hooks/useGoToProduct";
import { useWishlistToggleWithToast } from "@/shared/hooks/useWishlist";
import { track } from "@/shared/analytics/track";
import {
  useVisibleOnce,
  VISIBLE_MS,
  VISIBLE_RATIO,
} from "@/shared/analytics/useVisibleOnce";
import type { EventRecommendation } from "@/shared/analytics/types";
import { formatPrice } from "@/shared/utils/formatPrice";
import {
  unavailableLabel,
  type PurchaseState,
  type SeededProductCard,
} from "@/shared/types/product";
import { cn } from "@/lib/utils";

/**
 * 공용 상품 카드 — 홈(인기·추천)과 브랜드 홈이 함께 쓴다.
 *
 * 원래 features/home 에 있었다. 브랜드 홈이 같은 카드를 필요로 하면서
 * "2개 이상 페이지가 쓰는 것만 승격"(CLAUDE.md) 조건을 충족해 여기로 옮겼다.
 * 브랜드 전용 카드를 따로 두면 같은 디자인이 두 벌로 갈려, 한쪽만 고쳐지는
 * 상태가 반복된다(실제로 그랬다 — 브랜드 카드만 object-cover·rounded-sm 였다).
 *
 * props 로 갈리는 것은 **화면마다 진짜로 다른 것 둘**뿐이다:
 *  - `wishlist`: 찜 하트. 홈은 안 쓰고 브랜드 홈만 쓴다
 *  - `purchaseState`: 품절 배지. 브랜드 목록(P-6)은 재고를 거르지 않아 필요하다
 * 나머지(이미지 비율·타이포·가격 위계)는 어느 화면에서도 같아야 하므로 고정한다.
 */
interface ProductCardProps {
  /** 시딩 계약을 그대로 받는다 — 상세 캐시 승계(useGoToProduct)에 필요한 필드 전부 */
  product: SeededProductCard;
  recommendation?: EventRecommendation;
  /** 찜 하트를 띄운다(브랜드 홈). 기본 false — 홈 카드는 종전 그대로 하트가 없다 */
  wishlist?: boolean;
  /** 품절·판매종료 배지. 값이 없으면 배지를 그리지 않는다 */
  purchaseState?: PurchaseState;
}

function normalizeProductDisplayName(name: string) {
  return name.replace(/\s+[xX]\s+(?=\d)/g, " × ");
}

export function ProductCard({
  product,
  recommendation,
  wishlist = false,
  purchaseState,
}: ProductCardProps) {
  const goToProduct = useGoToProduct();
  const hasReviews = product.reviewCount > 0;
  const hasDiscount = product.originalPrice > product.price;
  const discountRate = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;
  // P-6은 재고를 거르지 않아 SOLD_OUT이 섞여 온다. 사유별 라벨은 한 곳에서 판정한다.
  const unavailable = unavailableLabel(purchaseState);

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
    // 하트가 카드 위에 얹히므로 relative 래퍼가 필요하다. 하트가 없을 때도
    // 같은 구조를 유지한다 — 래퍼 유무로 갈리면 grid 정렬이 미묘하게 달라진다.
    <div className="group relative flex h-full min-w-0 flex-col">
      <button
        ref={cardRef}
        type="button"
        onClick={handleClick}
        aria-label={`${product.name} 상세 보기`}
        className="flex h-full min-w-0 flex-col text-left transition-transform duration-150 ease-out active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wordmark/20 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100 sm:hover:-translate-y-0.5"
      >
        <div className="relative overflow-hidden rounded-[12px] bg-[#F7F7F7] ring-1 ring-black/[0.04]">
          <div className="flex aspect-square items-center justify-center sm:aspect-[4/3]">
            <ProductImage
              src={product.imageUrl}
              alt={product.name}
              className={cn(
                "size-full object-contain transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none sm:group-hover:scale-[1.02]",
                unavailable && "opacity-50",
              )}
            />
          </div>
          {/* 품절 띠 — 이미지 위에 얹어 목록을 훑을 때 바로 걸러지게 한다 */}
          {unavailable && (
            <span className="absolute inset-x-0 bottom-0 bg-foreground/80 py-1.5 text-center text-xs font-semibold text-background backdrop-blur">
              {unavailable}
            </span>
          )}
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

      {wishlist && <WishlistHeart product={product} state={purchaseState} />}
    </div>
  );
}

/**
 * 찜 하트 — 카드 전체가 button 이라 형제로 띄운다(button 중첩 방지).
 *
 * 별도 컴포넌트로 뺀 이유: 훅(useWishlistToggleWithToast)은 조건부로 호출할 수
 * 없는데, 하트는 브랜드 홈에서만 필요하다. 여기로 내리면 `wishlist`가 false 인
 * 홈 카드는 찜 목록 구독 자체를 하지 않는다.
 */
function WishlistHeart({
  product,
  state,
}: {
  product: SeededProductCard;
  state?: PurchaseState;
}) {
  const { wished, isPending, toggle } = useWishlistToggleWithToast(
    product.productId,
  );

  return (
    <button
      type="button"
      onClick={() =>
        // 카드가 이미 그리고 있는 값을 넘겨 목록 캐시에 낙관적으로 끼운다 —
        // 없으면 하트가 서버 응답까지 반응하지 않는다.
        toggle({
          name: product.name,
          brandName: product.brandName,
          price: product.price,
          originalPrice: product.originalPrice,
          imageUrl: product.imageUrl,
          rating: product.rating,
          reviewCount: product.reviewCount,
          // 값이 없으면 구매 가능으로 두되, onSettled 재조회가 서버 값으로 덮는다.
          purchaseState: state ?? "AVAILABLE",
        })
      }
      disabled={isPending}
      aria-label={wished ? "찜 해제" : "찜하기"}
      aria-pressed={wished}
      // 이미지 위 반투명 레이어라 backdrop-blur 로 사진 위에서도 읽히게 한다(§12)
      className="absolute right-2.5 top-2.5 flex size-9 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur transition duration-100 ease-out hover:bg-background active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wordmark/20 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <Heart
        strokeWidth={1.75}
        className={cn(
          "size-4 transition-colors duration-150",
          wished ? "fill-red-500 text-red-500" : "text-muted-foreground",
        )}
      />
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
