"use client";

import { useState } from "react";
import { ArrowRight, Check, CircleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hoverMuted, numeric, pressable } from "../interaction";
import {
  DraftApprovalNotice,
  DuplicateRiskConfirm,
  DuplicateRiskWarning,
  isApprovalLocked,
} from "./DraftApprovalNotice";
import type {
  DraftApproval,
  ChatAction,
  SellerDraft,
  SellerDraftField,
} from "@/shared/types/chat";

interface ProductDiffCardProps {
  draft: SellerDraft;
  /** 확정된 결과(수정 완료·실패). 있으면 확인 버튼 대신 결과를 표시한다. */
  settled?: ChatAction;
  approval?: DraftApproval;
  approvalMessage?: string;
  /** 이전 승인의 처리 여부가 불명확한 대상 — 경고하고 한 번 더 확인받는다 */
  duplicateRisk?: boolean;
  onAcknowledge?: (draftId: string) => void;
  onConfirm: (draftId: string) => void;
  onCancel: (draftId: string) => void;
  disabled?: boolean;
}

// draft.op 별 카드 라벨 — 수정/등록/삭제
const OP_LABEL: Record<SellerDraft["op"], string> = {
  update: "상품 정보 수정",
  create: "상품 등록",
  delete: "상품 삭제",
};

// field(camelCase 8종) → 화면 라벨
const FIELD_LABEL: Record<SellerDraftField, string> = {
  name: "상품명",
  price: "판매가",
  originalPrice: "정상가",
  description: "상품 설명",
  category: "카테고리",
  imageUrl: "이미지",
  status: "판매 상태",
  stockQuantity: "재고",
};

// 금액 필드는 천단위·원 표기, 나머지는 그대로
function formatValue(field: string, v: string | number): string {
  if (
    (field === "price" ||
      field === "originalPrice") &&
    typeof v === "number"
  ) {
    return `${v.toLocaleString("ko-KR")}원`;
  }
  if (field === "stockQuantity" && typeof v === "number") {
    return v.toLocaleString("ko-KR");
  }
  return String(v);
}

/**
 * 상품 정보 변경 전·후 비교 + 최종 확인 카드(HITL).
 * [적용]=confirm 전송(발화≠동의, 최상위 action/draftId). [취소]=서버 호출 없이 카드만 닫음.
 */
export function ProductDiffCard({
  draft,
  settled,
  approval,
  approvalMessage,
  duplicateRisk,
  onAcknowledge,
  onConfirm,
  onCancel,
  disabled,
}: ProductDiffCardProps) {
  const failed = settled?.type === "PRODUCT_UPDATE_FAILED";
  const [asking, setAsking] = useState(false);

  return (
    <section className="flex flex-col gap-4 rounded-sm border bg-background p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-muted-foreground">
          {OP_LABEL[draft.op]}
        </span>
        <h3 className="text-base font-bold tracking-tight">{draft.summary}</h3>
      </div>

      <ul className="flex flex-col gap-3">
        {draft.changes.map((c) => {
          const label =
            FIELD_LABEL[c.field as SellerDraftField] ?? c.field;
          return (
            <li key={c.field} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {label}
              </span>
              {/* 좁은 화면에선 전→후가 세로로 쌓이도록 wrap */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-sm bg-muted px-2.5 py-1.5 text-sm text-muted-foreground line-through",
                    numeric,
                  )}
                >
                  {formatValue(c.field, c.before)}
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                <span
                  className={cn(
                    "rounded-sm bg-brand/10 px-2.5 py-1.5 text-sm font-semibold text-brand",
                    numeric,
                  )}
                >
                  {formatValue(c.field, c.after)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {settled ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-sm px-3 py-2.5 text-sm",
            failed
              ? "bg-destructive/10 text-destructive"
              : "bg-brand/10 text-brand",
          )}
        >
          {failed ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Check className="mt-0.5 size-4 shrink-0" />
          )}
          <span className="font-medium">{settled.message}</span>
        </div>
      ) : approval && isApprovalLocked(approval) ? (
        <div className="border-t pt-4">
          <DraftApprovalNotice
            approval={approval}
            message={approvalMessage}
            onClose={() => onCancel(draft.draftId)}
          />
        </div>
      ) : duplicateRisk && asking ? (
        <div className="flex flex-col gap-3 border-t pt-4">
          <DuplicateRiskWarning />
          <DuplicateRiskConfirm
            onAcknowledge={() => onAcknowledge?.(draft.draftId)}
            onBack={() => setAsking(false)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 border-t pt-4">
          {duplicateRisk && <DuplicateRiskWarning />}
          <p className="text-sm text-muted-foreground">
            위 내용으로 진행할까요?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                duplicateRisk ? setAsking(true) : onConfirm(draft.draftId)
              }
              disabled={disabled}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground",
                pressable,
                "hover:[@media(hover:hover)]:opacity-90",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <Check className="size-4" />
              적용
            </button>
            <button
              type="button"
              onClick={() => onCancel(draft.draftId)}
              disabled={disabled}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full border px-5 text-sm font-medium text-muted-foreground",
                pressable,
                hoverMuted,
                "hover:[@media(hover:hover)]:text-foreground",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <X className="size-4" />
              취소
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
