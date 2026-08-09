"use client";

import { cn } from "@/lib/utils";
import { useDemoSequence } from "../../hooks/useDemoSequence";
import { useInView } from "../../hooks/useInView";
import { DemoBar, DemoFrame } from "../../ui";

/**
 * 취향 그래프 데모 — 실제 마이페이지 그래프(`mypage/preferences/PreferenceGraph`)의
 * 축소판.
 *
 * **실물을 그대로 쓰지 않는 이유**는 그쪽이 서버 데이터(`ProfileGraph.edges`)와
 * 수정·삭제 다이얼로그에 묶여 있어서다. 랜딩은 로그인 없이 열리므로 데이터가 없고,
 * 누를 수 없는 그래프에 편집 UI가 붙으면 고장으로 읽힌다.
 *
 * **장식용 그래프를 새로 만들지도 않는다.** 실제 화면의 시각 언어를 그대로 지킨다:
 *  - 중심 `나` → 관계 노드 → 항목 노드의 2단 방사 구조
 *  - 관계 노드 안의 숫자 = 그 관계의 항목 수, 원 크기도 개수에 비례
 *  - 개별 대상(제품·브랜드)은 사각형, 범주(속성·가격대)는 원 — 색이 아니라 형태로 구분
 *  - 아직 만들어지는 경로가 없는 관계(회피)는 점선 + "아직 없어요"
 *
 * 좌표는 뷰박스 안에 직접 적는다. 실제 화면은 항목 수가 변해 계산이 필요하지만
 * 여기는 고정된 그림 한 장이라 레이아웃 함수를 들일 이유가 없다.
 */

interface Leaf {
  label: string;
  x: number;
  y: number;
  /** 개별 대상(제품·브랜드)이면 사각형 */
  discrete?: boolean;
  anchor: "start" | "end";
}

interface Branch {
  label: string;
  count: number;
  x: number;
  y: number;
  leaves: Leaf[];
  empty?: boolean;
  /** 등장 순서 — 관계 하나씩 이어진다 */
  step: number;
}

const CX = 300;
const CY = 190;

const BRANCHES: readonly Branch[] = [
  {
    label: "선호",
    count: 3,
    x: 120,
    y: 96,
    step: 1,
    leaves: [
      { label: "가벼운", x: 36, y: 44, anchor: "end" },
      { label: "무선", x: 24, y: 96, anchor: "end" },
      { label: "모노플랜", x: 40, y: 148, anchor: "end", discrete: true },
    ],
  },
  {
    label: "좋아함",
    count: 2,
    x: 480,
    y: 96,
    step: 2,
    leaves: [
      { label: "베이지", x: 566, y: 52, anchor: "start" },
      { label: "10만원대", x: 574, y: 108, anchor: "start" },
    ],
  },
  {
    label: "관심",
    count: 2,
    x: 442,
    y: 286,
    step: 3,
    leaves: [
      { label: "러닝화", x: 540, y: 268, anchor: "start" },
      { label: "캠핑용품", x: 528, y: 322, anchor: "start" },
    ],
  },
  {
    label: "구매",
    count: 4,
    x: 300,
    y: 322,
    step: 4,
    leaves: [
      { label: "트래블 파우치", x: 268, y: 372, anchor: "end", discrete: true },
    ],
  },
  {
    label: "회피",
    count: 0,
    x: 152,
    y: 286,
    step: 5,
    empty: true,
    leaves: [],
  },
] as const;

/** 관계 노드 반지름 — 실제 화면과 같은 원리(개수의 제곱근에 비례) */
function radius(count: number): number {
  if (count === 0) return 13;
  return Math.min(30, 17 + Math.sqrt(count) * 2.6);
}

export function PreferenceDemo() {
  const { ref, inView } = useInView<HTMLDivElement>();
  // 관계가 하나씩 이어지고(1~5), 마지막에 수정 안내가 뜬다(6)
  const { reached, resetting } = useDemoSequence(
    [700, 620, 620, 620, 620, 700, 900],
    { paused: !inView, loopDelayMs: 3400 },
  );

  return (
    <div ref={ref}>
      <DemoFrame dimmed={resetting}>
        <DemoBar>마이페이지 · AI가 이해한 내 취향</DemoBar>

        <div className="p-3 sm:p-4">
          {/*
            SVG는 스크린리더에 읽히지 않는다. 실제 화면은 `ScreenReaderList`로
            같은 내용을 목록으로 병행하지만, 랜딩에서는 바로 아래 본문이 이미
            같은 설명을 하고 있어 중복이 된다 — 그래서 여기서는 감춘다.
          */}
          <svg
            viewBox="0 0 600 400"
            aria-hidden="true"
            className="h-auto w-full select-none"
          >
            {/* ── 가지: 나 → 관계 ── */}
            {BRANCHES.map((b) => (
              <line
                key={`edge-${b.label}`}
                x1={CX}
                y1={CY}
                x2={b.x}
                y2={b.y}
                strokeWidth={b.empty ? 1.2 : Math.min(4, 1.7 + Math.sqrt(b.count) * 0.5)}
                strokeLinecap="round"
                strokeDasharray={b.empty ? "4 5" : undefined}
                className={cn(
                  b.empty ? "stroke-border" : "stroke-foreground/25",
                  // 선이 중심에서 뻗어 나가는 대신 페이드로 들어온다 —
                  // stroke-dashoffset 애니메이션은 매 프레임 페인트를 유발하고,
                  // 여기서 전하려는 건 "그려지는 과정"이 아니라 "이어져 있다"는 사실이다
                  "transition-opacity duration-500 ease-out-strong",
                  reached(b.step) ? "opacity-100" : "opacity-0",
                )}
              />
            ))}

            {/* ── 잔가지: 관계 → 항목 ── */}
            {BRANCHES.flatMap((b) =>
              b.leaves.map((leaf) => (
                <line
                  key={`twig-${leaf.label}`}
                  x1={b.x}
                  y1={b.y}
                  x2={leaf.x}
                  y2={leaf.y}
                  strokeWidth={1.1}
                  className={cn(
                    "stroke-foreground/15 transition-opacity duration-500 ease-out-strong",
                    reached(b.step) ? "opacity-100" : "opacity-0",
                  )}
                />
              )),
            )}

            {/* ── 중심: 나 ── */}
            <circle cx={CX} cy={CY} r={30} className="fill-primary" />
            <text
              x={CX}
              y={CY}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-primary-foreground text-[17px] font-semibold"
            >
              나
            </text>

            {/* ── 관계 노드 ── */}
            {BRANCHES.map((b) => {
              const r = radius(b.count);
              return (
                <g
                  key={`branch-${b.label}`}
                  className={cn(
                    "transition-opacity duration-500 ease-out-strong",
                    reached(b.step)
                      ? b.empty
                        ? "opacity-55"
                        : "opacity-100"
                      : "opacity-0",
                  )}
                >
                  <circle
                    cx={b.x}
                    cy={b.y}
                    r={r}
                    strokeWidth={b.empty ? 1.2 : 1.8}
                    strokeDasharray={b.empty ? "4 4" : undefined}
                    className={cn(
                      "fill-background",
                      b.empty ? "stroke-border" : "stroke-foreground/35",
                    )}
                  />
                  {!b.empty && (
                    <text
                      x={b.x}
                      y={b.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="fill-foreground text-[13px] font-semibold tabular-nums"
                    >
                      {b.count}
                    </text>
                  )}
                  <text
                    x={b.x}
                    y={b.y + r + 15}
                    textAnchor="middle"
                    className={cn(
                      "text-[13px] font-semibold",
                      b.empty ? "fill-muted-foreground" : "fill-foreground",
                    )}
                  >
                    {b.label}
                  </text>
                  {b.empty && (
                    <text
                      x={b.x}
                      y={b.y + r + 31}
                      textAnchor="middle"
                      className="fill-muted-foreground/80 text-[11px]"
                    >
                      아직 없어요
                    </text>
                  )}
                </g>
              );
            })}

            {/* ── 항목 노드 ── */}
            {BRANCHES.flatMap((b) =>
              b.leaves.map((leaf) => (
                <g
                  key={`leaf-${leaf.label}`}
                  className={cn(
                    "transition-opacity duration-500 ease-out-strong",
                    reached(b.step) ? "opacity-100" : "opacity-0",
                  )}
                >
                  {leaf.discrete ? (
                    <rect
                      x={leaf.x - 4.5}
                      y={leaf.y - 4.5}
                      width={9}
                      height={9}
                      rx={2}
                      className="fill-foreground/70"
                    />
                  ) : (
                    <circle
                      cx={leaf.x}
                      cy={leaf.y}
                      r={5}
                      className="fill-foreground/70"
                    />
                  )}
                  <text
                    x={leaf.x + (leaf.anchor === "start" ? 12 : -12)}
                    y={leaf.y}
                    textAnchor={leaf.anchor}
                    dominantBaseline="central"
                    className="fill-foreground/85 text-[12px]"
                  >
                    {leaf.label}
                  </text>
                </g>
              )),
            )}
          </svg>

          {/* 마지막 장면 — 이 그래프가 읽기 전용이 아니라는 것을 알린다.
              그래프 위에 겹치지 않고 아래에 두는 이유: 겹치면 항목 라벨을 가리고,
              모션 감소 상태(모든 장면 동시 표시)에서 특히 어수선해진다 */}
          <div
            className={cn(
              "mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-sm bg-muted/50 px-3 py-2.5 text-[11px] text-muted-foreground",
              "transition-opacity duration-500 ease-out-strong",
              reached(6) ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="font-semibold text-foreground">
              잘못 이해했다면 고칠 수 있어요
            </span>
            <span>항목을 눌러 수정 · 삭제</span>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span>개인화 끄기</span>
          </div>
        </div>
      </DemoFrame>
    </div>
  );
}
