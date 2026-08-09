"use client";

import { Lock, Pencil, Trash2 } from "lucide-react";
import type { PreferenceEdge } from "../types";

interface PreferenceItemProps {
  edge: PreferenceEdge;
  onEdit: (edge: PreferenceEdge) => void;
  onDelete: (edge: PreferenceEdge) => void;
}

/**
 * 취향 항목 하나 — 라벨 + 상태 배지 + ✏️🗑.
 *
 * 표시 규칙:
 * - `nodeId`를 그대로 보여주지 않는다. 내부 식별자라 `object.label`을 쓴다
 * - `editable: false`(구매 파생)는 ✏️만 비활성, 🗑은 **살아 있다**
 *
 * 확신도·출처·"내가 수정함" 배지는 **확정 응답에 필드가 없어 그리지 않는다.**
 * 되살리려면 계약 개정(C-25)이 먼저다 — 없는 값을 추측해 표시하지 않는다.
 */
export function PreferenceItem({ edge, onEdit, onDelete }: PreferenceItemProps) {
  const label = edge.object.label;

  return (
    <li className="group flex items-center gap-2 rounded-full border border-border bg-background py-1.5 pl-3 pr-1.5 transition-colors">
      <span
        className="size-2 shrink-0 rounded-full bg-muted-foreground/50"
        aria-hidden="true"
      />

      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm tracking-tight">{label}</span>

        {edge.editable ? null : (
          // 구매 파생 — 수정만 막힌다. 자물쇠는 그 이유를 형태로 알린다
          <Lock
            className="size-3 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}

        {edge.challenged ? (
          // "최근 취향이 바뀐 것 같아요" — 색은 바꾸지 않는다.
          // 오류가 아니라 확인 요청이므로 경고색을 쓰면 과하다.
          <span
            className="shrink-0 rounded-full border border-border px-1.5 text-[10px] font-medium text-muted-foreground"
            title="최근 취향이 바뀐 것 같아요. 고쳐볼까요?"
          >
            !
          </span>
        ) : null}
      </span>

      {/*
        ✏️ 왼쪽 / 🗑 오른쪽 — 위험한 쪽이 바깥이다.
        터치 타겟 44×44px(size-11), 아이콘 사이 간격은 gap-1 + 각 버튼의
        내부 여백으로 16px 이상을 확보한다.
      */}
      <span className="ml-auto flex shrink-0 items-center gap-1">
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
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(edge)}
          aria-label={`${label} 삭제`}
          title="삭제"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Trash2 className="size-4" />
        </button>
      </span>
    </li>
  );
}
