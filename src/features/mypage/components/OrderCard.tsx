"use client";

import Link from "next/link";

import { ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/shared/ui/ProductImage";
import { formatPrice } from "@/shared/utils/formatPrice";
import {
  buildClaimedNotice,
  canClaimItem,
  canReviewItemStatus,
  hasMixedItemStatus,
  isClaimedItemStatus,
  ORDER_STATUS_LABEL,
  resolveHeaderStatus,
  type Order,
  type OrderItem,
} from "../types";
import { OrderStatusBadge } from "./OrderStatusBadge";

// 후기·취소·반품 판정은 전부 types.ts 가 한다 — 여기서 다시 쓰지 않는다.
// CLAIM_IN_PROGRESS·COMPLETED는 이미 클레임이 걸렸거나 종결돼 어느 쪽도 통과하지 않는다.

// 액션 버튼 공통 스타일 (칩 형태).
// press 피드백은 100~160ms — 눌렀다는 사실만 전하면 되므로 길면 굼떠 보인다.
// hover는 (hover:hover)로 막는다: 터치에서는 탭이 hover로 잡혀 손을 뗀 뒤에도
// 배경색이 남는다. transition은 실제 바뀌는 두 속성만 지정한다(all 금지).
const actionButtonClass = cn(
  "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium",
  "transition-[transform,scale,background-color] duration-150 ease-out-strong",
  "active:scale-[0.97] hover:[@media(hover:hover)]:bg-muted",
);

function ItemRow({
  item,
  showStatus,
}: {
  item: OrderItem;
  showStatus: boolean;
}) {
  // 가라앉히기는 "빠진 것 vs 남은 것"의 대비가 목적이라, 대비할 상대가 있을 때만
  // 건다(showStatus = 주문 안에서 상태가 갈림). 전량 취소된 주문에 그대로 걸면
  // 모든 줄이 회색·취소선이 돼 카드 전체가 죽고, 정작 무엇이 취소됐는지는
  // 대표 배지 말고는 알 수 없게 된다.
  const claimed = showStatus && isClaimedItemStatus(item.status);

  return (
    <div className="flex gap-4 px-5 py-4">
      {/* 취소된 줄이어도 사진은 원래 색으로 둔다 — 흐리면 어떤 상품이었는지
          알아보기 어려워진다. 취소 여부는 상품명 회색·가격 취소선·상태 문구로 이미 드러난다. */}
      <ProductImage
        src={item.imageUrl}
        alt=""
        className="size-16 shrink-0 rounded-sm bg-muted object-cover ring-1 ring-black/5 sm:size-20"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            claimed && "text-muted-foreground",
          )}
        >
          {item.productName}
        </p>
        <p className="text-xs text-muted-foreground">
          {showStatus && (
            // 취소·반품 줄만 색으로 띄운다 — 어느 상품이 빠졌는지 찾으려고 보는
            // 화면이라 그 줄이 먼저 눈에 들어와야 한다. 나머지는 회색으로 배경에 둔다.
            <span className={cn("font-medium", claimed && "text-amber-700")}>
              {ORDER_STATUS_LABEL[item.status] ?? item.status}
            </span>
          )}
          {showStatus && " · "}
          {item.optionName ? `${item.optionName} / ` : ""}
          {item.quantity}개
        </p>
        <p
          className={cn(
            "mt-0.5 text-sm font-bold",
            // 취소된 줄의 가격에 취소선 — 결제에서 빠진 금액임을 형태로 알린다
            claimed && "font-medium text-muted-foreground line-through",
          )}
        >
          {formatPrice(item.price)}
        </p>
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
  const detailHref = `/mypage/orders/${order.orderId}`;
  // 부분 취소처럼 상태가 갈린 주문에서만 줄마다 상태를 밝힌다 (판정은 types.ts)
  const showItemStatus = hasMixedItemStatus(order.items);
  // 대표 배지는 배송·결제 진행 축이라 "일부가 취소됨"을 담지 못한다. 다른 축이므로
  // 배지에 섞지 않고(섞으면 부분 취소된 주문의 배송 상태를 표현할 수 없다)
  // 건수를 별도 줄로 밝힌다 — 리스트를 끝까지 보지 않아도 알 수 있게 목록 위에 둔다.
  const claimedNotice = buildClaimedNotice(order.items);

  return (
    <article className="overflow-hidden rounded-sm border bg-background">
      {/* 헤더: 상태 + 주문일 + 주문번호 / 우측 주문 상세 */}
      <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <OrderStatusBadge status={resolveHeaderStatus(order)} />
          <span className="truncate text-sm text-muted-foreground">
            {order.orderedAt.slice(0, 10).replace(/-/g, ".")} · {order.orderNo}
          </span>
        </div>
        <Link
          href={detailHref}
          className="flex shrink-0 items-center gap-0.5 text-sm text-muted-foreground transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:text-foreground"
        >
          주문 상세
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {claimedNotice && (
        <p className="flex items-center gap-1.5 border-b bg-amber-50/50 px-5 py-2.5 text-xs font-medium text-amber-800">
          <Info className="size-3.5 shrink-0" aria-hidden />
          {claimedNotice}
        </p>
      )}

      {/* 상품 목록 — 좌우 여백은 각 행(ItemRow)이 갖는다.
          여기에 px-5 를 주면 divide-y 구분선이 여백 안쪽에서만 그어져
          헤더·안내 줄의 경계선보다 짧아진다. */}
      <div className="divide-y">
        {order.items.map((item) => (
          <ItemRow
            key={item.orderItemId}
            item={item}
            showStatus={showItemStatus}
          />
        ))}
      </div>

      {/* 하단 액션 — 전부 주문 상세로 보낸다. 실제 동작하는 것만 둔다 */}
      {(reviewable || cancelable || returnable) && (
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
          {/* 배송 조회는 두지 않는다 — 조회 API 도 송장 데이터도 없어서, 눌러도
              "준비 중"만 뜨는 버튼이었다. 배송중 주문에서 가장 누르고 싶은 자리에
              있어 기대만 만든다. 실제 조회가 가능해지면 그때 붙인다. */}
        </div>
      )}
    </article>
  );
}
