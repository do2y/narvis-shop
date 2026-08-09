"use client";

import { cn } from "@/lib/utils";
import { useDemoSequence } from "../../hooks/useDemoSequence";
import { useInView } from "../../hooks/useInView";
import { DemoBar, DemoFrame } from "../../ui";

/**
 * "대시보드를 뒤지는 대신 물어보세요" — 지원하는 분석 영역을 보여준다.
 *
 * 영역 이름은 실제 `SellerAnalysisType` 6종의 화면 라벨에서만 가져온다
 * (`AnalysisReport`의 ANALYSIS_LABEL과 같은 문구). 지원 여부가 불분명한 분석을
 * 랜딩에 적으면 없는 기능을 약속하는 것이 된다.
 *
 * 질문이 하나씩 바뀌면서 그에 맞는 영역이 켜진다 — 목록을 나열하는 대신
 * "무엇을 물으면 어디를 보는지"의 대응을 보여주는 편이 이해가 빠르다.
 */

/** 실제 분석 종류 6종 — 라벨은 실제 화면과 같은 문구 */
const AREAS = [
  "매출 이상 분석",
  "구매전환 분석",
  "고객 행동 분석",
  "고객 이탈 분석",
  "어뷰징 점검",
  "리뷰 분석",
] as const;

const ASKS: readonly { question: string; areas: number[] }[] = [
  {
    question: "지난주보다 매출이 왜 줄었어?",
    areas: [0, 1],
  },
  {
    question: "재구매 고객이 줄고 있는지 봐줘",
    areas: [2, 3],
  },
  {
    question: "리뷰 평점이 떨어진 상품 알려줘",
    areas: [5],
  },
  {
    question: "이상한 주문 패턴이 있는지 확인해줘",
    areas: [4],
  },
] as const;

export function AskDataDemo() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { step, resetting } = useDemoSequence([2600, 2600, 2600, 2600], {
    paused: !inView,
    loopDelayMs: 2600,
  });

  const ask = ASKS[Math.min(step, ASKS.length - 1)];

  return (
    <div ref={ref} aria-hidden>
      <DemoFrame dimmed={resetting}>
        <DemoBar>분석 영역</DemoBar>

        <div className="flex h-[280px] flex-col gap-4 p-4 sm:h-[300px] sm:p-5">
          {/* 질문 */}
          <div className="flex justify-end">
            <span
              key={ask.question}
              className={cn(
                "max-w-[88%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-[13px] leading-relaxed tracking-tight text-primary-foreground",
                "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
              )}
            >
              {ask.question}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              이 질문에 사용하는 분석
            </span>

            <ul className="grid grid-cols-2 gap-2">
              {AREAS.map((area, i) => {
                const on = ask.areas.includes(i);
                return (
                  <li
                    key={area}
                    className={cn(
                      "flex items-center gap-2 rounded-sm border px-2.5 py-2 text-[11px]",
                      "transition-[background-color,border-color,color,opacity] duration-400 ease-out-strong",
                      on
                        ? "border-brand/40 bg-brand/5 font-semibold text-brand"
                        : "text-muted-foreground opacity-55",
                    )}
                  >
                    {/* 선택 여부를 색뿐 아니라 점의 채움으로도 표시 */}
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        on ? "bg-brand" : "bg-muted-foreground/40",
                      )}
                    />
                    <span className="truncate">{area}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-auto text-[11px] leading-relaxed text-muted-foreground">
            질문에 따라 필요한 분석을 골라서 수행해요.
          </p>
        </div>
      </DemoFrame>
    </div>
  );
}
