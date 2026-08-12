"use client";

import { cn } from "@/lib/utils";
import { formatPrice } from "@/shared/utils/formatPrice";

/**
 * 판매가 · 정가 · 할인율 — 이 순서로 한 줄.
 *
 * baseline 정렬이 핵심이다. items-center 로 두면 크기가 다른 세 글자의 세로 중심이
 * 각각 맞춰져, 정가·할인율이 판매가보다 살짝 떠 보인다. items-baseline 이어야
 * 글자가 같은 선 위에 앉는다.
 *
 * 할인율에 배지·배경을 주지 않는다 — 면색 배지는 이 페이지에서 가장 강한 요소가
 * 되어 판매가보다 먼저 읽힌다. 색(빨강)과 굵기만으로 충분히 구분되고,
 * 할인이 없는 상품과의 레이아웃 차이도 최소가 된다.
 */
export function PriceRow({
  price,
  originalPrice,
  className,
  /** 모바일 하단 바처럼 좁은 자리에서는 한 단계 작게. */
  compact,
}: {
  price: number;
  originalPrice: number;
  className?: string;
  compact?: boolean;
}) {
  const hasDiscount = originalPrice > price;
  const discountRate = hasDiscount
    ? Math.round((1 - price / originalPrice) * 100)
    : 0;

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      {/* 판매가 — 이 페이지에서 상품명과 함께 가장 강한 두 요소 중 하나.
          tracking 을 좁힌다: 숫자가 커질수록 자간이 벌어져 보인다(§15). */}
      <span
        className={cn(
          "font-semibold tracking-[-0.02em] tabular-nums",
          compact ? "text-lg" : "text-[1.75rem] leading-none",
        )}
      >
        {formatPrice(price)}
      </span>
      {hasDiscount && (
        <>
          <span
            className={cn(
              "text-muted-foreground line-through tabular-nums",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {formatPrice(originalPrice)}
          </span>
          {/* 빨강은 이 페이지에서 유일한 채도 높은 색이다 — 할인율 하나에만 쓴다.
              red-500 은 흰 배경 대비가 부족해(3.7:1) 한 단계 내린다. */}
          <span
            className={cn(
              "font-semibold text-red-600 tabular-nums",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {discountRate}%
          </span>
        </>
      )}
    </div>
  );
}
