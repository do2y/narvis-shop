"use client";

import { cn } from "@/lib/utils";
import { useDemoSequence } from "../../hooks/useDemoSequence";
import { useInView } from "../../hooks/useInView";
import { DemoBar, DemoFrame } from "../../ui";

/**
 * 여러 관점의 분석이 하나의 보고서로 모이는 모습.
 *
 * **복잡한 네트워크 다이어그램을 그리지 않는다**(요구사항). 노드와 화살표가 얽힌
 * 그림은 내부 구조를 자랑할 뿐 판매자에게 아무것도 말해주지 않는다. 여기서 전할
 * 것은 딱 하나 — "여러 갈래로 본 결과가 하나로 합쳐진다".
 *
 * 그래서 관점 카드 4장이 위에 늘어서고, 검토를 거쳐, 아래 보고서 한 장으로
 * 수렴하는 세로 흐름으로 만든다. 위→아래 이동 자체가 "모인다"는 뜻이 된다.
 *
 * 관점 이름은 실제 분석 종류(`SellerAnalysisType`)의 화면 라벨을 그대로 쓴다 —
 * 랜딩에만 있는 분석을 지어내지 않는다.
 */

const PERSPECTIVES = [
  { label: "매출 이상", note: "-18.4%" },
  { label: "구매 전환", note: "-0.7%p" },
  { label: "고객 행동", note: "체류 +23초" },
  { label: "리뷰", note: "평점 3.6" },
] as const;

export function PerspectiveDemo() {
  const { ref, inView } = useInView<HTMLDivElement>();
  // 0 관점 등장 → 1 교차 검토 → 2 원인 후보 → 3 보고서로 정리
  const { reached, resetting } = useDemoSequence([1800, 1800, 1800, 2200], {
    paused: !inView,
    loopDelayMs: 2800,
  });

  return (
    <div ref={ref} aria-hidden>
      <DemoFrame dimmed={resetting}>
        <DemoBar>분석 관점</DemoBar>

        <div className="flex h-[300px] flex-col gap-3 p-4 sm:h-[330px] sm:p-5">
          {/* ① 여러 관점 — 각자 다른 것을 본다 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PERSPECTIVES.map((p, i) => (
              <div
                key={p.label}
                style={{ transitionDelay: `${i * 90}ms` }}
                className={cn(
                  "flex flex-col gap-0.5 rounded-sm border px-2.5 py-2",
                  "transition-[opacity,transform,border-color,background-color] duration-400 ease-out-strong",
                  "motion-reduce:transition-[opacity,border-color,background-color]",
                  reached(0)
                    ? "translate-y-0 opacity-100"
                    : "translate-y-2 opacity-0",
                  // 교차 검토 장면에서 네 관점이 함께 브랜드색을 띤다 —
                  // "따로 본 것을 서로 맞춰본다"를 동시 변화로 표현
                  reached(1) && "border-brand/40 bg-brand/5",
                )}
              >
                <span className="truncate text-[10px] font-semibold">
                  {p.label}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-bold tabular-nums",
                    reached(1) ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  {p.note}
                </span>
              </div>
            ))}
          </div>

          {/* ② 교차 검토 표시 */}
          <div
            className={cn(
              "flex items-center gap-2 self-center rounded-full bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground",
              "transition-opacity duration-400 ease-out-strong",
              reached(1) ? "opacity-100" : "opacity-0",
            )}
          >
            결과를 서로 맞춰보는 중
          </div>

          {/* ③ 주요 원인 후보 — 단정하지 않는다("가능한 원인") */}
          <div
            className={cn(
              "flex flex-col gap-1.5 rounded-sm border bg-muted/30 px-3 py-2.5",
              "transition-[opacity,transform] duration-400 ease-out-strong",
              "motion-reduce:transition-opacity",
              reached(2)
                ? "translate-y-0 opacity-100"
                : "translate-y-2 opacity-0",
            )}
          >
            <span className="text-[10px] font-bold text-muted-foreground">
              주요 원인 후보
            </span>
            <span className="text-[11px] leading-snug">
              품절 옵션 노출 · 상세 정보 부족 두 가지가 여러 관점에서 공통으로
              나타났어요.
            </span>
          </div>

          {/* ④ 하나의 보고서로 */}
          <div
            className={cn(
              "mt-auto flex items-center gap-2.5 rounded-sm border border-l-[3px] border-l-brand bg-background px-3 py-2.5",
              "transition-[opacity,transform] duration-500 ease-out-strong",
              "motion-reduce:transition-opacity",
              reached(3)
                ? "translate-y-0 opacity-100"
                : "translate-y-3 opacity-0",
            )}
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] font-bold text-brand">
                하나의 보고서로 정리
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">
                관점별 결과와 가능한 원인, 개선안을 한 문서에 담아요.
              </span>
            </div>
          </div>
        </div>
      </DemoFrame>
    </div>
  );
}
