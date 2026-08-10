"use client";

import { useMemo } from "react";
import {
  groupEdgesByPredicate,
  type PreferenceEdge,
  type ProfileGraph,
} from "../types";
import { PreferenceGroup, useGroupFocus } from "./PreferenceGroup";

interface PreferenceTreeProps {
  graph: ProfileGraph;
  /**
   * 펼쳐 둘 관계 — 그래프의 "전체 보기"가 지정한다.
   *
   * 초기값이 아니라 **매번 따라가는 값**이다. 목록은 그래프와 같은 화면에 늘
   * 떠 있어 언마운트되지 않으므로, 초기값으로만 받으면 두 번째 요청부터
   * 무시된다(useGroupFocus 주석 참조).
   */
  requestedFocus?: string | null;
  onEdit: (edge: PreferenceEdge) => void;
  onDelete: (edge: PreferenceEdge) => void;
}

/**
 * 목록 뷰 — 관계 5종으로 묶은 카드 목록.
 *
 * 기본 화면은 방사형 그래프(PreferenceGraph)이고 이 컴포넌트는 **3역을 겸한다**:
 * ① [전체 보기] — 그래프는 항목이 많아지면 라벨이 겹쳐 못 쓴다
 * ② 모바일(768px 미만) — 좁은 화면에서 방사형은 성립하지 않는다
 * ③ 접근성 — ul·li·button으로 그 자체가 읽혀 sr-only 목록이 따로 필요 없다
 *
 * 관계별 색을 쓰지 않는다. 5색이 필요한 것은 **방사형에서 각도만으로 가지가
 * 구분되지 않기 때문**인데, 목록은 그룹 헤더가 글자로 있어 그 문제가 없다.
 * 색을 쓰면 CLAUDE.md의 토큰 규칙(정의된 색 외 금지)도 어기게 된다.
 */
export function PreferenceTree({
  graph,
  requestedFocus = null,
  onEdit,
  onDelete,
}: PreferenceTreeProps) {
  // edges가 전량 오므로(서버 상한 폐지) 렌더마다 다시 묶지 않는다.
  // groupEdgesByPredicate는 서버 정렬을 보존하고 빈 그룹도 5개를 채워 반환한다.
  const groups = useMemo(() => groupEdgesByPredicate(graph.edges), [graph.edges]);

  const { focused, setFocused } = useGroupFocus(requestedFocus);

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
        여기서는 ScreenReaderList를 쓰지 않는다 — 아래 목록이 ul·li·button으로
        그 자체가 읽히므로, 같이 켜면 같은 목록을 두 번 듣게 된다.
        그 컴포넌트는 방사형 그래프 뷰(PreferenceGraph) 전용이다.
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
              dimmed={focused !== null && focused !== group.predicate}
              focused={focused === group.predicate}
              onClearFocus={() => setFocused(null)}
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
                dimmed={focused !== null}
                focused={false}
                onClearFocus={() => {}}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
