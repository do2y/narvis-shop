import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABEL, type OrderStatus } from "../types";

// 상태별 색상. 토큰 팔레트(회색/포인트) 범위 내에서 상태만 구분.
// 표시명은 ORDER_STATUS_LABEL과 공유해 한 곳에서 관리한다.
const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PAYMENT_FAILED: "bg-red-50 text-red-700",
  ORDERED: "bg-blue-50 text-blue-700",
  PREPARING: "bg-amber-50 text-amber-700",
  SHIPPING: "bg-blue-50 text-blue-700",
  DELIVERED: "bg-green-50 text-green-700",
  CONFIRMED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  // 백엔드가 새 상태를 추가해도 화면이 깨지지 않도록 fallback을 둔다.
  const label = ORDER_STATUS_LABEL[status] ?? status;
  const className = STATUS_CLASS[status] ?? "bg-muted text-muted-foreground";
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
