"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PREDICATE_STYLE } from "../predicateStyle";
import type { PreferenceEdge, PreferenceGroupData } from "../types";
import { PreferenceItem } from "./PreferenceItem";

interface PreferenceGroupProps {
  group: PreferenceGroupData;
  /** 다른 그룹이 선택돼 이 그룹은 물러나 있는가 */
  dimmed: boolean;
  /** 지금 선택된 취향 — 그 칩만 액션이 열린다 */
  selectedEdgeId: string | null;
  onSelect: (edge: PreferenceEdge | null) => void;
  onEdit: (edge: PreferenceEdge) => void;
  onDelete: (edge: PreferenceEdge) => void;
}

/**
 * 관계 그룹 하나 — 색 라벨 + 칩 묶음.
 *
 * ## 전부 펼친다
 * `24개 더 보기` 같은 단계적 펼침을 없앴다. 칩은 한 줄에 6~10개가 들어가
 * 82개도 8~10줄이면 끝난다 — 행으로 쌓을 때(82줄)와 스크롤 부담이 다르다.
 * 감추는 대신 밀도로 푸는 쪽이 "내 취향 전체를 훑는다"는 목적에 맞는다.
 *
 * ## 카테고리마다 카드를 두르지 않는다
 * 흰 카드 5개가 반복되면 그게 곧 시각적 소음이다. 대신 **왼쪽 색 라인 +
 * 색 배지**로 구분하고 배경은 페이지와 같게 둔다. 구분은 색·이름·여백이
 * 하고, 테두리는 바깥 섹션이 한 번만 두른다.
 */
export function PreferenceGroup({
  group,
  dimmed,
  selectedEdgeId,
  onSelect,
  onEdit,
  onDelete,
}: PreferenceGroupProps) {
  const total = group.edges.length;
  const isEmpty = total === 0;
  const style = PREDICATE_STYLE[group.predicate];

  return (
    <section
      aria-labelledby={`group-${group.predicate}`}
      className={cn(
        "flex flex-col gap-2.5 transition-opacity duration-200",
        "motion-reduce:transition-none",
        dimmed && "opacity-45",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {/* 색 라인 + 이름 + 개수 — 색만으로 구분하지 않도록 셋이 함께 간다 */}
        <h3
          id={`group-${group.predicate}`}
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className={cn("h-3.5 w-[3px] rounded-full", style.barClass)}
          />
          {group.label}
        </h3>

        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
            isEmpty ? "bg-muted text-muted-foreground" : style.countClass,
          )}
        >
          {total}
        </span>

        {/* 이 관계가 무엇인지 한 줄 — 계약의 정의를 사용자 말로 옮긴 것이고
            새 뜻을 만들지 않는다(predicateStyle.ts) */}
        <span className="text-xs text-muted-foreground">{style.hint}</span>
      </div>

      {isEmpty ? (
        /*
          avoids·purchased 는 만드는 경로가 아직 없어 늘 비어 있다(계약).
          "죽은 가지"가 아니라 "아직 안 자란 것"으로 읽혀야 사실과 맞는다.
          회색 한 줄 대신 담담한 문장을 쓰되, 사용자를 평가하지 않는다.
        */
        <p className="rounded-sm bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          {style.emptyHint}
        </p>
      ) : (
        /*
          칩을 흘려 배치한다(wrap). 열 수를 고정하지 않는 이유는 라벨 길이가
          제각각이라("무선" 2자 ↔ "탈착식 케이블 미니" 10자) 고정 열에서는
          짧은 칸이 텅 비기 때문이다. wrap 이면 폭에 맞춰 알아서 채운다.

          그룹 안 항목 순서는 서버 순서 그대로 — 클라이언트 재정렬 금지.
        */
        <ul className="flex flex-wrap gap-1.5">
          {group.edges.map((edge) => (
            <PreferenceItem
              key={edge.edgeId}
              edge={edge}
              selected={edge.edgeId === selectedEdgeId}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 선택된 취향 하나 — 그 칩에서만 수정·삭제가 열린다.
 *
 * ESC 로 해제한다. 훅으로 분리한 이유는 키 핸들러 등록이 트리 쪽 관심사가
 * 아니어서다.
 */
export function useSelectedEdge() {
  const [selected, setSelected] = useState<PreferenceEdge | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  return { selected, setSelected };
}
