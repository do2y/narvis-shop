"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  groupEdgesByPredicate,
  type PreferenceEdge,
  type PreferenceNodeType,
  type PreferencePredicate,
} from "../types";
import {
  buildGraphLayout,
  GRAPH_ITEMS_FOCUSED,
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
  /**
   * 확대해도 다 못 담는 그룹의 "모두 보기" — 목록 뷰로 전환하며 그 관계를 편다.
   *
   * 그래프 안에서 해결하지 않고 밖으로 넘기는 이유는 방사형의 물리적 한계다.
   * 라벨이 가로로 뻗어 한 가지에 GRAPH_ITEMS_FOCUSED개가 최대이므로, 82개짜리
   * 그룹은 어떻게 배치해도 그래프에 들어가지 않는다.
   */
  onShowAll: (predicate: PreferencePredicate) => void;
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
 * 라벨의 대략적인 픽셀 폭.
 *
 * SVG에는 텍스트 폭을 미리 알 방법이 없어(측정하려면 렌더 후 getBBox) 문자
 * 종류로 추정한다. 자물쇠를 라벨 끝에 붙이는 데만 쓰므로 오차가 몇 px 있어도
 * 무방하다 — 한글·전각은 폰트 크기와 거의 같고 영숫자는 그 절반쯤이다.
 */
function labelWidth(label: string): number {
  const FONT = 17;
  let w = 0;
  for (const ch of label) {
    w += /[ᄀ-ᇿ㄰-㆏가-힯一-鿿]/.test(ch)
      ? FONT
      : FONT * 0.55;
  }
  return w;
}

/**
 * 개별 대상인가(제품·브랜드), 범주인가(속성·가격대·평점대·카테고리·상황).
 *
 * "WH-1000XM5"와 "무선"은 성격이 다른데 같은 점으로 그리면 구분되지 않는다.
 * 개별 대상은 사각형으로 둬 형태만으로 읽히게 한다.
 */
function isDiscrete(type: PreferenceNodeType): boolean {
  return type === "product" || type === "brand";
}

/** 자물쇠 — lucide `Lock` 과 같은 모양을 SVG로 직접 그린다(색 통제를 위해) */
function LockGlyph() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="scale(0.46)"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </g>
  );
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
  onShowAll,
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
                {/*
                  대상 종류를 형태로 구분한다 — 같은 회색 점이면 "무선"(속성)과
                  "WH-1000XM5"(제품)가 같은 성격으로 읽힌다. 제품·브랜드는
                  개별 대상이라 사각형, 속성·가격대 등 범주는 원으로 둔다.
                  색을 쓰지 않으므로 색각 이상에서도 구분된다.
                */}
                {isDiscrete(leaf.edge.object.type) ? (
                  <rect
                    x={leaf.x - 5.5}
                    y={leaf.y - 5.5}
                    width={11}
                    height={11}
                    rx={2.5}
                    className={cn(
                      "transition-colors duration-150",
                      locked
                        ? "fill-background stroke-muted-foreground stroke-2"
                        : "fill-foreground/70 group-hover/leaf:fill-foreground",
                    )}
                  />
                ) : (
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
                )}
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
                  {/* "최근 취향이 바뀐 것 같아요" — 색은 바꾸지 않는다 */}
                  {leaf.edge.challenged ? (
                    <tspan className="fill-muted-foreground font-semibold">
                      {" "}
                      !
                    </tspan>
                  ) : null}
                </text>

                {/*
                  구매 파생은 수정만 막힌다 — 자물쇠로 이유를 형태로 알린다.

                  이모지(🔒)를 쓰지 않는 이유: 이모지는 폰트 색을 따르지 않아
                  회색조 화면에서 혼자 컬러로 튄다. 조용해야 할 부가 정보가
                  가장 강한 시각 요소가 되면 안 된다. 목록 뷰도 같은 lucide
                  아이콘을 쓰므로 두 뷰의 표현이 갈리지 않는다.
                */}
                {locked ? (
                  <g
                    transform={`translate(${
                      leaf.anchor === "start"
                        ? leaf.x + gap + labelWidth(label) + 5
                        : leaf.x + gap - labelWidth(label) - 16
                    }, ${leaf.y - 5.5})`}
                    className="text-muted-foreground"
                  >
                    <LockGlyph />
                  </g>
                ) : null}
              </g>
            );
          }),
        )}

        {/* ── +N: 남은 항목으로 가는 길 ──
            확대해도 다 못 담는 그룹은 목록으로 보낸다(아래 주석 참조) */}
        {layout.branches
          .filter((b) => b.overflow > 0)
          .map((branch) => {
            const r = branchRadius(branch.total);
            const y = branch.y - r - 20;

            /*
              확대만으로 전부 보여줄 수 있는가.

              ⚠️ 이 분기가 없으면 버튼이 거짓말을 한다. 방사형은 라벨이 가로로
              뻗어 한 가지에 8개가 한계인데(GRAPH_ITEMS_FOCUSED), 82개짜리
              그룹에서 "+76개 더"를 누르면 8개만 늘고 "+74개 더"가 그대로 남는다.
              한 번 더 눌러도 아무 일이 없는 막다른 길이 된다.

              전부 보여줄 수 있을 때만 확대하고, 그렇지 않으면 **실제로 전부
              읽을 수 있는 곳**인 목록 뷰로 보낸다. 목록은 세로로 늘어나므로
              개수 제한이 없다(PreferenceGroup: focused면 group.edges 전량).
            */
            const fitsInGraph = branch.total <= GRAPH_ITEMS_FOCUSED;
            const label = fitsInGraph
              ? `+${branch.overflow}개 더`
              : `${branch.total}개 모두 보기`;
            // 글자 수에 맞춰 알약 폭을 잡는다 — 고정폭이면 긴 문구가 넘친다
            const w = label.length * 9 + 26;

            return (
              <g
                key={`more-${branch.predicate}`}
                className="group/more cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (fitsInGraph) onFocus(branch.predicate);
                  else onShowAll(branch.predicate);
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
                  {label}
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
