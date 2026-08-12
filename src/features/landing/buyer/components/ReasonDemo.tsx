"use client";

import { cn } from "@/lib/utils";
import { formatPrice } from "@/shared/utils/formatPrice";
import { useDemoSequence } from "../../hooks/useDemoSequence";
import { useInView } from "../../hooks/useInView";
import { DemoBar, DemoFrame } from "../../ui";
import { TONE_CLASS, type DemoProduct } from "../scenarios";

/**
 * 추천 이유 데모 — 요청 조건과 카드의 이유가 어떻게 대응하는지 보여준다.
 *
 * 카드를 나열한 뒤 이유 문구를 **나중에 켜는** 순서가 핵심이다. 처음부터 다 켜져
 * 있으면 "이유가 붙어 있다"는 사실이 그냥 카드 디자인의 일부로 흘러간다.
 * 조건 → 카드 → 이유 순으로 오면 이유가 조건에 답하고 있다는 관계가 읽힌다.
 *
 * 카테고리별로 결과가 나뉘는 모습도 함께 보여준다(요구사항) — 묶음 이름을
 * 카드 위에 두어 "여러 종류가 필요한 요청은 나눠서 답한다"를 형태로 전한다.
 */

/** 요청 조건 — 아래 카드의 이유가 이 항목들에 대응한다 */
const CONDITIONS = ["캠핑 입문", "2인용", "15만원 이하"] as const;

const GROUPS: { name: string; items: DemoProduct[] }[] = [
  {
    name: "텐트",
    items: [
      {
        id: 11,
        brandName: "필드로그",
        name: "2인용 돔 텐트",
        price: 89000,
        originalPrice: 119000,
        reason: "설치가 쉬운 원터치형이라 입문자에게 맞아요",
        tone: "sage",
      },
    ],
  },
  {
    name: "취침",
    items: [
      {
        id: 12,
        brandName: "노드레스트",
        name: "경량 침낭 3계절용",
        price: 42000,
        originalPrice: 52000,
        reason: "2인 기준 텐트 안에 두 개가 들어가는 폭이에요",
        tone: "slate",
      },
    ],
  },
  {
    name: "조명",
    items: [
      {
        id: 13,
        brandName: "루멘코",
        name: "충전식 캠핑 랜턴",
        price: 18500,
        originalPrice: 24000,
        reason: "남은 예산 안에서 고른 필수 장비예요",
        tone: "clay",
      },
    ],
  },
];

export function ReasonDemo() {
  const { ref, inView } = useInView<HTMLDivElement>();
  // 0 조건 → 1 카드 → 2 이유 강조
  const { reached, resetting } = useDemoSequence([1600, 1800, 2600], {
    paused: !inView,
    loopDelayMs: 3000,
  });

  return (
    <div ref={ref} aria-hidden>
      <DemoFrame dimmed={resetting}>
        <DemoBar>추천 결과</DemoBar>

        {/* 높이를 고정해 장면이 바뀌어도 아래 섹션이 밀리지 않게 한다(CLS).
            단, 400px 미만에서는 카드가 2열로 접혀 두 줄이 되므로 그만큼 키운다 —
            고정 높이를 그대로 두면 둘째 줄이 잘린다. */}
        <div className="flex h-[400px] flex-col gap-3 p-4 min-[400px]:h-[300px] sm:h-[320px] sm:p-5">
          {/* 요청 조건 — 이유가 답해야 할 질문지 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              요청 조건
            </span>
            {CONDITIONS.map((c, i) => (
              <span
                key={c}
                style={{ transitionDelay: `${i * 80}ms` }}
                className={cn(
                  "rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground",
                  "transition-[opacity,transform] duration-300 ease-out-strong",
                  "motion-reduce:transition-opacity",
                  reached(0)
                    ? "translate-y-0 opacity-100"
                    : "translate-y-1 opacity-0",
                )}
              >
                {c}
              </span>
            ))}
          </div>

          {/* 카테고리별 결과.
              360px에서 3열이면 카드 하나가 ~95px라 상품명이 글자 단위로 꺾여
              읽히지 않는다 — 좁은 화면에서는 2열로 두고 넓어질 때 3열로 편다.
              (묶음이 3개라 2열에서는 마지막 하나가 다음 줄로 내려가는데,
               카테고리별로 나뉜다는 사실은 그래도 그대로 읽힌다) */}
          <div className="grid flex-1 grid-cols-2 gap-2 min-[400px]:grid-cols-3">
            {GROUPS.map((group, gi) =>
              group.items.map((p) => (
                <div key={p.id} className="flex min-w-0 flex-col gap-1.5">
                  <span
                    className={cn(
                      "text-[10px] font-semibold text-muted-foreground",
                      "transition-opacity duration-300 ease-out-strong",
                      reached(1) ? "opacity-100" : "opacity-0",
                    )}
                  >
                    {group.name}
                  </span>

                  <article
                    style={{ transitionDelay: `${gi * 70}ms` }}
                    className={cn(
                      "flex min-w-0 flex-1 flex-col overflow-hidden rounded-sm border bg-background",
                      "transition-[opacity,transform] duration-300 ease-out-strong",
                      "motion-reduce:transition-opacity",
                      reached(1)
                        ? "translate-y-0 opacity-100"
                        : "translate-y-2 opacity-0",
                    )}
                  >
                    <div className={cn("h-11 shrink-0", TONE_CLASS[p.tone])} />

                    <div className="flex min-w-0 flex-1 flex-col gap-1 p-2">
                      <span className="truncate text-[10px] text-muted-foreground">
                        {p.brandName}
                      </span>
                      <h4 className="product-card-two-line text-[11px] font-semibold [--product-card-two-line-lh:1.375]">
                        {p.name}
                      </h4>
                      <span className="text-[11px] font-bold tabular-nums">
                        {formatPrice(p.price)}
                      </span>

                      {/* 추천 이유 — 마지막에 켜지며 배경으로 한 번 더 구분된다.
                          이유가 카드의 부속이 아니라 답변의 일부임을 형태로 알린다 */}
                      <p
                        style={{ transitionDelay: `${gi * 90}ms` }}
                        className={cn(
                          "product-card-two-line mt-auto rounded-sm px-1.5 py-1 text-[10px] [--product-card-two-line-lh:1.375] [--product-card-two-line-py:0.25rem]",
                          "transition-[opacity,background-color,color] duration-500 ease-out-strong",
                          reached(2)
                            ? "bg-brand/10 text-brand opacity-100"
                            : "text-muted-foreground opacity-0",
                        )}
                      >
                        {p.reason}
                      </p>
                    </div>
                  </article>
                </div>
              )),
            )}
          </div>

          <p
            className={cn(
              "text-[11px] leading-relaxed text-muted-foreground",
              "transition-opacity duration-500 ease-out-strong",
              reached(2) ? "opacity-100" : "opacity-0",
            )}
          >
            질문하신 시점의 상품 정보를 확인해 조건과 비교한 이유를 함께 보여드려요.
          </p>
        </div>
      </DemoFrame>
    </div>
  );
}
