import { Heart, Star } from "lucide-react";
import { useGoToProduct } from "@/shared/hooks/useGoToProduct";
import { useIsWished, useToggleWishlist } from "@/shared/hooks/useWishlist";
import { formatPrice } from "@/shared/utils/formatPrice";
import { cn } from "@/lib/utils";
import type { BrandProduct } from "../types";

// 홈 ProductCard와 같은 카드 문법(rounded-sm·hover 상승·별점/할인 표기)에
// 브랜드 홈 전용으로 찜 하트를 얹은 형태.
// 카드에 브랜드명을 반복 표기하지 않는다(브랜드 홈은 전부 같은 브랜드) — 시딩에는 사용.
export function BrandProductCard({ product }: { product: BrandProduct }) {
  const goToProduct = useGoToProduct();
  const wished = useIsWished(product.productId);
  const { toggle } = useToggleWishlist();

  const hasDiscount = product.originalPrice > product.price;
  const discountRate = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;
  const soldOut = product.purchasable === false;

  return (
    <div className="group relative flex flex-col">
      <button
        type="button"
        // product를 통째로 넘겨 SeededProductCard를 채운다. brandName은 카드에
        // 표시하지 않지만 시딩 계약의 필수 필드다 — 타입에서 지우면 여기서 조용히 깨진다.
        onClick={() => goToProduct(product)}
        aria-label={`${product.name} 상세 보기`}
        // 피드백은 press 시점에 즉시(apple-design §1) — 카드 전체가 살짝 눌린다
        className="flex flex-col text-left transition-transform duration-100 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <div className="relative aspect-square overflow-hidden rounded-sm bg-muted">
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className={cn(
              "size-full object-cover transition-transform duration-300 will-change-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100",
              soldOut && "opacity-50",
            )}
          />
          {soldOut && (
            <span className="absolute inset-x-0 bottom-0 bg-foreground/80 py-1.5 text-center text-xs font-semibold text-background backdrop-blur">
              품절
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5 pt-3">
          {/* 제목은 본문 크기 — tracking은 0 부근 유지(apple-design §15) */}
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
            {product.name}
          </h3>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
            <span className="font-medium text-foreground">{product.rating}</span>
            <span>({product.reviewCount.toLocaleString("ko-KR")})</span>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-bold">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <>
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(product.originalPrice)}
                </span>
                <span className="text-xs font-bold text-red-500">
                  {discountRate}%
                </span>
              </>
            )}
          </div>
        </div>
      </button>

      {/* 카드 전체가 버튼이라 하트는 형제로 띄운다(버튼 중첩 방지).
          이미지 위 반투명 레이어라 backdrop-blur로 사진 위에서도 읽히게 한다(apple-design §12) */}
      <button
        type="button"
        onClick={() => toggle(product.productId, wished)}
        aria-label={wished ? "찜 해제" : "찜하기"}
        aria-pressed={wished}
        className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur transition duration-100 ease-out hover:bg-background active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <Heart
          className={cn(
            "size-4 transition-colors duration-150",
            wished ? "fill-red-500 text-red-500" : "text-muted-foreground",
          )}
        />
      </button>
    </div>
  );
}
