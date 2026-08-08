"use client";

import { Lock, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONFIDENCE_LABEL,
  SOURCE_LABEL,
  type PreferenceEdge,
  type PreferenceNode,
} from "../types";

/**
 * 확신도 → 점 크기 3단계.
 *
 * **딱 3단계다.** "신뢰도 85%" 같은 수치형 표현을 쓰지 않는 이유는 경계값이
 * 서버 설정이라 바뀔 수 있어서다 — 수치 라벨은 경계가 움직이면 거짓이 된다.
 *
 * 색으로는 전달하지 않는다(노션 10.5). 크기 + 문구를 병행한다.
 */
const CONFIDENCE_DOT: Record<PreferenceEdge["confidence"], string> = {
  HIGH: "size-2.5",
  MEDIUM: "size-2",
  LOW: "size-1.5",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 이 취향을 왜 알고 있는지 — 답할 수 있는 재료는 source와 lastConfirmedAt
 * 둘뿐이다. 원래 발화를 되돌려 보여주는 것은 금지이고 서버가 주지도 않는다.
 */
function buildOriginHint(edge: PreferenceEdge): string {
  const source = SOURCE_LABEL[edge.source];
  const confirmed = formatDate(edge.lastConfirmedAt);
  return confirmed ? `${source} · 최근 확인 ${confirmed}` : source;
}

interface PreferenceItemProps {
  edge: PreferenceEdge;
  node: PreferenceNode | undefined;
  onEdit: (edge: PreferenceEdge) => void;
  onDelete: (edge: PreferenceEdge) => void;
}

/**
 * 취향 항목 하나 — 라벨 + 상태 배지 + ✏️🗑.
 *
 * 표시 규칙(노션 3.3):
 * - `nodeId`를 그대로 보여주지 않는다. 내부 식별자라 label을 쓴다
 * - `editable: false`(구매 기록)는 ✏️만 비활성, 🗑은 **살아 있다**
 * - `derivedFromSensitive`에는 **아무 시각적 차이도 두지 않는다** — 다르게
 *   보이는 것 자체가 "이 취향은 민감한 정보에서 나왔다"는 공개다. 그래서
 *   이 컴포넌트는 그 필드를 읽지 않는다(계약에는 남아 있다)
 */
export function PreferenceItem({
  edge,
  node,
  onEdit,
  onDelete,
}: PreferenceItemProps) {
  // 노드를 못 찾는 경우(계약상 없어야 하지만 초안 단계라 방어) nodeId를 그대로
  // 노출하면 내부 식별자가 새므로, 사람이 읽을 수 있는 자리표시자를 쓴다.
  const label = node?.label ?? "알 수 없는 항목";
  const hint = buildOriginHint(edge);
  const confidenceLabel = CONFIDENCE_LABEL[edge.confidence];

  return (
    <li
      className={cn(
        "group flex items-center gap-2 rounded-full border py-1.5 pl-3 pr-1.5 transition-colors",
        // origin: user — "내가 수정함"을 테두리로. AI가 다시 바꾸지 않는 항목이다
        edge.origin === "user"
          ? "border-foreground/30 bg-muted/40"
          : "border-border bg-background",
        // verified: false — 추천에서 빠질 수 있는 대상. 점선으로만 구분한다
        !node?.verified && "border-dashed",
      )}
    >
      {/* 확신도: 크기로 3단계. title 로 마우스에도, sr-only 로 스크린리더에도 전한다 */}
      <span
        className={cn(
          "shrink-0 rounded-full bg-muted-foreground/50",
          CONFIDENCE_DOT[edge.confidence],
        )}
        aria-hidden="true"
      />

      <span className="flex min-w-0 items-center gap-1.5" title={hint}>
        <span className="truncate text-sm tracking-tight">{label}</span>
        <span className="sr-only">
          {confidenceLabel} · {hint}
        </span>

        {edge.editable ? null : (
          // 구매 기록 — 수정만 막힌다. 자물쇠는 그 이유를 형태로 알린다
          <Lock
            className="size-3 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}

        {edge.challenged ? (
          // "최근 취향이 바뀐 것 같아요" — 색은 바꾸지 않는다(노션 10.4).
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
