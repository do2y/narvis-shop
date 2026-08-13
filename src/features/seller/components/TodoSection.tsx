import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { numeric, pressableCard } from "../interaction";
import type { SellerOrderStatus, SellerSummary } from "../types";

/**
 * 오늘 처리할 일 4칸 — 업무 우선순위 순서다.
 *
 * 신규 주문이 가장 급하고(보내야 한다), 배송 중은 진행 감시, 배송 완료는 확정 대기,
 * 구매 확정은 이미 끝난 건이다. CANCELLED·RETURNED 는 활성 주문이 아니라 제외한다.
 * (구 "배송 준비"는 order_item.status 에 PREPARING 이 없어 2026-07-21자로 삭제)
 */
const TODO_CARDS: {
  status: SellerOrderStatus;
  label: string;
  /** 그 칸이 "지금 해야 할 일"인지 — 쌓이면 강조한다 */
  actionable?: boolean;
  hint: string;
}[] = [
  { status: "ORDERED", label: "신규 주문", actionable: true, hint: "발송 필요" },
  { status: "SHIPPING", label: "배송 중", hint: "배송사 이동 중" },
  { status: "DELIVERED", label: "배송 완료", hint: "확정 대기" },
  { status: "CONFIRMED", label: "구매 확정", hint: "정산 대상" },
];

export function TodoSection({
  orderStatus,
}: {
  orderStatus: SellerSummary["orderStatus"];
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            오늘 처리할 일
          </h2>
          <span className={cn("text-sm text-muted-foreground", numeric)}>
            진행 중 {orderStatus.activeTotal}건
          </span>
        </div>
        <Link
          href="/seller/orders"
          className={cn(
            "flex items-center gap-1 text-xs font-medium text-muted-foreground",
            "transition-colors duration-150 ease-out-strong",
            "hover:[@media(hover:hover)]:text-foreground",
          )}
        >
          주문 관리
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {TODO_CARDS.map((c) => {
          const count = orderStatus.counts[c.status] ?? 0;
          // 0건이면 눌러도 빈 목록이다 — 숫자를 흐리게 내려 "여긴 볼 것 없다"를
          // 한눈에 읽히게 한다. 타일 자체는 남긴다(자리가 고정돼야 다음에 찾기 쉽다).
          const idle = count === 0;
          // 처리 대기가 실제로 쌓였을 때만 강조한다 — 0건에도 같은 톤이면
          // "할 일 있음"으로 잘못 읽힌다.
          const urgent = c.actionable && !idle;

          return (
            <Link
              key={c.status}
              href={`/seller/orders?status=${c.status}`}
              className={cn(
                "flex flex-col gap-0.5 rounded-sm border p-3",
                pressableCard,
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                urgent
                  ? "border-foreground/20 bg-foreground text-background hover:[@media(hover:hover)]:bg-foreground/90"
                  : "hover:[@media(hover:hover)]:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium",
                  urgent ? "text-background/70" : "text-muted-foreground",
                )}
              >
                {c.label}
              </span>
              <span
                className={cn(
                  "text-2xl font-bold tracking-tight",
                  numeric,
                  idle && "text-muted-foreground/40",
                )}
              >
                {count}
                <span className="ml-0.5 text-xs font-medium">건</span>
              </span>
              {/* 상태 이름만으로는 무엇을 해야 하는지 모른다 — 0건이어도 남겨
                  칸이 비어 보이지 않게 한다 */}
              <span
                className={cn(
                  "text-xs",
                  urgent ? "text-background/70" : "text-muted-foreground/70",
                )}
              >
                {c.hint}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
