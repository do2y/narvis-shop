"use client";

import { useMemo } from "react";
import {
  groupEdgesByPredicate,
  indexNodes,
  type PreferenceEdge,
  type ProfileGraph,
} from "../types";
import { PreferenceGroup, useGroupFocus } from "./PreferenceGroup";

interface PreferenceTreeProps {
  graph: ProfileGraph;
  onEdit: (edge: PreferenceEdge) => void;
  onDelete: (edge: PreferenceEdge) => void;
}

/**
 * 관계 5종으로 묶인 세로형 트리.
 *
 * 노션 10장의 방사형은 2단계로 미뤘다 — 데이터 계약이 아직 초안이라
 * 시각화부터 만들면 헛일 위험이 크다. 정보 구조는 동일하다(관계가 가지,
 * 항목이 그 끝). 방사형으로 바꿀 때 이 컴포넌트만 갈아끼우면 된다.
 *
 * 관계별 색을 쓰지 않는 이유: 노션이 5색을 요구한 것은 **방사형에서 각도만으로
 * 가지가 구분되지 않기 때문**이다. 세로형은 그룹 헤더가 글자로 있어 그 문제가
 * 없고, 색을 쓰면 CLAUDE.md의 토큰 규칙(정의된 색 외 금지)을 어기게 된다.
 * 2단계에서 방사형을 만들 때 토큰 추가를 제안한다.
 */
export function PreferenceTree({ graph, onEdit, onDelete }: PreferenceTreeProps) {
  // 200개까지 올 수 있어 렌더마다 다시 묶지 않는다.
  // groupEdgesByPredicate는 서버 정렬을 보존하고 빈 그룹도 5개를 채워 반환한다.
  const groups = useMemo(() => groupEdgesByPredicate(graph.edges), [graph.edges]);
  const nodes = useMemo(() => indexNodes(graph.nodes), [graph.nodes]);

  const { focused, setFocused } = useGroupFocus();

  // 데이터가 있는 그룹을 위, 빈 그룹(회피·구매)을 아래로.
  // 그룹 **안**의 항목 순서는 서버 것을 그대로 두고, 그룹의 화면 배치만
  // FE가 정한다(노션 10.2). 5개가 균등하게 늘어서면 두 자리가 텅 빈 채 남아
  // 화면이 어색해지는데, 비대칭을 아래로 몰면 "내 취향이 이쪽에 몰려 있다"는
  // 정보로 읽힌다.
  const filled = groups.filter((g) => g.edges.length > 0);
  const empty = groups.filter((g) => g.edges.length === 0);

  return (
    <div>
      {/*
        sr-only 목록은 **2단계(방사형 SVG)에서 켠다.**

        그때는 그래프가 aria-hidden 이 되어 이 목록이 유일한 접근 경로다.
        하지만 지금 세로형 트리는 그 자체가 ul·li·button 으로 읽히므로, 지금
        켜면 스크린리더 사용자가 **같은 목록을 두 번** 듣게 된다. 중복은
        "없는 것"만큼이나 나쁘다.

        컴포넌트를 미리 만들어 둔 것은 2단계에서 트리만 갈아끼우면 되게
        하려는 것이다 — 그때 아래 한 줄의 주석을 풀면 된다.
        <ScreenReaderList groups={groups} nodes={nodes} />
      */}

      {/*
        포커스 모드 바깥 클릭으로 복귀. 키보드 사용자는 ESC로 빠져나간다
        (useGroupFocus가 처리) — 그래서 이 div는 클릭만 받는다.

        aria-hidden 을 걸지 않는다: 포커스 모드는 시각적 강조일 뿐 다른 그룹을
        비활성화하는 게 아니고, 안에 포커스 가능한 버튼이 있어 숨기면
        "읽히지 않는데 탭으로는 닿는" 상태가 된다.
      */}
      <div
        onClick={() => focused && setFocused(null)}
        className="flex flex-col gap-6"
      >
        {filled.map((group) => (
          <div
            key={group.predicate}
            // 그룹 내부 클릭이 바깥 클릭으로 새어 나가 포커스가 풀리지 않게 막는다
            onClick={(e) => e.stopPropagation()}
          >
            <PreferenceGroup
              group={group}
              nodes={nodes}
              dimmed={focused !== null && focused !== group.predicate}
              focused={focused === group.predicate}
              onFocus={() => setFocused(group.predicate)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        ))}

        {empty.length > 0 ? (
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-5">
            {empty.map((group) => (
              <PreferenceGroup
                key={group.predicate}
                group={group}
                nodes={nodes}
                dimmed={focused !== null}
                focused={false}
                onFocus={() => {}}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : null}
      </div>

      {graph.truncated ? (
        // 200개 상한에서 잘렸다. 페이지네이션이 계약에 없어 더 볼 방법이 없으므로
        // "왜 일부만 보이는지"만 정직하게 알린다.
        <p className="mt-6 text-xs text-muted-foreground">
          취향이 많아 일부만 표시했어요.
        </p>
      ) : null}
    </div>
  );
}
