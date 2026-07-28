import { formatPrice } from "@/shared/utils/formatPrice";
import type { Claim } from "../types";
import { ClaimStatusBadge, ClaimTypeBadge } from "./ClaimBadges";

// "2026-07-13T15:00:00+09:00" → "2026.07.13"
// 앞 10자만 쓰므로 Date 파싱 없이 서버가 준 날짜(KST) 그대로 표시된다.
function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

export function ClaimCard({ claim }: { claim: Claim }) {
  return (
    <article className="rounded-sm border bg-background px-5 py-4">
      {/* 상단: 상태·종류 뱃지 / 우측 신청일 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClaimStatusBadge status={claim.status} />
          <ClaimTypeBadge type={claim.type} />
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {formatDate(claim.requestedAt)}
        </span>
      </div>

      {/* 상품명 + 옵션·수량 */}
      <p className="mt-3 truncate text-base font-semibold">
        {claim.productName}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {claim.optionName ? `${claim.optionName} / ` : ""}
        {claim.quantity}개
      </p>

      {/* 사유·주문번호 + 환불 예정 금액 */}
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="min-w-0 text-sm text-muted-foreground">
          <span className="block truncate">사유: {claim.reason}</span>
          <span className="block truncate">{claim.orderNo}</span>
        </p>
        <span className="shrink-0 text-sm font-bold">
          {formatPrice(claim.refundAmount)}
        </span>
      </div>

      {/* 처리 완료 시점 — 미처리(null)면 표시하지 않는다 */}
      {claim.processedAt && (
        <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
          처리일 {formatDate(claim.processedAt)}
        </p>
      )}
    </article>
  );
}
