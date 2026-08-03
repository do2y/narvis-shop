"use client";

import { Heart, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/shared/analytics/track";
import { useIsWished, useToggleWishlist } from "@/shared/hooks/useWishlist";
import { useAddCartItem } from "@/shared/hooks/useCart";
import { formatPrice } from "@/shared/utils/formatPrice";
import type { ProductCard } from "@/shared/types/chat";

export function ChatProductCard({ product }: { product: ProductCard }) {
  // 찜 상태는 서버 목록에서 파생 — 로컬 토글이면 새로고침·다른 화면과 어긋난다.
  const wished = useIsWished(product.productId);
  const { toggle, isPending } = useToggleWishlist();
  const addCart = useAddCartItem();
  const { optionChoices } = addCart;

  /**
   * 담기 — 기본(옵션 없음)과 옵션 칩 선택이 같은 경로를 쓴다.
   *
   * 담기 성공 후에만 수집한다(명세: 실패 건은 세지 않음).
   * recommendation 을 실으면 서버가 listId 로 추천 경유임을 검증해 귀속시킨다 —
   * FE 가 "챗봇에서 담았다"고 주장하는 값보다 신뢰할 수 있다(계약 E-1).
   * 인기상품 카드엔 recommendationContext 가 없어 필드째 빠진다.
   */
  const addToCart = (optionId?: number, extraPrice = 0) => {
    addCart.mutate(
      {
        productId: product.productId,
        ...(optionId !== undefined ? { optionId } : {}),
        quantity: 1,
        recommendationContext: product.recommendationContext,
      },
      {
        onSuccess: () =>
          track("add_to_cart", {
            productId: product.productId,
            recommendation: product.recommendationContext,
            properties: {
              quantity: 1,
              // 단가는 판매가 + 옵션 추가금(상세 페이지와 같은 식)
              price: product.price + extraPrice,
              ...(optionId !== undefined ? { optionId } : {}),
            },
          }),
      },
    );
  };
  const hasDiscount = product.originalPrice > product.price;
  const discountRate = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  // 챗봇 카드만 새 탭으로 연다. 대화 상태는 persist하지 않아(CLAUDE.md) 같은 탭에서
  // 상세로 나갔다 돌아오면 대화가 사라지기 때문. 새 탭은 캐시를 공유하지 않아
  // useGoToProduct의 상세 캐시 시딩을 쓸 수 없다(스켈레톤부터 시작) — 대화 보존을 택한 것.
  // window.open 대신 <a target="_blank">: 팝업 차단을 피하고 Ctrl·가운데 클릭도 그대로 동작한다.
  const detailHref = `/products/${product.productId}`;

  return (
    <div className="group flex flex-col overflow-hidden rounded-sm border bg-background transition-shadow duration-200 hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <a
          href={detailHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${product.name} 상세 보기 (새 탭)`}
          className="block size-full"
        >
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        </a>
        <button
          type="button"
          onClick={() => toggle(product.productId, wished)}
          disabled={isPending}
          aria-label={wished ? "찜 해제" : "찜하기"}
          aria-pressed={wished}
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-background/80 backdrop-blur transition-all hover:bg-background active:scale-90 disabled:opacity-50"
        >
          <Heart
            className={cn(
              "size-5 transition-transform",
              wished
                ? "scale-110 fill-red-500 text-red-500"
                : "text-muted-foreground",
            )}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium text-muted-foreground">
          {product.brandName}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          <a
            href={detailHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-left hover:underline"
          >
            {product.name}
          </a>
        </h3>
        {/* 인기상품(단순 집계) 카드는 추천 이유가 없어 영역 자체를 그리지 않음 */}
        {product.reason && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {product.reason}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
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

          {/* 옵션이 필요한 상품은 서버가 400(CART_OPTION_REQUIRED)으로 알려주므로
              먼저 1개 담기를 시도하고, 실패하면 아래 옵션 칩으로 고르게 한다.
              자동 재시도 없음. */}
          <button
            type="button"
            onClick={() => addToCart()}
            disabled={addCart.isPending}
            aria-label="장바구니에 담기"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90 disabled:opacity-50"
          >
            <ShoppingCart className="size-4" />
          </button>
        </div>

        {addCart.isSuccess && (
          <p className="text-xs text-muted-foreground" role="status">
            장바구니에 담았어요.
          </p>
        )}
        {addCart.errorMessage && (
          <p className="text-xs text-destructive" role="alert">
            {addCart.errorMessage}
          </p>
        )}

        {/* 옵션 미선택으로 막혔으면 서버가 준 선택지를 그대로 띄운다(C-2 detail.options).
            카드에는 옵션 UI 가 없어 문구만 보여주면 사용자가 뭘 골라야 할지 알 수 없다 —
            상세로 되돌아가야 했던 흐름을 여기서 끝낸다. */}
        {optionChoices && (
          <div className="flex flex-wrap gap-1.5">
            {optionChoices.map((opt) => (
              <button
                key={opt.optionId}
                type="button"
                onClick={() => addToCart(opt.optionId, opt.extraPrice)}
                disabled={addCart.isPending}
                className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50"
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
