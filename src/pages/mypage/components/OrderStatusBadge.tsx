import { cn } from "@/lib/utils";
import type { OrderStatus } from "../types";

// 배송 상태별 표시명·색상. 토큰 팔레트(회색/포인트) 범위 내에서 상태만 구분.
const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  PREPARING: { label: "배송준비중", className: "bg-amber-50 text-amber-700" },
  SHIPPING: { label: "배송중", className: "bg-blue-50 text-blue-700" },
  DELIVERED: { label: "배송완료", className: "bg-green-50 text-green-700" },
  CONFIRMED: { label: "구매확정", className: "bg-muted text-muted-foreground" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, className } = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold",
        className,
      )}
    >
      {label}
    </span>
  );
}
