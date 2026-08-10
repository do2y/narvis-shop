"use client";

import { Lock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreferenceEdge } from "../types";

interface PreferenceItemProps {
  edge: PreferenceEdge;
  onEdit: (edge: PreferenceEdge) => void;
  onDelete: (edge: PreferenceEdge) => void;
}

/**
 * 취향 항목 한 줄 — 라벨 + 상태 표시 + 삭제.
 *
 * ## 왜 카드가 아니라 행인가
 * 이전에는 항목마다 `rounded-full` 캡슐 테두리에 44px 아이콘 버튼 두 개를 상시
 * 노출했다. 실제 데이터는 "무선"·"소니" 같은 **짧은 단어 하나**인데 한 줄이
 * 56px를 먹어, 82개짜리 그룹을 훑으려면 화면을 몇 번씩 넘겨야 했다. 캡슐이
 * 세로로 반복되면 테두리 자체가 소음이 되어 정작 읽어야 할 글자가 묻힌다.
 *
 * 그래서 **높이 44px 행 + 얇은 구분선**으로 바꿨다. 테두리는 그룹 컨테이너가
 * 한 번만 두르고, 항목끼리는 선으로만 나눈다.
 *
 * ## 연필 아이콘을 없앤 이유
 * 행 전체가 수정 버튼이다. 라벨을 누르면 수정 창이 열리므로 연필은 같은 일을
 * 하는 두 번째 표적일 뿐이고, 매 행에 아이콘 두 개가 붙으면 그만큼 폭과
 * 시선을 먹는다. 삭제만 파괴적이라 별도 버튼으로 남긴다.
 *
 * ## 삭제 버튼 노출 규칙
 * 데스크탑에서는 hover·focus에서만 드러낸다 — 모든 행에 휴지통이 켜져 있으면
 * 목록이 "지우는 화면"으로 읽힌다. 다만 **터치에서는 hover가 없으므로 항상
 * 보인다**(`@media(hover:hover)` 게이팅). 포커스에서도 드러나므로 키보드로도
 * 닿는다.
 */
export function PreferenceItem({ edge, onEdit, onDelete }: PreferenceItemProps) {
  const label = edge.object.label;

  return (
    <li className="group/row relative">
      {/*
        행 전체가 수정 트리거. button 안에 button을 넣을 수 없어(HTML 위반)
        삭제 버튼은 형제로 두고 absolute 로 겹친다 — 그래서 이 버튼의
        오른쪽 여백(pr-12)이 삭제 버튼 자리를 비워 둔다.
      */}
      <button
        type="button"
        onClick={() => edge.editable && onEdit(edge)}
        disabled={!edge.editable}
        aria-label={
          edge.editable
            ? `${label} 수정`
            : `${label} — 구매 기록에서 만들어져 수정할 수 없어요`
        }
        title={
          edge.editable
            ? "눌러서 수정"
            : "구매 기록에서 만들어진 항목은 수정할 수 없어요."
        }
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-sm pl-2.5 pr-12 text-left",
          "transition-colors duration-150 ease-out-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45",
          edge.editable
            ? "hover:[@media(hover:hover)]:bg-muted/70"
            : "cursor-default",
        )}
      >
        {/* 관계 구분점 — 그래프의 항목 노드와 같은 표현(형태로 종류를 알린다) */}
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            edge.editable ? "bg-brand/45" : "bg-muted-foreground/35",
          )}
        />

        {/* 라벨은 줄이지 않고 말줄임한다 — 긴 이름이 줄바꿈되면 행 높이가
            제각각이 되어 훑어보는 리듬이 깨진다. 전체 이름은 title 로 남는다 */}
        <span className="truncate text-sm tracking-tight">{label}</span>

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
            className="shrink-0 rounded-full border border-border px-1.5 text-[10px] font-medium leading-4 text-muted-foreground"
            title="최근 취향이 바뀐 것 같아요. 고쳐볼까요?"
          >
            !
          </span>
        ) : null}
      </button>

      {/*
        삭제 — 위험한 동작이라 라벨(수정)과 분리해 오른쪽 끝에 둔다.
        확인 창은 그대로 거친다(onDelete → DeleteEdgeDialog).

        size-9 는 44px 규칙보다 작지만, 부모 행이 44px 이고 세로로 꽉 차는
        위치라 실제 터치 타겟 높이는 44px 이다(가로만 36px).
      */}
      <button
        type="button"
        onClick={() => onDelete(edge)}
        aria-label={`${label} 삭제`}
        title="삭제"
        className={cn(
          "absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full",
          "text-muted-foreground transition-[color,background-color,opacity] duration-150 ease-out-strong",
          "hover:[@media(hover:hover)]:bg-destructive/10 hover:[@media(hover:hover)]:text-destructive",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40",
          // 마우스 환경에서만 숨긴다 — 터치에는 hover 가 없어 영영 못 찾는다.
          // 포커스로도 드러나므로 키보드 경로가 끊기지 않는다.
          "[@media(hover:hover)]:opacity-0",
          "group-hover/row:[@media(hover:hover)]:opacity-100",
          "focus-visible:opacity-100",
        )}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
