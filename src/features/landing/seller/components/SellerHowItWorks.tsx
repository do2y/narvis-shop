"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoSequence } from "../../hooks/useDemoSequence";
import { useInView } from "../../hooks/useInView";
import { Reveal, SECTION_Y, SHELL, SectionHead } from "../../ui";

/**
 * 이용 흐름 5단계 — **하나의 분석 화면이 발전하는 방식**으로 보여준다(요구사항).
 *
 * 단계마다 새 카드를 띄우지 않고, 오른쪽 화면 한 장이 단계에 따라 내용을
 * 갈아입는다. 5개의 서로 다른 기능이 아니라 한 번의 분석이 진행되는 것이라는
 * 사실이 레이아웃으로 전달되어야 한다.
 *
 * 스크롤에 묶지 않는다(스크롤재킹 금지). 자동 진행이고, 사용자는 언제든 지나갈 수 있다.
 */

interface Stage {
  no: string;
  title: string;
  /** 오른쪽 화면에 그려질 내용 */
  screen: { label: string; lines: string[] };
}

const STAGES: readonly Stage[] = [
  {
    no: "01",
    title: "판매 데이터 질문",
    screen: {
      label: "질문",
      lines: ["최근 30일 매출이 떨어진 상품과 원인을 알려줘"],
    },
  },
  {
    no: "02",
    title: "분석 계획 확인",
    screen: {
      label: "분석 범위",
      lines: ["기간 · 최근 30일", "대상 · 판매 중 상품 42개", "관점 · 매출 / 전환 / 행동"],
    },
  },
  {
    no: "03",
    title: "여러 관점으로 데이터 분석",
    screen: {
      label: "진행 중",
      lines: ["관련 데이터 확인 완료", "매출 이상 분석 완료", "구매전환 분석 완료"],
    },
  },
  {
    no: "04",
    title: "결과 검토",
    screen: {
      label: "교차 검토",
      lines: [
        "품절 옵션 노출 · 여러 관점에서 공통 확인",
        "상세 정보 부족 · 행동 분석에서 확인",
      ],
    },
  },
  {
    no: "05",
    title: "보고서와 개선안 확인",
    screen: {
      label: "리포트",
      lines: [
        "핵심 요약 · 조회는 늘고 매출은 18.4% 감소",
        "개선안 1 · 품절 옵션 정리 및 재고 보충",
        "개선안 2 · 사이즈 정보를 설명 상단으로",
      ],
    },
  },
] as const;

export function SellerHowItWorks() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { step, resetting } = useDemoSequence(
    [2600, 2600, 2600, 2600, 2600],
    { paused: !inView, loopDelayMs: 3000 },
  );

  const activeIndex = Math.min(step, STAGES.length - 1);
  const screen = STAGES[activeIndex].screen;

  return (
    <section
      id="how-it-works"
      className={cn(SECTION_Y, "scroll-mt-20")}
    >
      <div className={SHELL}>
        <Reveal>
          <SectionHead
            eyebrow="이용 방법"
            title="질문 하나가 보고서가 되기까지"
            description="분석이 어디까지 왔는지 화면에서 확인할 수 있어요."
            align="center"
            className="mx-auto max-w-2xl"
          />
        </Reveal>

        <Reveal>
          <div
            ref={ref}
            className="mt-12 grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14"
          >
            {/* 단계 목록 — 정적 텍스트라 스크린리더가 전부 읽는다 */}
            <ol className="flex flex-col">
              {STAGES.map((stage, i) => {
                const done = i < activeIndex;
                const active = i === activeIndex;
                return (
                  <li
                    key={stage.no}
                    className={cn(
                      "flex items-center gap-3.5 rounded-sm px-3 py-3",
                      "transition-[background-color,opacity] duration-500 ease-out-strong",
                      active ? "bg-muted/60" : "opacity-55",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold tabular-nums",
                        "transition-colors duration-500 ease-out-strong",
                        done || active
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="size-3" /> : stage.no}
                    </span>
                    <span
                      className={cn(
                        "text-[15px] leading-snug",
                        active ? "font-bold" : "font-medium",
                      )}
                    >
                      {stage.title}
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* 발전하는 화면 한 장 — aria-hidden(왼쪽 목록이 같은 순서를 말한다) */}
            <div
              aria-hidden
              className={cn(
                "flex h-[280px] flex-col overflow-hidden rounded-xl border bg-background sm:h-[320px]",
                "shadow-[0_1px_2px_rgb(16_24_40/0.04),0_12px_32px_-8px_rgb(16_24_40/0.10)]",
                "transition-opacity duration-300 ease-out-strong",
                resetting && "opacity-0",
              )}
            >
              <div className="flex h-11 shrink-0 items-center justify-between border-b bg-muted/40 px-4">
                <span className="text-xs font-semibold text-muted-foreground">
                  {screen.label}
                </span>
                {/* 진행 표시 — 5단계 중 어디인지 */}
                <span className="text-[10px] font-semibold tabular-nums text-brand">
                  {activeIndex + 1} / {STAGES.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
                {screen.lines.map((line, i) => (
                  <p
                    // key에 단계를 섞어 화면이 바뀔 때마다 재마운트 → 등장 연출이 다시 돈다.
                    // 여기서는 내용이 통째로 교체되므로 "무엇이 유지됐는지" 문제가 없다.
                    key={`${activeIndex}-${i}`}
                    style={{ animationDelay: `${i * 90}ms` }}
                    className={cn(
                      "rounded-sm border bg-muted/30 px-3 py-2.5 text-[12px] leading-relaxed",
                      "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-400 motion-safe:fill-mode-backwards",
                    )}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
