"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoSequence } from "../../hooks/useDemoSequence";
import { useInView } from "../../hooks/useInView";
import { DemoBar, DemoFrame } from "../../ui";
import { SELLER_SCENARIOS } from "../scenarios";

/**
 * 보고서 구조 데모 — 핵심 요약 / 주요 지표 / 발견된 문제 / 가능한 원인 / 권장 개선안.
 *
 * **데이터로 확인된 사실과 AI가 제안한 것을 시각적으로 구분한다**(요구사항).
 * 구분을 색 하나로만 하지 않는다 — 색각 이상에서 두 블록이 같아 보이면 이 구분이
 * 통째로 사라지기 때문이다. 세 가지를 함께 쓴다:
 *   ① 라벨 문구("데이터로 확인" / "AI 제안")
 *   ② 배경 면(회색 / 브랜드 옅은 톤)
 *   ③ AI 블록에만 붙는 아이콘
 *
 * 실제 리포트 화면(`features/seller/components/AnalysisReport`)의 순서를 그대로
 * 따른다. 랜딩에서 본 구조가 실제 화면과 다르면 처음 쓰는 판매자가 헤맨다.
 */

const SCENARIO = SELLER_SCENARIOS[0];

/** 블록의 출처 — 사실인지 AI 해석인지 */
type Source = "data" | "ai";

interface Block {
  step: number;
  label: string;
  source: Source;
  body: React.ReactNode;
}

export function ReportDemo() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { reached, resetting } = useDemoSequence(
    [1100, 1100, 1100, 1100, 1400],
    { paused: !inView, loopDelayMs: 3000 },
  );

  const blocks: Block[] = [
    {
      step: 0,
      label: "핵심 요약",
      source: "ai",
      body: SCENARIO.summary,
    },
    {
      step: 1,
      label: "주요 지표 변화",
      source: "data",
      body: (
        <span className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
          <span>매출 -18.4%</span>
          <span>주문 -9.2%</span>
          <span>전환율 -0.7%p</span>
          <span>조회 +4.1%</span>
        </span>
      ),
    },
    {
      step: 2,
      label: "발견된 문제",
      source: "data",
      body: SCENARIO.findings[0].summary,
    },
    {
      step: 3,
      label: "가능한 원인",
      source: "ai",
      body: "품절 옵션이 노출되면서 장바구니 담기 단계에서 이탈이 늘었을 가능성이 있어요.",
    },
    {
      step: 4,
      label: "권장 개선안",
      source: "ai",
      body: SCENARIO.recommendations[0].title,
    },
  ];

  return (
    <div ref={ref} aria-hidden>
      <DemoFrame dimmed={resetting}>
        <DemoBar>AI 분석 리포트</DemoBar>

        {/* 범례 — 두 종류의 블록이 무엇을 뜻하는지 먼저 알린다 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span
              aria-hidden
              className="size-2.5 rounded-sm border bg-muted"
            />
            데이터로 확인된 사실
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span
              aria-hidden
              className="size-2.5 rounded-sm border border-brand/40 bg-brand/10"
            />
            AI가 정리한 해석 · 제안
          </span>
        </div>

        <div className="flex flex-col gap-2 p-4 sm:p-5">
          {blocks.map((block) => {
            const on = reached(block.step);
            const isAi = block.source === "ai";
            return (
              <div
                key={block.label}
                className={cn(
                  "flex flex-col gap-1 rounded-sm border px-3 py-2.5",
                  "transition-[opacity,transform] duration-400 ease-out-strong",
                  "motion-reduce:transition-opacity motion-reduce:translate-y-0",
                  on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                  isAi
                    ? "border-brand/30 bg-brand/5"
                    : "border-border bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-1 text-[10px] font-bold",
                    isAi ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  {isAi && <Sparkles className="size-2.5" />}
                  {block.label}
                  <span className="font-medium opacity-70">
                    · {isAi ? "AI 제안" : "데이터로 확인"}
                  </span>
                </span>
                <span className="text-[11px] leading-relaxed">
                  {block.body}
                </span>
              </div>
            );
          })}
        </div>
      </DemoFrame>
    </div>
  );
}
