"use client";

import {
  CONFIDENCE_LABEL,
  SOURCE_LABEL,
  type PreferenceEdge,
  type PreferenceGroupData,
  type PreferenceNode,
} from "../types";

/**
 * 스크린리더 전용 취향 목록.
 *
 * ⚠️ **없으면 이 화면이 스크린리더에 통째로 비어 보인다.**
 *
 * 보이는 목록 뷰를 두지 않기로 했고(노션 3.2 — 화면은 트리 하나), 2단계에서
 * 트리를 SVG 방사형으로 바꾸면 그래프는 `aria-hidden`이 된다. 그때 이 목록이
 * 유일한 접근 경로가 되므로, 시각 트리와 **같은 데이터를 같은 순서로** 담는다.
 *
 * 지금(1단계)은 세로형 트리가 그 자체로 읽히지만, 항목마다 상태 배지가
 * 아이콘·크기로만 표현돼 있어 여기서 문장으로 다시 전한다.
 *
 * 12개 상한을 적용하지 않는 이유: 상한은 라벨이 겹치는 시각적 문제를 푸는
 * 장치다. 스크린리더에는 그 문제가 없고, 잘라내면 오히려 정보가 사라진다.
 */
export function ScreenReaderList({
  groups,
  nodes,
}: {
  groups: PreferenceGroupData[];
  nodes: Map<string, PreferenceNode>;
}) {
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
                <li key={edge.edgeId}>
                  {describeEdge(edge, nodes.get(edge.to))}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * 항목 하나를 한 문장으로.
 *
 * `derivedFromSensitive`는 여기서도 언급하지 않는다 — 시각적 차이를 두지 않는
 * 것과 같은 이유다. 스크린리더에만 알리면 그 사용자에게만 민감 정보가
 * 공개되는 셈이라 오히려 나쁘다.
 */
function describeEdge(
  edge: PreferenceEdge,
  node: PreferenceNode | undefined,
): string {
  const parts = [node?.label ?? "알 수 없는 항목", CONFIDENCE_LABEL[edge.confidence]];

  if (edge.origin === "user") parts.push("내가 수정함");
  if (edge.challenged) parts.push("최근 취향이 바뀐 것 같아요");
  if (!edge.editable) parts.push("구매 기록이라 수정할 수 없어요");
  if (node && !node.verified) parts.push("추천에서 빠질 수 있어요");
  parts.push(SOURCE_LABEL[edge.source]);

  return parts.join(", ");
}
