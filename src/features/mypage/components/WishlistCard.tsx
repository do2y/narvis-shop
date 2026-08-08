"use client";

import { Heart, ShoppingCart } from "lucide-react";
import { ProductImage } from "@/shared/ui/ProductImage";
import { formatPrice } from "@/shared/utils/formatPrice";
import { useAddCartItem } from "@/shared/hooks/useCart";
import { useGoToProduct } from "@/shared/hooks/useGoToProduct";
import { useRemoveWishlistItem } from "../useWishlist";
import { isPurchasable, unavailableLabel } from "@/shared/types/product";
import type { WishlistProduct } from "@/shared/types/wishlist";

export function WishlistCard({ product }: { product: WishlistProduct }) {
  const remove = useRemoveWishlistItem(product.productId);
  const addCart = useAddCartItem();
  const goToProduct = useGoToProduct();

  // 담기 결과 토스트는 useAddCartItem 이 띄운다. 구매 불가 안내(품절·판매종료)만
  // 카드에 남긴다 — 상태를 계속 알려야 하는 정보라 잠깐 떴다 사라지면 안 된다.

  // WishlistProduct는 시딩 계약을 전부 갖고 있어 그대로 승계한다.
  const goToDetail = () => goToProduct(product);

  // 찜한 뒤 품절·판매종료될 수 있다 — 사유에 따라 안내와 권하는 행동이 다르다.
  const purchasable = isPurchasable(product.purchaseState);
  const unavailable = unavailableLabel(product.purchaseState);

  return (
    <article className="group flex h-full flex-col">
      <div className="relative aspect-square overflow-hidden rounded-sm bg-muted ring-1 ring-black/5">
        <button
          type="button"
          onClick={goToDetail}
          aria-label={`${product.name} 상세 보기`}
          className="block size-full"
        >
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        </button>

        <button
          type="button"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          aria-label="찜 해제"
          aria-pressed
          className="absolute bottom-1 right-1 flex size-11 items-center justify-center transition-transform hover:scale-110 disabled:opacity-50"
        >
          <Heart className="size-6 fill-red-500 text-red-500 drop-shadow-sm" />
        </button>
      </div>

      <button
        type="button"
        onClick={goToDetail}
        className="mt-3 flex flex-1 flex-col text-left"
      >
        <span className="text-xs text-muted-foreground">{product.brandName}</span>
        <span className="mt-1 line-clamp-2 text-sm font-medium leading-snug group-hover:underline">
          {product.name}
        </span>
        <span className="mt-1 text-sm font-bold">
          {formatPrice(product.price)}
        </span>
      </button>

      {/* 담기 — 판매 중지(HIDDEN) 상품은 서버가 거부하므로 버튼을 비활성화한다.
          옵션 필수 상품은 서버 400 사유를 그대로 안내(카드에는 옵션 선택 UI가 없음). */}
      <button
        type="button"
        onClick={() =>
          addCart.mutate({ productId: product.productId, quantity: 1 })
        }
        disabled={!purchasable || addCart.isPending}
        className="mt-3 inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-sm border text-sm font-medium transition-all hover:bg-muted active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
      >
        <ShoppingCart className="size-4" />
        {unavailable ?? (addCart.isPending ? "담는 중…" : "장바구니 담기")}
      </button>

      {/* 못 사는 이유에 따라 다음 행동이 다르다 — 품절은 기다리면 되지만
          판매 종료는 돌아오지 않으므로 찜에서 빼도록 권한다. */}
      {unavailable && (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          {product.purchaseState === "SOLD_OUT"
            ? "품절됐어요. 재입고되면 다시 담을 수 있어요."
            : "판매가 종료된 상품이에요. 찜에서 빼는 걸 권해요."}
        </p>
      )}

    </article>
  );
}
