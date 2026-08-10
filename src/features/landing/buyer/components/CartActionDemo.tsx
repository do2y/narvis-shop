"use client";

import { Check, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoSequence } from "../../hooks/useDemoSequence";
import { useInView } from "../../hooks/useInView";
import { DemoBar, DemoFrame } from "../../ui";

/**
 * 추천 → 행동 데모: 말 → 옵션 확인 → 담기 → 완료.
 *
 * **옵션 확인 단계를 생략하지 않는 것이 이 데모의 요점이다.** 말 한마디로 바로
 * 담기는 것처럼 그리면 "확인 없이 진행된다"는 잘못된 기대를 만든다. 실제 계약도
 * 옵션이 필요한 상품은 서버가 400(CART_OPTION_REQUIRED)으로 되돌려 선택을 받는다.
 * 구매(결제)까지 이어지는 장면은 만들지 않는다 — 그 단계는 사용자가 직접 한다.
 *
 * 4단계를 세로 타임라인으로 둔다. 가로로 늘어놓으면 모바일에서 글자가 잘리고,
 * 세로는 위에서 아래로 읽는 순서가 곧 시간 순서라 화살표 없이도 인과가 읽힌다.
 */

interface Stage {
  /** 왼쪽 라벨 */
  kind: "말" | "확인" | "실행" | "완료";
  text: string;
}

const STAGES: readonly Stage[] = [
  { kind: "말", text: "두 번째 상품 담아줘" },
  { kind: "확인", text: "색상 옵션이 있어요 · 차콜 / 아이보리" },
  { kind: "실행", text: "차콜로 담을게요" },
  { kind: "완료", text: "장바구니에 담았어요" },
] as const;

export function CartActionDemo() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { reached, resetting } = useDemoSequence([1500, 2000, 1600, 1800], {
    paused: !inView,
    loopDelayMs: 2800,
  });

  return (
    <div ref={ref} aria-hidden>
      <DemoFrame dimmed={resetting}>
        <DemoBar>장바구니 담기</DemoBar>

        <div className="flex h-[300px] flex-col p-4 sm:h-[320px] sm:p-5">
          <ol className="relative flex flex-1 flex-col justify-between">
            {/* 세로 연결선 — 단계들이 하나의 흐름임을 잇는다.
                점들 사이 배경에 깔리므로 z 순서상 먼저 그린다 */}
            <span
              aria-hidden
              className="absolute bottom-4 left-[7px] top-4 w-px bg-border"
            />

            {STAGES.map((stage, i) => {
              const on = reached(i);
              const isLast = i === STAGES.length - 1;
              return (
                <li
                  key={stage.kind}
                  className={cn(
                    "relative flex items-start gap-3",
                    "transition-[opacity,transform] duration-400 ease-out-strong",
                    "motion-reduce:transition-opacity motion-reduce:translate-y-0",
                    on ? "translate-y-0 opacity-100" : "translate-y-1 opacity-35",
                  )}
                >
                  {/* 진행 점 — 완료 단계만 채워진 브랜드색 + 체크.
                      상태를 색으로만 구분하지 않도록 아이콘을 함께 바꾼다 */}
                  <span
                    className={cn(
                      "relative z-10 mt-0.5 flex size-[15px] shrink-0 items-center justify-center rounded-full border-2 bg-background",
                      "transition-colors duration-300 ease-out-strong",
                      on
                        ? isLast
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-brand"
                        : "border-border",
                    )}
                  >
                    {on && isLast && <Check className="size-2.5" />}
                  </span>

                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={cn(
                        "text-[10px] font-semibold",
                        on ? "text-brand" : "text-muted-foreground",
                      )}
                    >
                      {stage.kind}
                    </span>
                    <span
                      className={cn(
                        "text-[13px] leading-snug",
                        on ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {stage.text}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* 결과 — 장바구니 상태가 실제로 변했다는 확인 */}
          <div
            className={cn(
              "mt-4 flex items-center justify-between gap-2 rounded-sm border px-3 py-2.5",
              "transition-[opacity,border-color,background-color] duration-400 ease-out-strong",
              reached(3)
                ? "border-brand/30 bg-brand/5 opacity-100"
                : "opacity-45",
            )}
          >
            <span className="flex items-center gap-2 text-[12px] font-medium">
              <ShoppingCart
                className={cn(
                  "size-4",
                  reached(3) ? "text-brand" : "text-muted-foreground",
                )}
              />
              장바구니
            </span>
            <span
              className={cn(
                "text-[12px] font-bold tabular-nums",
                reached(3) ? "text-brand" : "text-muted-foreground",
              )}
            >
              {reached(3) ? "1개" : "0개"}
            </span>
          </div>

          <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
            구매와 결제는 장바구니에서 직접 확인하고 진행해요.
          </p>
        </div>
      </DemoFrame>
    </div>
  );
}
