"use client";

import Link from "next/link";
import { Check, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/shared/ui/ProductImage";
import { formatPrice } from "@/shared/utils/formatPrice";
import { isPurchasable, unavailableLabel } from "@/shared/types/product";
import type { CartItem } from "../types";

export function CartItemCard({
  item,
  selected,
  onToggle,
  onQuantityChange,
  onRemove,
}: {
  item: CartItem;
  selected: boolean;
  onToggle: () => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const hasDiscount = item.originalPrice > item.price;
  const lineTotal = item.price * item.quantity;
  const lineOriginal = item.originalPrice * item.quantity;
  // "화이트/M" 형태로 오므로 슬래시로 나눠 옵션별 칩으로 표시.
  // 옵션 없는 상품은 optionName이 null이라 빈 배열이 되고 칩 영역이 렌더되지 않는다.
  const optionValues = (item.optionName ?? "")
    .split("/")
    .map((v) => v.trim())
    .filter(Boolean);

  // 품절/판매종료 상품은 선택·수량 변경을 막고 삭제만 남긴다(서버 합계에서도 제외됨)
  const unavailable = unavailableLabel(item.purchaseState);
  const disabled = !isPurchasable(item.purchaseState);

  // 수량 상한 — 서버가 min(재고, 99)로 계산해 내린다(C-1 maxQuantity, 2026-08-05).
  // 이게 없으면 사용자가 재고보다 많이 올려본 뒤 400을 받고서야 상한을 알게 된다.
  // 구버전 응답 대비로 값이 없으면 제한하지 않는다(서버가 최종 판정).
  const atMax = item.maxQuantity != null && item.quantity >= item.maxQuantity;

  // 상세 진입은 Link만 — CartItem에는 rating·reviewCount가 없어 SeededProductCard를
  // 채우지 못하므로 useGoToProduct의 캐시 시딩을 쓸 수 없다(주문 상세와 동일).
  const detailHref = `/products/${item.productId}`;

  return (
    <article className="flex gap-4 rounded-sm border bg-background p-4 sm:p-5">
      {/* 선택 체크박스 */}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected && !disabled}
        aria-label={selected ? "선택 해제" : "선택"}
        onClick={onToggle}
        disabled={disabled}
        className={cn(
          "mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected && !disabled ? "border-primary bg-primary" : "border-input",
          disabled && "opacity-40",
        )}
      >
        {selected && !disabled && (
          <Check className="size-4 text-primary-foreground" />
        )}
      </button>

      <Link href={detailHref} className="shrink-0">
        <ProductImage
          src={item.imageUrl}
          alt=""
          className={cn(
            "size-20 rounded-sm bg-muted object-cover transition-transform hover:scale-[1.03] sm:size-24",
            disabled && "opacity-50",
          )}
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={detailHref}
              className="block truncate text-sm font-medium hover:underline"
            >
              {item.name}
            </Link>
            {/* 품절은 기다리면 되고 판매 종료는 빼야 한다 — 할 일이 다르니 문구도 나눈다 */}
            {unavailable && (
              <p className="mt-0.5 text-xs text-red-500">
                {item.purchaseState === "SOLD_OUT"
                  ? "품절됐어요 — 재입고되면 구매할 수 있어요"
                  : "판매가 종료된 상품이에요 — 빼주세요"}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="삭제"
            onClick={onRemove}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 옵션 칩 */}
        {optionValues.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {optionValues.map((value) => (
              <span
                key={value}
                className="inline-flex h-6 items-center rounded-full border px-2.5 text-xs text-muted-foreground"
              >
                {value}
              </span>
            ))}
          </div>
        )}

        {/* 수량 스테퍼 + 가격 */}
        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="inline-flex h-10 items-center rounded-full border">
            <button
              type="button"
              aria-label="수량 줄이기"
              disabled={disabled || item.quantity <= 1}
              onClick={() => onQuantityChange(item.quantity - 1)}
              className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-sm font-medium tabular-nums">
              {item.quantity}
            </span>
            <button
              type="button"
              aria-label="수량 늘리기"
              disabled={disabled || atMax}
              onClick={() => onQuantityChange(item.quantity + 1)}
              className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <div className="text-right">
            <p className="text-base font-bold">{formatPrice(lineTotal)}</p>
            {hasDiscount && (
              <p className="text-xs text-muted-foreground line-through">
                {formatPrice(lineOriginal)}
              </p>
            )}
          </div>
        </div>

        {/* 상한 도달 안내 — 남은 재고 수량은 노출하지 않는다(상품 상세와 동일 방침) */}
        {atMax && !disabled && (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            더 담을 수 있는 재고가 없어요.
          </p>
        )}
      </div>
    </article>
  );
}
