"use client";

import { useState } from "react";
import Link from "next/link";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/shared/ui/ProductImage";
import { formatPrice } from "@/shared/utils/formatPrice";
import {
  canClaimItem,
  canReviewItemStatus,
  type Order,
  type OrderItem,
} from "../types";
import { OrderStatusBadge } from "./OrderStatusBadge";

// 후기·취소·반품 판정은 전부 types.ts 가 한다 — 여기서 다시 쓰지 않는다.
// CLAIM_IN_PROGRESS·COMPLETED는 이미 클레임이 걸렸거나 종결돼 어느 쪽도 통과하지 않는다.

// 액션 버튼 공통 스타일 (칩 형태).
const actionButtonClass = cn(
  "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium",
  "transition-all hover:bg-muted active:scale-[0.97]",
);

function ItemRow({ item }: { item: OrderItem }) {
  return (
    <div className="flex gap-4 py-4">
      <ProductImage
        src={item.imageUrl}
        alt=""
        className="size-16 shrink-0 rounded-sm bg-muted object-cover ring-1 ring-black/5 sm:size-20"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate text-sm font-medium">{item.productName}</p>
        <p className="text-xs text-muted-foreground">
          {item.optionName ? `${item.optionName} / ` : ""}
          {item.quantity}개
        </p>
        <p className="mt-0.5 text-sm font-bold">{formatPrice(item.price)}</p>
      </div>
    </div>
  );
}

export function OrderCard({ order }: { order: Order }) {
  // 후기·신청 모두 상품 단위다 — 대표 상태로 판정하면 한 주문에 배송중과 배송완료가
  // 섞였을 때 실제로 가능한 줄이 있는데도 버튼이 사라지거나 그 반대가 된다.
  const reviewable = order.items.some((i) => canReviewItemStatus(i.status));
  const cancelable = order.items.some((i) => canClaimItem(i.status, "CANCEL"));
  const returnable = order.items.some((i) => canClaimItem(i.status, "RETURN"));
  // 배송중에만 노출되는 준비 중 액션(배송 조회) 클릭 시 하단에 한 줄 안내.
  const showTracking = order.representativeStatus === "SHIPPING";
  const [notice, setNotice] = useState(false);
  const detailHref = `/mypage/orders/${order.orderId}`;

  return (
    <article className="overflow-hidden rounded-sm border bg-background">
      {/* 헤더: 상태 + 주문일 + 주문번호 / 우측 주문 상세 */}
      <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <OrderStatusBadge status={order.representativeStatus} />
          <span className="truncate text-sm text-muted-foreground">
            {order.orderedAt.slice(0, 10).replace(/-/g, ".")} · {order.orderNo}
          </span>
        </div>
        <Link
          href={detailHref}
          className="flex shrink-0 items-center gap-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          주문 상세
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {/* 상품 목록 */}
      <div className="divide-y px-5">
        {order.items.map((item) => (
          <ItemRow key={item.orderItemId} item={item} />
        ))}
      </div>

      {/* 하단 액션 — 후기·취소·반품은 주문 상세로, 배송 조회는 준비 중 안내 */}
      {(reviewable || cancelable || returnable || showTracking || notice) && (
        <div className="flex flex-wrap items-center gap-2 border-t px-5 py-4">
          {/* 후기·취소·반품 모두 대상 상품을 골라야 하고, 그 선택은 주문 상세에서 한다 —
              거기엔 이미지·옵션·가격이 함께 있어 잘못 고를 일이 없다. 목록에서 처리하면
              첫 상품으로 고정되거나(후기) 상품명만 나열돼(모달) 식별 단서가 사라진다.
              후기는 특히 "이미 작성함"을 목록 응답만으로 알 수 없다 — 서버의 canReview 를
              쓰는 상세로 보내야 쓴 상품에 버튼이 다시 뜨지 않는다.
              상품이 하나뿐이어도 상세로 보낸다 — 같은 버튼이 주문에 따라 다르게
              동작하면 다음에 무슨 일이 생길지 예측할 수 없다. */}
          {reviewable && (
            <Link href={detailHref} className={actionButtonClass}>
              후기 작성
            </Link>
          )}
          {cancelable && (
            <Link href={detailHref} className={actionButtonClass}>
              주문 취소
            </Link>
          )}
          {returnable && (
            <Link href={detailHref} className={actionButtonClass}>
              반품 신청
            </Link>
          )}
          {showTracking && (
            <button
              type="button"
              onClick={() => setNotice(true)}
              className={actionButtonClass}
            >
              배송 조회
            </button>
          )}
          {notice && (
            <span className="text-xs text-muted-foreground">
              준비 중인 기능이에요.
            </span>
          )}
        </div>
      )}

    </article>
  );
}
