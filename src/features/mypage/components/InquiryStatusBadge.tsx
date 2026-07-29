import { cn } from "@/lib/utils";
import type { InquiryStatus } from "../types";

// 문의 처리 상태 — ClaimBadges와 동일한 토큰 팔레트(상태 구분에만 포인트 색).
const STATUS_META: Record<InquiryStatus, { label: string; className: string }> =
  {
    PENDING: { label: "처리중", className: "bg-amber-50 text-amber-700" },
    ANSWERED: { label: "답변완료", className: "bg-green-50 text-green-700" },
  };

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  const { label, className } = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold",
        className,
      )}
    >
      {label}
    </span>
  );
}
