"use client";

import type { PreferenceEdge, PreferenceGroupData } from "../types";

/**
 * 스크린리더 전용 취향 목록.
 *
 * ⚠️ **방사형 그래프 뷰에서 이게 없으면 화면이 통째로 비어 보인다.**
 *
 * SVG는 스크린리더에 읽히지 않아 그래프에 `aria-hidden`을 걸고, 대신 이 목록이
 * 유일한 접근 경로가 된다. 시각 그래프와 **같은 데이터를 같은 순서로** 담는다.
 *
 * 목록 뷰(PreferenceTree)에서는 **쓰지 않는다** — 그쪽은 ul·li·button으로
 * 그 자체가 읽히므로, 같이 켜면 스크린리더 사용자가 같은 목록을 두 번 듣는다.
 * 중복은 "없는 것"만큼이나 나쁘다.
 *
 * 표시 상한을 적용하지 않는 이유: 상한은 라벨이 겹치는 시각적 문제를 푸는
 * 장치다. 스크린리더에는 그 문제가 없고, 잘라내면 오히려 정보가 사라진다.
 */
export function ScreenReaderList({ groups }: { groups: PreferenceGroupData[] }) {
  return (
    <div className="sr-only">
      <h3>취향 목록</h3>
      {groups.map((group) => (
        <section key={group.predicate}>
          <h4>
            {group.label} {group.edges.length}개
          </h4>
          {group.edges.length === 0 ? (
            <p>아직 없어요</p>
          ) : (
            <ul>
              {group.edges.map((edge) => (
                <li key={edge.edgeId}>{describeEdge(edge)}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/** 항목 하나를 한 문장으로 */
function describeEdge(edge: PreferenceEdge): string {
  const parts = [edge.object.label];

  if (edge.challenged) parts.push("최근 취향이 바뀐 것 같아요");
  if (!edge.editable) parts.push("구매 기록이라 수정할 수 없어요");

  return parts.join(", ");
}
