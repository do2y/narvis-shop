"use client";

import { useMemo } from "react";
import {
  groupEdgesByPredicate,
  type PreferenceEdge,
  type PreferencePredicate,
  type ProfileGraph,
} from "../types";
import { PreferenceGroup, useSelectedEdge } from "./PreferenceGroup";

interface PreferenceTreeProps {
  graph: ProfileGraph;
  /**
   * 그래프에서 관계 노드를 고르면 그 그룹만 선명해진다 — 관계도와 목록의
   * 선택 상태를 잇는 값이다. null 이면 전부 같은 농도.
   */
  highlighted?: PreferencePredicate | null;
  onEdit: (edge: PreferenceEdge) => void;
  onDelete: (edge: PreferenceEdge) => void;
}

/**
 * 전체 취향 목록 — 관계 5종을 색으로 구분한 칩 묶음.
 *
 * 그래프가 "대표 취향으로 구조 훑기"라면 여기는 **전부 확인하고 고치기**다.
 * 둘은 같은 화면에 세로로 함께 있고 역할만 나뉜다.
 *
 * ul·li·button 으로 그 자체가 읽히므로 sr-only 목록을 따로 두지 않는다
 * (그건 SVG 그래프 전용이다 — ScreenReaderList).
 */
export function PreferenceTree({
  graph,
  highlighted = null,
  onEdit,
  onDelete,
}: PreferenceTreeProps) {
  // edges가 전량 오므로(서버 상한 폐지) 렌더마다 다시 묶지 않는다.
  // groupEdgesByPredicate는 서버 정렬을 보존하고 빈 그룹도 5개를 채워 반환한다.
  const groups = useMemo(() => groupEdgesByPredicate(graph.edges), [graph.edges]);

  const { selected, setSelected } = useSelectedEdge();

  // 데이터가 있는 그룹을 위, 빈 그룹(회피·구매)을 아래로.
  // 그룹 **안**의 항목 순서는 서버 것을 그대로 두고, 그룹의 화면 배치만
  // FE가 정한다(노션 10.2).
  const filled = groups.filter((g) => g.edges.length > 0);
  const empty = groups.filter((g) => g.edges.length === 0);

  return (
    // 바깥 클릭으로 선택 해제 — 칩 안에서 누른 것은 아래에서 전파를 막는다
    <div
      onClick={() => selected && setSelected(null)}
      // 카테고리 사이 여백(gap-7)이 그룹 안 칩 간격(gap-1.5)보다 훨씬 크다 —
      // 그 차이가 곧 정보 계층이다
      className="flex flex-col gap-7"
    >
      {filled.map((group) => (
        <div key={group.predicate} onClick={(e) => e.stopPropagation()}>
          <PreferenceGroup
            group={group}
            dimmed={highlighted !== null && highlighted !== group.predicate}
            selectedEdgeId={selected?.edgeId ?? null}
            onSelect={setSelected}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      ))}

      {/* 빈 관계 — 아래에 모아 한 줄씩. 지우지도 강조하지도 않는다 */}
      {empty.length > 0 ? (
        <div className="flex flex-col gap-4 border-t border-border/70 pt-6">
          {empty.map((group) => (
            <div key={group.predicate} onClick={(e) => e.stopPropagation()}>
              <PreferenceGroup
                group={group}
                dimmed={highlighted !== null}
                selectedEdgeId={selected?.edgeId ?? null}
                onSelect={setSelected}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
