"use client";

import Link from "next/link";
import { CircleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONFIRM_UNKNOWN } from "@/shared/chat/draftApproval";
import type { DraftApproval } from "@/shared/types/chat";
import { hoverMuted, pressable } from "../interaction";

const LOCKED_MESSAGE = {
  unknown: CONFIRM_UNKNOWN,
  closed:
    "결과를 확정하지 못했어요. 왼쪽 안내와 상품 목록을 확인해 주세요. 이 초안은 다시 승인할 수 없어요.",
};

const secondaryButton = cn(
  "inline-flex h-11 items-center gap-1.5 rounded-full border px-5 text-sm font-medium text-muted-foreground",
  pressable,
  hoverMuted,
  "hover:[@media(hover:hover)]:text-foreground",
);

/** 같은 초안을 다시 승인할 수 없는 상태인가 — 등록·수정 카드가 같은 판정을 쓴다 */
export function isApprovalLocked(approval?: DraftApproval): boolean {
  return approval === "unknown" || approval === "closed" || approval === "rejected";
}

/**
 * 잠긴 초안의 안내. closed 는 실패도 성공도 아니라 중립으로 그린다 — 체크 표시를 쓰지 않는다.
 * 초안을 닫아도 서버에 취소를 알리지 않는다(닫는다고 처리 여부가 바뀌지 않는다).
 */
export function DraftApprovalNotice({
  approval,
  message,
  onClose,
}: {
  approval: DraftApproval;
  message?: string;
  onClose: () => void;
}) {
  const neutral = approval === "closed";
  const text =
    approval === "rejected"
      ? message
      : LOCKED_MESSAGE[approval === "closed" ? "closed" : "unknown"];

  return (
    <div className="flex flex-col gap-3">
      <p
        className={cn(
          "flex items-start gap-2 text-sm font-medium",
          neutral ? "text-muted-foreground" : "text-destructive",
        )}
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        {text}
      </p>
      <div className="flex flex-wrap gap-2">
        {approval !== "rejected" && (
          <Link href="/seller/products" className={secondaryButton}>
            상품 목록 보기
          </Link>
        )}
        <button type="button" onClick={onClose} className={secondaryButton}>
          <X className="size-4" />
          초안 닫기
        </button>
      </div>
    </div>
  );
}

/**
 * 이전 승인의 처리 여부가 불명확할 때의 경고.
 * 사용자에게 알리는 절차일 뿐 중복 실행을 막지 못한다 — 실제 방지에는 서버의 멱등 처리가 필요하다.
 */
export function DuplicateRiskWarning() {
  return (
    <p className="flex items-start gap-2 text-sm font-medium text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      이전 승인 결과를 확인하지 못했어요. 같은 내용을 다시 승인하면 중복으로
      등록·수정·삭제될 수 있어요. 상품 목록에서 먼저 확인해 주세요.
    </p>
  );
}

/** 경고 대상 초안의 승인 2단계 — 바로 보내지 않고 한 번 더 확인한다 */
export function DuplicateRiskConfirm({
  onAcknowledge,
  onBack,
}: {
  onAcknowledge: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/seller/products" className={secondaryButton}>
        상품 목록 보기
      </Link>
      <button
        type="button"
        onClick={onAcknowledge}
        className={cn(
          "inline-flex h-11 items-center gap-1.5 rounded-full bg-foreground px-5 text-sm font-semibold text-background",
          pressable,
          "hover:[@media(hover:hover)]:opacity-90",
        )}
      >
        확인했고 승인
      </button>
      <button type="button" onClick={onBack} className={secondaryButton}>
        돌아가기
      </button>
    </div>
  );
}
