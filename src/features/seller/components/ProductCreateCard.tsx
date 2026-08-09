"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  CircleAlert,
  Info,
  Loader2,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hoverMuted, pressable } from "../interaction";
import { ChangesFields, PreviewFields } from "./DraftReviewFields";
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
  /** 스트림 진행 중 — 초안이 갱신될 수 있어 확정을 막는다 */
  disabled?: boolean;
  /**
   * 이번 턴의 대화가 오류로 끝났는지. 좌측 말풍선의 실패를 우측에도 반영한다 —
   * 없으면 "통신 실패" 아래에서 [등록]이 멀쩡히 눌리는 모순된 화면이 된다.
   */
  streamError?: string;
  onRetry?: () => void;
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

/** 헤더 우측 상태 배지 — 지금 어느 단계인지 한 단어로 */
function StatusBadge({
  tone,
  children,
}: {
  tone: "review" | "busy" | "done" | "error";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "review" && "bg-brand/10 text-brand",
        tone === "busy" && "bg-muted text-muted-foreground",
        tone === "done" && "bg-brand text-brand-foreground",
        tone === "error" && "bg-destructive/10 text-destructive",
      )}
    >
      {tone === "busy" && (
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
      )}
      {children}
    </span>
  );
}

/**
 * 상품 등록 초안 검토 화면(HITL 승인 대기) — op === "create" 전용.
 *
 * 수정·삭제(ProductDiffCard)와 분리한 이유: 등록은 before 가 전부 비어 있어
 * 전·후 비교가 무의미하다. 그대로 태우면 취소선 친 빈 칸이 화살표와 함께 늘어선다.
 *
 * 본문은 preview(서버 표시 사본)가 있으면 그것을, 없으면 changes 를 그린다.
 * 계약 문서 §3.6 실측 기준으로 **지금은 changes 만 온다** — preview 는 타입에만 있다.
 * [등록]은 draftId 만 보낸다(보여준 것 == 실행). [취소]는 서버 호출 없이 카드만 닫는다.
 */
export function ProductCreateCard({
  draft,
  settled,
  onConfirm,
  onCancel,
  disabled,
  streamError,
  onRetry,
}: ProductCreateCardProps) {
  const preview = draft.preview;
  const failed = settled?.type === "PRODUCT_UPDATE_FAILED";
  const succeeded = !!settled && !failed;

  // 화면 상태 한 곳에서 결정 — 배지·푸터·본문 흐림이 전부 이 값을 따른다.
  // 순서가 우선순위다: 확정 결과 > 스트림 오류 > 처리 중 > 검토 가능
  const state = settled
    ? failed
      ? "error"
      : "done"
    : streamError
      ? "error"
      : disabled
        ? "busy"
        : "review";

  return (
    // 넓은 화면에서 검토 내용이 가로로 늘어지지 않게 상한을 준다 —
    // 읽는 화면이라 한 줄이 길면 다음 줄 첫 글자를 찾기 어렵다
    <section className="mx-auto flex w-full max-w-3xl flex-col">
      {/* 제목 + 상태 — "지금 무슨 단계인가"를 작업이 일어나는 이 패널에서 답한다.
          (좌측 입력창 위에 있던 "등록 초안 검토 중" 바를 여기로 옮긴 자리) */}
      <header className="flex flex-wrap items-center justify-between gap-2 pb-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-lg font-bold tracking-tight">상품 등록 초안</h2>
          <p className="text-sm text-muted-foreground">
            {state === "done"
              ? "등록이 완료되었어요."
              : state === "error"
                ? "문제가 생겨 등록을 진행할 수 없어요."
                : "등록 전 내용을 확인해 주세요."}
          </p>
        </div>
        <StatusBadge tone={state}>
          {state === "done"
            ? "등록 완료"
            : state === "error"
              ? "오류"
              : state === "busy"
                ? "처리 중"
                : "검토 중"}
        </StatusBadge>
      </header>

      {/* 본문 — 확정·오류 상태에서는 흐려 "지금 만질 것이 아니다"를 전한다.
          지우지는 않는다: 무엇을 등록했는지/등록하려 했는지는 계속 보여야 한다 */}
      <div
        className={cn(
          "transition-opacity duration-150 ease-out-strong",
          (succeeded || state === "error") && "opacity-60",
        )}
      >
        {preview ? (
          <PreviewFields preview={preview} />
        ) : (
          <ChangesFields draft={draft} />
        )}

        {preview && preview.sections.length > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            {preview.sections.map((s, i) => (
              <SectionBlock key={i} section={s} />
            ))}
          </div>
        )}
      </div>

      {/* 채팅으로 고칠 수 있다는 관계를 검토 내용 바로 아래에서 알린다 —
          좌우가 떨어져 있어 말해주지 않으면 "수정하려면 취소해야 하나"로 읽힌다 */}
      {state === "review" && (
        <p className="mt-4 rounded-sm bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
          고칠 내용이 있으면 왼쪽 채팅으로 알려주세요 — 예: “재고를 30개로
          바꿔줘”
        </p>
      )}

      <ConfirmFooter
        draftId={draft.draftId}
        state={state}
        settled={settled}
        streamError={streamError}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onRetry={onRetry}
      />
    </section>
  );
}

/**
 * 액션 영역 — 검토 내용 아래 sticky 로 붙인다.
 *
 * 카드 중간이 아니라 하단에 두는 이유: 설명이 길면 버튼이 스크롤 위로 밀려나
 * "확인했으니 이제 누른다"는 순서가 깨진다. sticky 라 스크롤 어디서든 손에 닿는다.
 */
function ConfirmFooter({
  draftId,
  state,
  settled,
  streamError,
  onConfirm,
  onCancel,
  onRetry,
}: {
  draftId: string;
  state: "review" | "busy" | "done" | "error";
  settled?: ChatAction;
  streamError?: string;
  onConfirm: (draftId: string) => void;
  onCancel: (draftId: string) => void;
  onRetry?: () => void;
}) {
  // 등록 완료 — 결과와 다음 행동. 상세로는 못 간다(등록된 productId 가 응답에 없다)
  if (state === "done") {
    return (
      <div className="mt-6 flex flex-col gap-3 border-t pt-5">
        <p className="flex items-start gap-2 text-sm font-medium text-brand">
          <Check className="mt-0.5 size-4 shrink-0" />
          {settled?.message ?? "상품이 등록되었어요."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/seller/products"
            className={cn(
              "inline-flex h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground",
              pressable,
              "hover:[@media(hover:hover)]:opacity-90",
            )}
          >
            상품 목록 보기
          </Link>
          <button
            type="button"
            onClick={() => onCancel(draftId)}
            className={cn(
              "inline-flex h-11 items-center rounded-full border px-5 text-sm font-medium text-muted-foreground",
              pressable,
              hoverMuted,
              "hover:[@media(hover:hover)]:text-foreground",
            )}
          >
            새 상품 등록
          </button>
        </div>
      </div>
    );
  }

  // 오류 — 등록을 막고 재시도를 주 행동으로. 좌측 말풍선의 실패와 같은 사실을 말한다
  if (state === "error") {
    const message = settled?.message ?? streamError;
    return (
      <div className="sticky bottom-0 mt-6 flex flex-col gap-3 border-t bg-muted/30 pb-1 pt-5 backdrop-blur">
        <p className="flex items-start gap-2 text-sm font-medium text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {message ?? "상품 등록에 실패했어요."}
        </p>
        <div className="flex flex-wrap gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full bg-foreground px-5 text-sm font-semibold text-background",
                pressable,
                "hover:[@media(hover:hover)]:opacity-90",
              )}
            >
              <RotateCcw className="size-4" />
              다시 시도
            </button>
          )}
          <button
            type="button"
            onClick={() => onCancel(draftId)}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-full border px-5 text-sm font-medium text-muted-foreground",
              pressable,
              hoverMuted,
              "hover:[@media(hover:hover)]:text-foreground",
            )}
          >
            <X className="size-4" />
            초안 닫기
          </button>
        </div>
      </div>
    );
  }

  const busy = state === "busy";

  return (
    // sticky bottom-0: 스크롤이 길어져도 액션이 화면에 남는다.
    // 배경은 워크스페이스와 같은 톤 — 떠 있는 바가 아니라 "영역의 바닥"으로 읽히게
    <div className="sticky bottom-0 mt-6 flex flex-col gap-3 border-t bg-muted/30 pb-1 pt-5 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onConfirm(draftId)}
          disabled={busy}
          className={cn(
            "inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground",
            pressable,
            "hover:[@media(hover:hover)]:opacity-90",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <Check className="size-4" />
          )}
          {busy ? "등록 중…" : "상품 등록"}
        </button>
        <button
          type="button"
          onClick={() => onCancel(draftId)}
          disabled={busy}
          className={cn(
            "inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted-foreground",
            pressable,
            hoverMuted,
            "hover:[@media(hover:hover)]:text-foreground",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          취소
        </button>
      </div>
      {/* 실행 결과를 미리 알린다 — 되돌리기 어려운 동작 앞에서 예측 가능하게 */}
      <p className="text-xs text-muted-foreground">
        {busy
          ? "등록을 처리하고 있어요. 잠시만 기다려 주세요."
          : "등록하면 바로 판매 상태로 전환돼요. 등록 후에도 상품 관리에서 수정할 수 있어요."}
      </p>
    </div>
  );
}
