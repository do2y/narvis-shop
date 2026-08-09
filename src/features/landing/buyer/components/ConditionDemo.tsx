"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoSequence } from "../../hooks/useDemoSequence";
import { useInView } from "../../hooks/useInView";
import { DemoBar, DemoFrame } from "../../ui";

/**
 * 조건이 대화에 따라 추가·수정·제외되는 모습.
 *
 * 사용자의 이어지는 말 한 마디마다 칩 묶음이 어떻게 달라지는지를 보여준다 —
 * "검색 조건을 정리하지 않아도 된다"는 주장의 근거가 이 변화 자체다.
 *
 * 장면마다 **바뀌는 칩이 하나뿐**이다. 여러 개가 동시에 움직이면 무엇이 달라졌는지
 * 읽어낼 수 없어, 애니메이션이 설명이 아니라 소음이 된다.
 */

type ChipState = "kept" | "added" | "removed" | "changed";

interface Turn {
  /** 사용자가 이어서 한 말 */
  says: string;
  chips: { label: string; state: ChipState }[];
}

const TURNS: readonly Turn[] = [
  {
    says: "가볍게 신을 운동화 찾아줘",
    chips: [
      { label: "운동화", state: "added" },
      { label: "가벼운 착용감", state: "added" },
    ],
  },
  {
    says: "10만 원 안쪽이면 좋겠어",
    chips: [
      { label: "운동화", state: "kept" },
      { label: "가벼운 착용감", state: "kept" },
      { label: "10만원 이하", state: "added" },
    ],
  },
  {
    says: "조금 더 저렴하게",
    chips: [
      { label: "운동화", state: "kept" },
      { label: "가벼운 착용감", state: "kept" },
      { label: "7만원 이하", state: "changed" },
    ],
  },
  {
    says: "검은색은 빼줘",
    chips: [
      { label: "운동화", state: "kept" },
      { label: "가벼운 착용감", state: "kept" },
      { label: "7만원 이하", state: "kept" },
      { label: "검은색 제외", state: "added" },
    ],
  },
] as const;

const STATE_NOTE: Record<ChipState, string | null> = {
  kept: null,
  added: "추가됨",
  removed: "제외됨",
  changed: "변경됨",
};

export function ConditionDemo() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { step, resetting } = useDemoSequence([2600, 2600, 2600, 2600], {
    paused: !inView,
    loopDelayMs: 3000,
  });

  const turn = TURNS[Math.min(step, TURNS.length - 1)];

  return (
    // aria-hidden: 섹션 본문이 같은 내용을 글로 설명한다.
    // 칩이 매 장면 바뀌므로 읽히면 같은 단어가 계속 반복된다.
    <div ref={ref} aria-hidden>
      <DemoFrame dimmed={resetting}>
        <DemoBar>조건 정리</DemoBar>

        {/* 높이 고정 — 칩이 2개에서 4개로 늘면 컨테이너가 커져 옆 텍스트가 밀린다 */}
        <div className="flex h-[220px] flex-col gap-4 p-5 sm:h-[236px]">
          {/* 사용자의 말 — 이번 장면에서 무엇이 바뀌었는지의 원인 */}
          <div className="flex justify-end">
            <span
              key={turn.says}
              className={cn(
                "max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-[13px] leading-relaxed tracking-tight text-primary-foreground",
                "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
              )}
            >
              {turn.says}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              지금 적용된 조건
            </span>

            <ul className="flex flex-wrap gap-1.5">
              {turn.chips.map((chip) => {
                const note = STATE_NOTE[chip.state];
                const emphasized = chip.state !== "kept";
                return (
                  <li
                    // key에 상태를 섞지 않는다 — 유지되는 칩이 재마운트되면
                    // 안 바뀐 것까지 다시 등장해 "무엇이 달라졌는지"가 흐려진다
                    key={chip.label}
                    className={cn(
                      "flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1.5 text-xs",
                      "transition-colors duration-300 ease-out-strong",
                      "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300",
                      emphasized
                        ? // 새 조건·바뀐 조건은 배경 + 굵기로 구분(색만 쓰지 않는다)
                          "bg-brand/10 font-semibold text-brand"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {chip.label}
                    {note && (
                      <span className="text-[10px] font-medium opacity-80">
                        {note}
                      </span>
                    )}
                    <span
                      aria-hidden
                      className="flex size-4 items-center justify-center rounded-full"
                    >
                      <X className="size-3" />
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="mt-auto text-[11px] leading-relaxed text-muted-foreground">
              칩의 ✕를 눌러 직접 조건을 뺄 수도 있어요.
            </p>
          </div>
        </div>
      </DemoFrame>
    </div>
  );
}
