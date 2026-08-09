"use client";

import { ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoSequence } from "../../hooks/useDemoSequence";
import { useInView } from "../../hooks/useInView";
import { DemoBar, DemoFrame } from "../../ui";
import { SELLER_SCENARIOS } from "../scenarios";

/**
 * 상품 수정 흐름 — 개선안 → 초안 → 전후 비교 → 판매자 확인 → 적용.
 *
 * 실제 `ProductDiffCard`(features/seller)와 같은 표현을 쓴다: 이전 값은 회색
 * 취소선, 새 값은 브랜드색 강조, 사이에 화살표. 판매자가 실제 화면에서 볼 카드와
 * 같은 모양이라야 랜딩에서 본 것을 그대로 알아본다.
 *
 * **[적용] 버튼을 자동으로 누르지 않는다.** 눌리는 장면을 넣으면 "AI가 알아서
 * 바꾼다"로 읽힌다. 대신 버튼이 강조되는 데서 멈췄다가 완료 상태로 넘어가고,
 * 그 사이에 "판매자 확인"이라는 단계를 명시한다 — 결정 주체가 사람임이 화면에
 * 남아야 한다.
 */

const DRAFT = SELLER_SCENARIOS[0].draft;

export function SafeEditDemo() {
  const { ref, inView } = useInView<HTMLDivElement>();
  // 0 개선안 → 1 초안(전후 비교) → 2 판매자 확인 대기 → 3 적용 완료
  const { reached, resetting } = useDemoSequence([1500, 2200, 2200, 2000], {
    paused: !inView,
    loopDelayMs: 2800,
  });

  const applied = reached(3);

  return (
    <div ref={ref} aria-hidden>
      <DemoFrame dimmed={resetting}>
        <DemoBar>상품 정보 수정</DemoBar>

        <div className="flex flex-col gap-3 p-4 sm:p-5">
          {/* ① 개선안에서 출발했다는 연결 */}
          <div
            className={cn(
              "flex items-start gap-2 rounded-sm border border-brand/30 bg-brand/5 px-3 py-2",
              "transition-[opacity,transform] duration-400 ease-out-strong",
              "motion-reduce:transition-opacity motion-reduce:translate-y-0",
              reached(0)
                ? "translate-y-0 opacity-100"
                : "translate-y-2 opacity-0",
            )}
          >
            <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-brand text-[9px] font-extrabold text-white">
              2
            </span>
            <span className="text-[11px] leading-snug">
              사이즈 정보를 상세 설명 상단으로 올리세요
            </span>
          </div>

          {/* ② 수정 초안 — 전후 비교 */}
          <div
            className={cn(
              "flex flex-col gap-2.5 rounded-sm border bg-background p-3",
              "transition-[opacity,transform] duration-400 ease-out-strong",
              "motion-reduce:transition-opacity motion-reduce:translate-y-0",
              reached(1)
                ? "translate-y-0 opacity-100"
                : "translate-y-2 opacity-0",
            )}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground">
                상품 정보 수정
              </span>
              <span className="text-[12px] font-bold leading-snug">
                {DRAFT.summary}
              </span>
            </div>

            <ul className="flex flex-col gap-2">
              {DRAFT.changes.map((c) => (
                <li key={c.field} className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {c.field}
                  </span>
                  {/* 좁은 화면에선 전→후가 세로로 쌓이도록 wrap (실제 카드와 동일) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="line-clamp-2 rounded-sm bg-muted px-2 py-1 text-[10px] tabular-nums text-muted-foreground line-through">
                      {c.before}
                    </span>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-2 rounded-sm bg-brand/10 px-2 py-1 text-[10px] font-semibold tabular-nums text-brand">
                      {c.after}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* ③ 판매자 확인 — 적용 전에 반드시 거치는 단계 */}
          <div
            className={cn(
              "flex flex-col gap-2 rounded-sm border-t pt-3",
              "transition-opacity duration-400 ease-out-strong",
              reached(2) ? "opacity-100" : "opacity-0",
            )}
          >
            {applied ? (
              <div className="flex items-start gap-2 rounded-sm bg-brand/10 px-3 py-2.5 text-[11px] font-medium text-brand">
                <Check className="mt-px size-3.5 shrink-0" />
                <span>판매자 확인 후 상품 정보를 수정했어요.</span>
              </div>
            ) : (
              <>
                <span className="text-[11px] text-muted-foreground">
                  위 내용으로 진행할까요?
                </span>
                <div className="flex flex-wrap gap-2">
                  {/* 실제로 눌리지 않는 그림이므로 버튼이 아니라 span이다 —
                      button이면 탭 포커스가 가고 눌러도 아무 일이 없어 고장으로 읽힌다 */}
                  <span
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-[11px] font-semibold text-brand-foreground",
                      // 확인을 기다리는 중임을 알리는 얕은 링. 누르는 연출은 하지 않는다
                      "shadow-[0_0_0_3px_rgb(17_94_89/0.12)]",
                    )}
                  >
                    <Check className="size-3" />
                    적용
                  </span>
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[11px] font-medium text-muted-foreground">
                    <X className="size-3" />
                    취소
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </DemoFrame>
    </div>
  );
}
