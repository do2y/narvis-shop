"use client";

import { cn } from "@/lib/utils";
import { useDemoSequence } from "../../hooks/useDemoSequence";
import { useInView } from "../../hooks/useInView";
import { Reveal, SECTION_Y, SHELL, SectionHead } from "../../ui";

/**
 * 이용 흐름 3단계.
 *
 * 아이콘 3개를 나열하지 않는다(요구사항). **하나의 대화가 단계별로 자라는 장면**으로
 * 구성했다 — 왼쪽에서 단계 설명이 강조되고, 오른쪽 대화 창에는 그 단계까지의
 * 말풍선이 누적된다. 3단계가 서로 다른 기능이 아니라 **한 번의 대화**라는 것이
 * 이 섹션이 전해야 할 내용이다.
 */

interface Stage {
  no: string;
  title: string;
  description: string;
  /** 이 단계에서 새로 쌓이는 대화 */
  turns: { side: "user" | "ai"; text: string }[];
}

const STAGES: readonly Stage[] = [
  {
    no: "01",
    title: "원하는 조건 말하기",
    description:
      "상황과 예산을 평소 말투로 이야기하면 돼요. 검색어로 다듬을 필요는 없어요.",
    turns: [
      { side: "user", text: "주말 캠핑 갈 건데 2인용 텐트 추천해줘" },
      { side: "ai", text: "캠핑 입문 · 2인용 조건으로 찾아볼게요." },
    ],
  },
  {
    no: "02",
    title: "추천 이유와 상품 비교하기",
    description:
      "요청 조건과 비교한 이유가 함께 나와요. 무엇이 왜 맞는지 보고 고르면 돼요.",
    turns: [
      {
        side: "ai",
        text: "원터치형이라 설치가 쉬운 돔 텐트예요. 8만 9천 원.",
      },
    ],
  },
  {
    no: "03",
    title: "조건을 바꾸거나 장바구니에 담기",
    description:
      "마음에 안 들면 이어서 말하면 돼요. 담을 때도 옵션은 직접 확인하고 진행해요.",
    turns: [
      { side: "user", text: "조금 더 가벼운 걸로 바꿔줘" },
      { side: "ai", text: "무게 조건을 더해 다시 골랐어요." },
    ],
  },
] as const;

export function BuyerHowItWorks() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { step, resetting } = useDemoSequence([3200, 3200, 3200], {
    paused: !inView,
    loopDelayMs: 3400,
  });

  const activeIndex = Math.min(step, STAGES.length - 1);
  // 지금 단계까지 쌓인 대화 — 단계가 진행돼도 앞의 말풍선이 남아야
  // "이어지는 한 대화"로 읽힌다
  const visibleTurns = STAGES.slice(0, activeIndex + 1).flatMap((s) => s.turns);

  return (
    <section id="how-it-works" className={cn(SECTION_Y, "scroll-mt-20 bg-muted/25")}>
      <div className={SHELL}>
        <Reveal>
          <SectionHead
            eyebrow="이용 방법"
            title="한 번의 대화로 끝납니다"
            description="따로 배울 것이 없어요. 말을 이어가면 결과가 좁혀집니다."
            align="center"
            className="mx-auto max-w-2xl"
          />
        </Reveal>

        <Reveal>
          <div
            ref={ref}
            className="mt-12 grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14"
          >
            {/* 단계 목록 — 현재 단계가 강조된다.
                자동 진행이지만 목록 자체는 정적 텍스트라 스크린리더가 전부 읽는다 */}
            <ol className="flex flex-col gap-3">
              {STAGES.map((stage, i) => {
                const active = i === activeIndex;
                return (
                  <li
                    key={stage.no}
                    className={cn(
                      "flex gap-4 rounded-sm border p-4 sm:p-5",
                      "transition-[background-color,border-color,opacity] duration-500 ease-out-strong",
                      active
                        ? "border-brand/40 bg-background"
                        : "border-transparent bg-transparent opacity-55",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[13px] font-bold tabular-nums",
                        "transition-colors duration-500 ease-out-strong",
                        active ? "text-brand" : "text-muted-foreground",
                      )}
                    >
                      {stage.no}
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-[15px] font-bold tracking-tight sm:text-base">
                        {stage.title}
                      </h3>
                      <p className="text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
                        {stage.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* 누적되는 대화 — aria-hidden(왼쪽 목록이 같은 내용을 이미 말한다) */}
            <div
              aria-hidden
              className={cn(
                "flex h-[300px] flex-col justify-end gap-2.5 overflow-hidden rounded-xl border bg-background p-4 sm:h-[340px] sm:p-5",
                "shadow-[0_1px_2px_rgb(16_24_40/0.04),0_12px_32px_-8px_rgb(16_24_40/0.10)]",
                "transition-opacity duration-300 ease-out-strong",
                resetting && "opacity-0",
              )}
            >
              {visibleTurns.map((turn, i) => (
                <div
                  key={`${turn.side}-${i}`}
                  className={cn(
                    "flex",
                    turn.side === "user" ? "justify-end" : "justify-start",
                    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-400",
                  )}
                >
                  <span
                    className={cn(
                      "max-w-[85%] text-[13px] leading-relaxed",
                      turn.side === "user"
                        ? "rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 tracking-tight text-primary-foreground"
                        : "rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2",
                    )}
                  >
                    {turn.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
