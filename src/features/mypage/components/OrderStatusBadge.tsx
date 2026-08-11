import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABEL, type OrderStatus } from "../types";

// 상태별 색상. 토큰 팔레트(회색/포인트) 범위 내에서 상태만 구분.
// 표시명은 ORDER_STATUS_LABEL과 공유해 한 곳에서 관리한다.
const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PAYMENT_FAILED: "bg-red-50 text-red-700",
  ORDERED: "bg-blue-50 text-blue-700",
  SHIPPING: "bg-blue-50 text-blue-700",
  DELIVERED: "bg-green-50 text-green-700",
  CONFIRMED: "bg-muted text-muted-foreground",
  CLAIM_IN_PROGRESS: "bg-amber-50 text-amber-700",
  // 요청 접수~승인 대기도 같은 진행 흐름이라 CLAIM_IN_PROGRESS 와 색을 맞춘다.
  CANCEL_REQUESTED: "bg-amber-50 text-amber-700",
  RETURN_REQUESTED: "bg-amber-50 text-amber-700",
  // 취소·반품은 종결됐어도 "받지 못한다"는 결과라 회색에 묻으면 안 된다 —
  // 진행 중(CLAIM_IN_PROGRESS)과 같은 계열로 묶어 한 흐름으로 읽히게 한다.
  CANCELLED: "bg-amber-50 text-amber-700",
  RETURNED: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-muted text-muted-foreground",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  // 백엔드가 새 상태를 추가해도 화면이 깨지지 않도록 fallback을 둔다.
  const label = ORDER_STATUS_LABEL[status] ?? status;
  const className = STATUS_CLASS[status] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-center text-xs leading-none font-semibold",
        className,
      )}
    >
      {label}
    </span>
  );
}
