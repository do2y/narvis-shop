import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { numeric } from "../interaction";
import type { SellerOrderStatus, SellerSummary } from "../types";
import { SectionBadge, SectionHeading } from "./SectionHeading";

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
  hint: string;
}[] = [
  { status: "ORDERED", label: "신규 주문", hint: "발송 필요" },
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
    <section className="flex flex-col gap-5">
      <SectionHeading
        title="오늘 처리할 일"
        trailing={
          <SectionBadge>
            진행 중{" "}
            {/* 숫자만 진하게 — 배지 전체를 강조하면 제목과 경쟁한다 */}
            <span className={cn("font-semibold text-foreground", numeric)}>
              {orderStatus.activeTotal}
            </span>
            건
          </SectionBadge>
        }
        action={
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
        }
      />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {TODO_CARDS.map((c) => {
          const count = orderStatus.counts[c.status] ?? 0;
          // 0건이면 눌러도 빈 목록이다 — 숫자를 흐리게 내려 "여긴 볼 것 없다"를
          // 한눈에 읽히게 한다. 타일 자체는 남긴다(자리가 고정돼야 다음에 찾기 쉽다).
          const idle = count === 0;

          return (
            // 실제 이동 경로가 있다(/seller/orders?status=… → OrdersPage 가
            // normalizeTab 으로 받는 딥링크). 그래서 링크 역할과 포커스는 남긴다.
            // 다만 채운 면·테두리 카드는 걷어낸다 — 지표 4칸이 버튼 4개처럼 보이면
            // 현황을 읽는 자리가 조작 영역으로 읽힌다. 구분은 여백과 얇은 선이 맡는다.
            <Link
              key={c.status}
              href={`/seller/orders?status=${c.status}`}
              className={cn(
                "flex flex-col gap-0.5 rounded-sm px-3 py-2.5",
                "transition-colors duration-150 ease-out-strong",
                "hover:[@media(hover:hover)]:bg-muted/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span className="text-xs font-medium text-muted-foreground">
                {c.label}
              </span>
              <span
                className={cn(
                  "text-2xl font-bold tracking-tight",
                  numeric,
                  // 강조는 색이 아니라 진하기로만 — 채운 면을 쓰면 카드가 된다
                  idle ? "text-muted-foreground/40" : "text-foreground",
                )}
              >
                {count}
                <span className="ml-0.5 text-xs font-medium">건</span>
              </span>
              {/* 상태 이름만으로는 무엇을 해야 하는지 모른다 — 0건이어도 남겨
                  칸이 비어 보이지 않게 한다 */}
              <span className="text-xs text-muted-foreground/70">{c.hint}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
