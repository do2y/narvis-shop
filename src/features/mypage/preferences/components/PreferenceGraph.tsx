"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  groupEdgesByPredicate,
  type PreferenceEdge,
  type PreferencePredicate,
} from "../types";
import {
  buildGraphLayout,
  truncateLabel,
  VIEWBOX_H,
  VIEWBOX_W,
  type BranchNode,
} from "./graphLayout";
import { ScreenReaderList } from "./ScreenReaderList";

interface PreferenceGraphProps {
  edges: PreferenceEdge[];
  /** 포커스 모드로 확대 중인 관계 */
  focused: PreferencePredicate | null;
  onFocus: (predicate: PreferencePredicate | null) => void;
  onSelect: (edge: PreferenceEdge) => void;
}

/**
 * 관계 노드 반지름 — 항목 수에 비례.
 *
 * 제곱근으로 눌러 24 대 2에서도 작은 쪽이 사라지지 않게 한다. 편차는 보이되
 * 과하지 않아야 "크기가 곧 정보"로 읽힌다.
 */
function branchRadius(total: number): number {
  if (total === 0) return 9;
  return Math.min(30, 15 + Math.sqrt(total) * 2.1);
}

/** 가지 굵기도 같은 원리 — 굵기 자체가 그룹 크기를 말한다 */
function branchWidth(total: number): number {
  if (total === 0) return 1;
  return Math.min(5, 1.75 + Math.sqrt(total) * 0.42);
}

/**
 * 방사형 2단 그래프 — `나 → 관계 5종 → 취향`.
 *
 * **옵시디언식 다단계 그래프는 이 데이터로 만들 수 없다.** 모든 관계가
 * `나 → 대상` 한 방향·한 단계라 대상끼리 이어진 링크가 없고, force-directed를
 * 돌리면 중심 하나에 점이 매달린 그림만 나온다(무리도 경로도 안 생긴다).
 * 데이터에 실제로 있는 유일한 중간 단계가 **관계 5종**이라 그것을 가지로 쓴다.
 *
 * 좌표는 graphLayout.ts가 순수 함수로 계산한다 — 여기서는 그리기만 한다.
 *
 * ♿ **SVG는 스크린리더에 읽히지 않는다.** 그래서 그래프에 aria-hidden을 걸고
 * ScreenReaderList를 병행한다. 이게 없으면 이 화면이 통째로 비어 보인다.
 * 키보드 사용자도 이 SVG를 탭으로 훑지 않는다 — 목록 뷰가 그 경로다.
 */
export function PreferenceGraph({
  edges,
  focused,
  onFocus,
  onSelect,
}: PreferenceGraphProps) {
  const layout = useMemo(
    () => buildGraphLayout(edges, focused),
    [edges, focused],
  );
  const groups = useMemo(() => groupEdgesByPredicate(edges), [edges]);

  return (
    <div className="relative">
      <ScreenReaderList groups={groups} />

      {/*
        뷰박스 비율(3:2)이 높이를 정한다. 패널 폭을 꽉 채우되 세로가 과하게
        길어지지 않게 상한만 둔다 — 상한이 없으면 넓은 모니터에서 그래프가
        화면을 통째로 삼키고, 낮으면 이 화면의 핵심 콘텐츠가 작아 보인다.
      */}
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        className="h-auto max-h-[68vh] w-full select-none"
        aria-hidden="true"
        // 포커스 모드에서 빈 곳을 누르면 전체 보기로 복귀
        onClick={() => focused && onFocus(null)}
      >
        {/* ── 가지: 나 → 관계 ── */}
        {layout.branches.map((branch) => (
          <line
            key={`edge-${branch.predicate}`}
            x1={layout.center.x}
            y1={layout.center.y}
            x2={branch.x}
            y2={branch.y}
            strokeWidth={branchWidth(branch.total)}
            strokeLinecap="round"
            className={cn(
              "transition-opacity duration-200",
              // 빈 가지는 점선 — 색이 아니라 형태로 구분한다
              branch.isEmpty ? "stroke-border" : "stroke-foreground/25",
              dimClass(branch, focused),
            )}
            strokeDasharray={branch.isEmpty ? "4 5" : undefined}
          />
        ))}

        {/* ── 잔가지: 관계 → 항목 ── */}
        {layout.branches.flatMap((branch) =>
          branch.leaves.map((leaf) => (
            <line
              key={`twig-${leaf.edge.edgeId}`}
              x1={branch.x}
              y1={branch.y}
              x2={leaf.x}
              y2={leaf.y}
              strokeWidth={1.25}
              className={cn(
                "stroke-foreground/15 transition-opacity duration-200",
                dimClass(branch, focused),
              )}
            />
          )),
        )}

        {/* ── 중심: 나 ── */}
        <circle
          cx={layout.center.x}
          cy={layout.center.y}
          r={38}
          className="fill-primary"
        />
        <text
          x={layout.center.x}
          y={layout.center.y}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-primary-foreground text-[22px] font-semibold"
          style={{ letterSpacing: "-0.01em" }}
        >
          나
        </text>

        {/* ── 관계 노드 ── */}
        {layout.branches.map((branch) => {
          const r = branchRadius(branch.total);
          return (
            <g
              key={`branch-${branch.predicate}`}
              className={cn(
                "transition-opacity duration-200",
                dimClass(branch, focused),
              )}
            >
              <circle
                cx={branch.x}
                cy={branch.y}
                r={r}
                className={cn(
                  branch.isEmpty
                    ? "fill-background stroke-border"
                    : "fill-background stroke-foreground/35",
                )}
                strokeWidth={branch.isEmpty ? 1.25 : 2}
                strokeDasharray={branch.isEmpty ? "4 4" : undefined}
              />
              {/* 개수를 노드 안에 넣어 "크기 = 개수"를 숫자로 확인시킨다 */}
              {branch.isEmpty ? null : (
                <text
                  x={branch.x}
                  y={branch.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground text-[17px] font-semibold tabular-nums"
                >
                  {branch.total}
                </text>
              )}

              {/* 관계명은 노드 바깥 — 노드 안에 다 넣으면 원이 커져야 한다 */}
              <text
                x={branch.x}
                y={branch.y + r + 21}
                textAnchor="middle"
                className={cn(
                  "text-[19px] font-semibold",
                  branch.isEmpty ? "fill-muted-foreground" : "fill-foreground",
                )}
                style={{ letterSpacing: "-0.01em" }}
              >
                {branch.label}
              </text>

              {branch.isEmpty ? (
                // 오류가 아니라 "아직"임을 말한다 — 생산 경로가 없어서 비는 것이지
                // 사용자가 등록을 안 해서가 아니다
                <text
                  x={branch.x}
                  y={branch.y + r + 41}
                  textAnchor="middle"
                  className="fill-muted-foreground/80 text-[15px]"
                >
                  아직 없어요
                </text>
              ) : null}
            </g>
          );
        })}

        {/* ── 항목 노드 ── */}
        {layout.branches.flatMap((branch) =>
          branch.leaves.map((leaf) => {
            const label = truncateLabel(leaf.edge.object.label);
            const gap = leaf.anchor === "start" ? 15 : -15;
            const locked = !leaf.edge.editable;
            return (
              <g
                key={`leaf-${leaf.edge.edgeId}`}
                className={cn(
                  "group/leaf cursor-pointer transition-opacity duration-200",
                  dimClass(branch, focused),
                )}
                onClick={(e) => {
                  // 바깥 클릭(포커스 해제)으로 새어 나가지 않게 막는다
                  e.stopPropagation();
                  onSelect(leaf.edge);
                }}
              >
                {/* 투명한 히트 영역 — 점만으로는 터치 타겟이 44px에 못 미친다 */}
                <circle
                  cx={leaf.x}
                  cy={leaf.y}
                  r={22}
                  className="fill-transparent"
                />
                {/* 호버 시 커지는 링 — r을 애니메이션하는 대신 별도 원의
                    투명도를 바꾼다(r은 transform이 아니라 GPU를 못 탄다) */}
                <circle
                  cx={leaf.x}
                  cy={leaf.y}
                  r={13}
                  className="fill-foreground/10 opacity-0 transition-opacity duration-150 group-hover/leaf:opacity-100"
                />
                <circle
                  cx={leaf.x}
                  cy={leaf.y}
                  r={6}
                  className={cn(
                    "transition-colors duration-150",
                    locked
                      ? "fill-background stroke-muted-foreground stroke-2"
                      : "fill-foreground/70 group-hover/leaf:fill-foreground",
                  )}
                />
                <text
                  x={leaf.x + gap}
                  y={leaf.y}
                  textAnchor={leaf.anchor}
                  dominantBaseline="central"
                  className={cn(
                    "text-[17px] transition-colors duration-150",
                    "fill-foreground/85 group-hover/leaf:fill-foreground",
                  )}
                >
                  {label}
                  {/* 구매 파생은 수정만 막힌다 — 자물쇠로 이유를 형태로 알린다 */}
                  {locked ? (
                    <tspan className="fill-muted-foreground text-[14px]">
                      {" "}
                      🔒
                    </tspan>
                  ) : null}
                  {/* "최근 취향이 바뀐 것 같아요" — 색은 바꾸지 않는다 */}
                  {leaf.edge.challenged ? (
                    <tspan className="fill-muted-foreground font-semibold">
                      {" "}
                      !
                    </tspan>
                  ) : null}
                </text>
              </g>
            );
          }),
        )}

        {/* ── +N: 그 관계만 확대. 버튼처럼 보이게 알약 배경을 깐다 ── */}
        {layout.branches
          .filter((b) => b.overflow > 0)
          .map((branch) => {
            const r = branchRadius(branch.total);
            const y = branch.y - r - 20;
            const w = 88;
            return (
              <g
                key={`more-${branch.predicate}`}
                className="group/more cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocus(branch.predicate);
                }}
              >
                <rect
                  x={branch.x - w / 2}
                  y={y - 15}
                  width={w}
                  height={30}
                  rx={15}
                  className="fill-background stroke-border transition-colors duration-150 group-hover/more:fill-muted group-hover/more:stroke-foreground/40"
                  strokeWidth={1.25}
                />
                <text
                  x={branch.x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground/80 text-[15px] font-medium transition-colors duration-150 group-hover/more:fill-foreground"
                >
                  +{branch.overflow}개 더
                </text>
              </g>
            );
          })}
      </svg>
    </div>
  );
}

/**
 * 포커스 모드에서 다른 가지는 물러나게만 한다 — 숨기지 않는다.
 *
 * 기본 상태에서 빈 그룹을 옅게 두는 것도 여기서 함께 처리한다.
 */
function dimClass(
  branch: BranchNode,
  focused: PreferencePredicate | null,
): string | undefined {
  if (!focused) return branch.isEmpty ? "opacity-55" : undefined;
  return focused === branch.predicate ? undefined : "opacity-15";
}
