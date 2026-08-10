"use client";

import { Lock, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PREDICATE_STYLE } from "../predicateStyle";
import type { PreferenceEdge } from "../types";

interface PreferenceItemProps {
  edge: PreferenceEdge;
  /** 지금 선택된 항목인가 — 선택하면 그 자리에서 수정·삭제가 열린다 */
  selected: boolean;
  onSelect: (edge: PreferenceEdge | null) => void;
  onEdit: (edge: PreferenceEdge) => void;
  onDelete: (edge: PreferenceEdge) => void;
}

/**
 * 취향 하나 — **칩(토큰)**.
 *
 * ## 왜 행이 아니라 칩인가
 * 데이터가 "무선"·"소니" 같은 **짧은 단어 하나**뿐이다. 가로로 긴 행에 그걸
 * 하나씩 놓으면 오른쪽이 통째로 비고, 구분선이 수십 줄 반복되면서 화면이
 * 데이터 테이블처럼 읽힌다 — 개인의 취향을 둘러보는 곳이 아니라 관리자
 * 설정 화면이 된다.
 *
 * 칩은 글자 길이만큼만 차지하고 자연스럽게 wrap 되므로, 같은 면적에 훨씬
 * 많이 들어가면서 "모아 둔 컬렉션"처럼 보인다.
 *
 * ## 액션을 상시 노출하지 않는 이유
 * 칩마다 ✏️🗑 두 개가 붙으면 글자보다 아이콘이 많아져 무엇이 내용인지
 * 알 수 없다. **선택했을 때만** 그 칩 안에서 액션이 열린다.
 *
 * 선택은 hover 가 아니라 **클릭/탭**이라 터치·키보드에서 똑같이 동작한다
 * (hover 로 열면 터치 기기에서 영영 못 연다). hover 는 색이 살짝 짙어지는
 * 정도로만 쓴다 — 누를 수 있다는 신호일 뿐이다.
 */
export function PreferenceItem({
  edge,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: PreferenceItemProps) {
  const label = edge.object.label;
  const style = PREDICATE_STYLE[edge.predicate];

  return (
    <li className="min-w-0">
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-3 text-[13px]",
          "transition-[background-color,border-color,box-shadow] duration-150 ease-out-strong",
          "motion-reduce:transition-none",
          style.chipClass,
          // 선택 상태는 링으로 알린다 — 색만 바꾸면 옆 칩과 구분이 약하다
          selected && "shadow-[0_0_0_2px_var(--brand)]",
          // 액션이 열리면 오른쪽 여백을 줄여 버튼이 테두리에 닿지 않게
          selected ? "pr-1" : "pr-3",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(selected ? null : edge)}
          aria-pressed={selected}
          aria-label={
            selected ? `${label} 선택 해제` : `${label} 선택 — 고치거나 지울 수 있어요`
          }
          className={cn(
            "min-w-0 truncate text-left",
            "focus-visible:outline-none focus-visible:underline",
          )}
        >
          {label}
        </button>

        {edge.editable ? null : (
          // 구매 파생 — 수정만 막힌다. 자물쇠가 그 이유를 형태로 알린다
          <Lock
            className="size-3 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}

        {edge.challenged ? (
          // "최근 취향이 바뀐 것 같아요" — 오류가 아니라 확인 요청이라
          // 경고색을 쓰지 않는다. 형태(테두리 배지)로만 알린다.
          <span
            className="shrink-0 rounded-full border border-border/70 px-1 text-[10px] font-medium leading-4 text-muted-foreground"
            title="최근 취향이 바뀐 것 같아요. 고쳐볼까요?"
          >
            !
          </span>
        ) : null}

        {/* 선택했을 때만 열리는 액션. DOM 에서 아예 빼서 탭 순서도 함께 정리된다 */}
        {selected ? (
          <span className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => onEdit(edge)}
              disabled={!edge.editable}
              aria-label={`${label} 수정`}
              title={
                edge.editable
                  ? "수정"
                  : "구매 기록에서 만들어진 항목은 수정할 수 없어요."
              }
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-muted-foreground",
                "transition-colors duration-150 ease-out-strong",
                "hover:[@media(hover:hover)]:bg-background hover:[@media(hover:hover)]:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45",
                "disabled:pointer-events-none disabled:opacity-30",
              )}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(edge)}
              aria-label={`${label} 삭제`}
              title="삭제"
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-muted-foreground",
                "transition-colors duration-150 ease-out-strong",
                "hover:[@media(hover:hover)]:bg-destructive/10 hover:[@media(hover:hover)]:text-destructive",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40",
              )}
            >
              <Trash2 className="size-3.5" />
            </button>
          </span>
        ) : null}
      </span>
    </li>
  );
}
