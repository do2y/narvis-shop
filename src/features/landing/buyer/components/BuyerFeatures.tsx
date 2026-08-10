"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, SECTION_Y, SHELL, SectionHead } from "../../ui";
import { ConditionDemo } from "./ConditionDemo";
import { PreferenceDemo } from "./PreferenceDemo";
import { ReasonDemo } from "./ReasonDemo";
import { CartActionDemo } from "./CartActionDemo";

/**
 * 소비자 핵심 기능 4개.
 *
 * 텍스트와 실제 UI를 좌우로 **교차 배치**한다(짝수는 UI가 왼쪽). 같은 방향이
 * 네 번 반복되면 스크롤이 한 줄기로 흘러 어디가 새 섹션인지 잘 끊기지 않는다.
 * 모바일에서는 교차가 무의미하므로(1열) 항상 텍스트 → UI 순으로 쌓는다 —
 * 주장을 먼저 읽고 근거를 보는 순서가 유지되어야 한다.
 */

interface FeatureBlock {
  eyebrow: string;
  title: React.ReactNode;
  description: React.ReactNode;
  /** 본문 아래 추가 항목 — 있을 때만 그린다 */
  bullets?: string[];
  demo: React.ReactNode;
}

export function BuyerFeatures() {
  const blocks: FeatureBlock[] = [
    {
      eyebrow: "자연어 상품 검색",
      title: "검색 조건을 정리하지 않아도 괜찮아요",
      description:
        "용도, 예산, 취향이 섞인 요청도 쇼핑 조건으로 정리해요. “조금 더 저렴하게”, “검은색은 빼줘”처럼 이어서 말할 수도 있어요.",
      demo: <ConditionDemo />,
    },
    {
      eyebrow: "이유가 있는 추천",
      title: "왜 이 상품인지 함께 알려드려요",
      description:
        "상품만 나열하지 않아요. 요청하신 조건과 비교해 이 상품을 고른 이유를 함께 보여드려요. 여러 종류가 필요한 요청이면 카테고리별로 나눠 정리해요.",
      demo: <ReasonDemo />,
    },
    {
      eyebrow: "개인화 추천",
      title: "대화할수록 내 취향에 가까워져요",
      description:
        "대화와 쇼핑 맥락을 개인화 추천에 활용해요. 이미 산 것과 비슷한 상품이 반복해서 나오는 일도 줄어들어요.",
      bullets: [
        "AI가 이해한 취향을 마이페이지에서 직접 확인",
        "잘못 이해한 취향은 수정하거나 삭제",
        "개인화 기능은 언제든 끌 수 있어요",
      ],
      demo: <PreferenceDemo />,
    },
    {
      eyebrow: "추천에서 행동까지",
      title: "마음에 들었다면, 말 한마디로 담아보세요",
      description:
        "“두 번째 상품 담아줘”처럼 말하면 옵션을 확인한 뒤 장바구니에 담아드려요. 구매는 직접 확인하고 진행하시면 돼요.",
      demo: <CartActionDemo />,
    },
  ];

  return (
    <section id="features" className={cn(SECTION_Y, "scroll-mt-20")}>
      <div className={SHELL}>
        <Reveal>
          <SectionHead
            eyebrow="주요 기능"
            title="말하는 대로 좁혀지는 쇼핑"
            description="검색어를 만드는 일은 Narvis가 대신해요. 사용자는 원하는 것만 이야기하면 됩니다."
            align="center"
            className="mx-auto max-w-2xl"
          />
        </Reveal>

        <div className="mt-14 flex flex-col gap-20 sm:mt-16 sm:gap-24">
          {blocks.map((block, i) => (
            <Reveal key={block.eyebrow}>
              <div
                className={cn(
                  "grid items-center gap-8 lg:grid-cols-2 lg:gap-14",
                )}
              >
                {/* 텍스트. 모바일에서는 항상 먼저 오도록 order로 강제한다 —
                    lg 이상에서만 교차 배치가 의미를 갖는다 */}
                <div
                  className={cn(
                    "flex flex-col gap-5",
                    i % 2 === 1 && "lg:order-2",
                  )}
                >
                  <SectionHead
                    eyebrow={block.eyebrow}
                    title={block.title}
                    description={block.description}
                  />

                  {block.bullets && (
                    <ul className="flex flex-col gap-2.5">
                      {block.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-start gap-2.5 text-[15px] leading-relaxed"
                        >
                          <span
                            aria-hidden
                            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"
                          >
                            <Check className="size-3" />
                          </span>
                          <span className="text-muted-foreground">{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={cn(i % 2 === 1 && "lg:order-1")}>
                  {block.demo}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
