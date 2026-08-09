"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  ImageOff,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/shared/ui/ProductImage";
import { hoverMuted, numeric, pressable } from "../interaction";
import type {
  ChatAction,
  DraftSection,
  SellerDraft,
} from "@/shared/types/chat";

interface ProductCreateCardProps {
  draft: SellerDraft;
  /** 확정된 결과(등록 완료·실패). 있으면 확인 버튼 대신 결과를 표시한다. */
  settled?: ChatAction;
  onConfirm: (draftId: string) => void;
  onCancel: (draftId: string) => void;
  disabled?: boolean;
}

/**
 * sections.kind 별 표시 규칙.
 *
 * 모르는 kind 는 무시한다(계약) — 종류가 늘어도 FE 배포 없이 서버만 바뀌면 되게 한 구조라,
 * 여기에 없는 값이 오면 렌더하지 않는 것이 맞다.
 *
 * warning 만 기본 펼침이다. "카테고리는 등록 후 변경할 수 없습니다" 같은 되돌릴 수 없는
 * 내용이 여기 들어가므로 접어두면 안 된다. source(근거)는 접어 카드를 짧게 유지한다.
 */
const SECTION_STYLE: Record<
  string,
  { icon: typeof Info; cls: string; defaultOpen: boolean }
> = {
  warning: {
    icon: TriangleAlert,
    cls: "border-amber-200 bg-amber-50 text-amber-800",
    defaultOpen: true,
  },
  source: {
    icon: Info,
    cls: "border-border bg-muted/50 text-muted-foreground",
    defaultOpen: false,
  },
  note: {
    icon: Check,
    cls: "border-brand/20 bg-brand/5 text-brand",
    defaultOpen: true,
  },
};

function SectionBlock({ section }: { section: DraftSection }) {
  const style = SECTION_STYLE[section.kind];
  const [open, setOpen] = useState(style?.defaultOpen ?? false);

  // 모르는 kind 는 렌더하지 않는다
  if (!style) return null;

  const Icon = style.icon;

  return (
    <div className={cn("rounded-sm border px-3 py-2.5", style.cls)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-bold">
          <Icon className="size-3.5 shrink-0" />
          {section.title}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-150 ease-out-strong",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul className="mt-2 flex flex-col gap-1">
          {section.items.map((item, i) => (
            <li key={i} className="text-[13px] leading-relaxed">
              · {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * 상품 등록 초안 카드(HITL 승인 대기) — op === "create" 전용.
 *
 * 수정·삭제(ProductDiffCard)와 분리한 이유: 등록은 before 가 전부 비어 있어
 * 전·후 비교가 무의미하다. 그대로 태우면 취소선 친 빈 칸이 화살표와 함께 늘어선다.
 *
 * **changes 가 아니라 preview 를 그린다.** changes 는 실행 정본이고 표시용 포맷이
 * 아니다 — 금액 역파싱·카테고리 경로 변환을 FE 가 떠안지 않으려는 계약 구조다.
 * [등록]은 draftId 만 보낸다(보여준 것 == 실행). [취소]는 서버 호출 없이 카드만 닫는다.
 */
export function ProductCreateCard({
  draft,
  settled,
  onConfirm,
  onCancel,
  disabled,
}: ProductCreateCardProps) {
  const preview = draft.preview;
  const failed = settled?.type === "PRODUCT_UPDATE_FAILED";

  // preview 없이 create 가 오는 건 계약 위반이지만, 그 턴에 카드가 통째로 사라지면
  // 판매자는 초안이 온 줄도 모른다 — summary 만이라도 띄우고 승인은 그대로 받는다.
  if (!preview) {
    return (
      <section className="flex flex-col gap-4 rounded-sm border bg-background p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">
            상품 등록
          </span>
          <h3 className="text-base font-bold tracking-tight">
            {draft.summary}
          </h3>
        </div>
        <ConfirmRow
          draftId={draft.draftId}
          settled={settled}
          failed={failed}
          disabled={disabled}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-sm border bg-background p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-muted-foreground">
          상품 등록
        </span>
        <h3 className="text-base font-bold tracking-tight">{draft.summary}</h3>
      </div>

      {/* 대표 이미지 + 핵심 값 — 판매자가 등록 버튼을 누르기 전에 확인할 것들 */}
      <div className="flex gap-4">
        <div className="relative shrink-0">
          {/* null 이면 ProductImage 가 대체 화면을 그린다 */}
          <ProductImage
            src={preview.imageUrl}
            alt=""
            className="size-24 rounded-sm bg-muted object-cover"
          />
          {/* 등록 후에 "이미지가 없네"를 알아채는 걸 막는 배지 */}
          {preview.imagePlaceholder && (
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-sm bg-foreground/70 py-1 text-[10px] font-semibold text-background">
              <ImageOff className="size-3" />
              이미지 미등록
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="font-bold leading-tight">{preview.title}</p>

          <div className="flex flex-wrap items-baseline gap-x-2">
            {/* priceText·stockText 는 서버가 포맷을 마쳤다 — 콤마·단위를 다시 붙이지 않는다 */}
            <span className={cn("text-lg font-bold", numeric)}>
              {preview.priceText}
            </span>
            {preview.originalPriceText && (
              <span
                className={cn(
                  "text-sm text-muted-foreground line-through",
                  numeric,
                )}
              >
                {preview.originalPriceText}
              </span>
            )}
            {/* 0% 는 할인이 아니다 — 배지를 숨긴다 */}
            {preview.discountRate > 0 && (
              <span
                className={cn(
                  "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive",
                  numeric,
                )}
              >
                {preview.discountRate}%
              </span>
            )}
          </div>

          <p className={cn("text-sm text-muted-foreground", numeric)}>
            재고 {preview.stockText}
          </p>
          <p className="text-xs text-muted-foreground">
            {preview.categoryPath}
          </p>
        </div>
      </div>

      {preview.summary && (
        <p className="text-sm leading-relaxed">{preview.summary}</p>
      )}

      {preview.description && (
        <p className="whitespace-pre-wrap rounded-sm bg-muted/50 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
          {preview.description}
        </p>
      )}

      {preview.sections.length > 0 && (
        <div className="flex flex-col gap-2">
          {preview.sections.map((s, i) => (
            <SectionBlock key={i} section={s} />
          ))}
        </div>
      )}

      <ConfirmRow
        draftId={draft.draftId}
        settled={settled}
        failed={failed}
        disabled={disabled}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </section>
  );
}

/** 승인·취소 줄 — 확정 결과가 오면 버튼 대신 결과를 보여준다 */
function ConfirmRow({
  draftId,
  settled,
  failed,
  disabled,
  onConfirm,
  onCancel,
}: {
  draftId: string;
  settled?: ChatAction;
  failed: boolean;
  disabled?: boolean;
  onConfirm: (draftId: string) => void;
  onCancel: (draftId: string) => void;
}) {
  if (settled) {
    return (
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
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <p className="text-sm text-muted-foreground">
        위 내용으로 상품을 등록할까요?
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onConfirm(draftId)}
          disabled={disabled}
          className={cn(
            "inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground",
            pressable,
            "hover:[@media(hover:hover)]:opacity-90",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          <Check className="size-4" />
          등록
        </button>
        <button
          type="button"
          onClick={() => onCancel(draftId)}
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
  );
}
