"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/shared/utils/formatPrice";

// 결제 금액 요약 + 결제 버튼. 넓은 화면에선 우측 sticky.
export function OrderSummary({
  itemsTotal,
  discount,
  canSubmit,
  paying,
  error,
  unrecoverable = false,
  onSubmit,
  onLeave,
}: {
  itemsTotal: number;
  discount: number;
  canSubmit: boolean;
  paying: boolean; // 승인 대기 중
  error: string | null; // 결제 실패 안내 (있으면 재시도 유도)
  /**
   * 다시 시도해도 성공할 수 없는 실패(재고 부족) — 결제 버튼 대신 장바구니로 보낸다.
   * 재시도 버튼을 그대로 두면 사용자가 같은 실패를 무한히 반복하게 된다(O-1·O-2).
   */
  unrecoverable?: boolean;
  onSubmit: () => void;
  /** 장바구니로 떠나기 직전 — 결제 항목 스냅샷을 비우는 데 쓴다 */
  onLeave?: () => void;
}) {
  const finalTotal = itemsTotal - discount;

  return (
    <div className="rounded-sm border bg-background p-5 sm:p-6 lg:sticky lg:top-20">
      <h2 className="text-lg font-bold">결제 금액</h2>

      <dl className="mt-4 flex flex-col gap-2.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">상품 금액</dt>
          <dd className="font-medium">{formatPrice(itemsTotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">할인 금액</dt>
          <dd className="font-medium text-red-500">
            -{formatPrice(discount)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">배송비</dt>
          <dd className="font-medium">무료</dd>
        </div>
      </dl>

      <div className="mt-5 flex items-baseline justify-between border-t pt-5">
        <span className="text-base font-bold">최종 결제 금액</span>
        <span className="text-xl font-bold">{formatPrice(finalTotal)}</span>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {unrecoverable ? (
        <Link
          href="/cart"
          onClick={onLeave}
          className={cn(
            buttonVariants(),
            "mt-5 h-12 w-full rounded-sm text-base",
          )}
        >
          장바구니로 이동
        </Link>
      ) : (
        <Button
          className="mt-5 h-12 w-full rounded-sm text-base"
          disabled={!canSubmit || paying}
          onClick={onSubmit}
        >
          {paying
            ? "결제 처리 중…"
            : error
              ? "다시 시도"
              : `${formatPrice(finalTotal)} 결제하기`}
        </Button>
      )}
    </div>
  );
}
