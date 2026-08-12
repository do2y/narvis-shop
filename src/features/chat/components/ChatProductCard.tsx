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
  // 인기상품 등 LLM 추천이 아닌 카드는 reason 이 ""(chat/api.ts) — 그때는 영역 자체를 없앤다
  const reason = product.reason.trim();

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
          className="group/wish absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-all duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wordmark/20 disabled:opacity-60 sm:right-2 sm:top-2"
        >
          {/* 버튼(size-9)은 터치 타겟이고, 눈에 보이는 원은 그 안의 span(size-7)이다 —
              시각적 크기만 줄이고 누를 수 있는 영역은 유지한다. */}
          <span className="flex size-7 items-center justify-center rounded-full bg-white/88 shadow-[0_1px_6px_rgba(15,23,42,0.07)] backdrop-blur-sm transition-colors duration-150 group-hover/wish:bg-white">
            <Heart
              strokeWidth={1.75}
              className={cn(
                "size-[15px] transition-all duration-200",
                optimisticWished
                  ? "scale-110 fill-red-500 text-red-500"
                  : "text-muted-foreground",
              )}
            />
          </span>
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col px-0.5 pt-2.5 sm:pt-3">
        {/* 브랜드·평점 / 상품명 / 추천 이유를 한 묶음으로 둔다 — 이유는 독립 정보가
            아니라 상품명을 보조하는 설명이라, 그룹 내부는 좁게(gap-1.5) 두고 그룹
            바깥(가격)과는 넓게 띄워 시선이 "무엇인가 → 왜 추천인가 → 얼마인가"
            순으로 흐르게 한다. 근접성이 곧 관계다(§16 Grouping). */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
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

          {/* AI 추천 이유(CH-5 reason) — 면색·테두리·라벨 없이 본문 흐름 안의 텍스트다.
              카드에서 먼저 읽혀야 하는 건 상품(이미지·이름·가격)이고 이유는 그걸 거드는
              설명이라, 배경으로 띄우면 위계가 뒤집힌다(df3a9e4 이전 표기).
              위계는 색·면이 아니라 크기와 색조로만 만든다(§15).

              muted-foreground 를 그대로 쓴다 — /70 처럼 더 흐리면 본문 대비가 무너져
              읽기 어려워진다. 본문(상품명)보다 한 단계 작은 크기로 충분히 구분된다.

              2줄 클램프 + 말줄임. 여기서는 min-height 를 주지 않는다 — 이유가 짧은
              카드에 빈 줄이 생기기 때문이고, 카드 간 가격 정렬은 아래 mt-auto 가 맡는다. */}
          {reason && (
            <p
              className="line-clamp-2 text-[12px] leading-[1.45] text-muted-foreground sm:text-[13px]"
              title={reason}
            >
              {reason}
            </p>
          )}
        </div>

        {/* 가격은 카드 최하단 고정 — 이유 길이가 달라도 그리드에서 가격 줄이 맞는다.
            mt-auto 는 이 블록에만 걸어, 위 그룹이 늘어나지 않게 한다.
            pt 는 그룹 내부 간격(gap-1.5)보다 확실히 크게 잡아 "다른 묶음"으로 읽히게 한다. */}
        <div className="mt-auto pt-3 sm:pt-3.5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* 구 min-h-[1.6rem] 제거 — 할인 없는 카드에 빈 높이가 남아 이유 아래
                  공간이 부풀었다. 줄 높이는 가격 텍스트가 자연히 만든다. */}
              <div>
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
              className="group/cart -m-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wordmark/20 disabled:opacity-50"
            >
              {/* 찜 버튼과 같은 규격 — 보이는 원 size-7, 아이콘 15px, 선 굵기 1.75.
                  둘이 달라 보이면 같은 층의 컨트롤로 읽히지 않는다(§16 Familiarity).
                  음수 마진으로 터치 타겟만 가격 줄 밖으로 넓힌다. */}
              <span className="flex size-7 items-center justify-center rounded-full border border-black/[0.08] transition-colors duration-150 group-hover/cart:bg-black/[0.03]">
                <ShoppingCart strokeWidth={1.75} className="size-[15px]" />
              </span>
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
