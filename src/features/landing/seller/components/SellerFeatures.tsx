"use client";

import { cn } from "@/lib/utils";
import { Reveal, SECTION_Y, SHELL, SectionHead } from "../../ui";
import { AskDataDemo } from "./AskDataDemo";
import { PerspectiveDemo } from "./PerspectiveDemo";
import { ReportDemo } from "./ReportDemo";
import { SafeEditDemo } from "./SafeEditDemo";

/**
 * 판매자 핵심 기능 4개. 소비자 탭과 같은 교차 배치 구조를 쓴다.
 *
 * 문구에 내부 기술 용어(멀티 에이전트·오케스트레이터·서브그래프·노드·상태 머신)를
 * 쓰지 않는다. 판매자에게 필요한 것은 "여러 관점으로 본다"는 사실이지 그것을
 * 구현한 방식이 아니다.
 */
export function SellerFeatures() {
  const blocks = [
    {
      eyebrow: "자연어 데이터 분석",
      title: "대시보드를 뒤지는 대신, 궁금한 것을 물어보세요",
      description:
        "매출 이상, 구매 전환, 고객 행동과 이탈, 리뷰, 비정상 활동까지 질문에 맞는 분석을 골라서 수행해요. 어떤 화면을 열어야 할지 몰라도 괜찮아요.",
      demo: <AskDataDemo />,
    },
    {
      eyebrow: "여러 관점의 분석",
      title: "한 가지 숫자가 아닌, 여러 관점으로 살펴봐요",
      description:
        "매출만 보면 원인을 놓치기 쉬워요. 전환·행동·리뷰를 함께 살펴보고 결과를 서로 맞춰본 뒤, 가능한 원인 후보를 정리해 드려요.",
      demo: <PerspectiveDemo />,
    },
    {
      eyebrow: "보고서와 개선안",
      title: "분석 결과를 다음 행동으로 연결해요",
      description:
        "핵심 요약, 주요 지표 변화, 발견된 문제, 가능한 원인, 권장 개선안 순으로 정리해요. 데이터로 확인된 사실과 AI가 정리한 해석은 화면에서 구분해 보여드려요.",
      demo: <ReportDemo />,
    },
    {
      eyebrow: "안전한 상품 수정",
      title: "변경은 제안하고, 결정은 판매자가 해요",
      description:
        "개선안을 상품 수정 초안으로 만들어 변경 전후를 보여드려요. 판매자가 확인한 뒤에만 실제 상품에 반영돼요.",
      demo: <SafeEditDemo />,
    },
  ];

  return (
    <section id="features" className={cn(SECTION_Y, "scroll-mt-20")}>
      <div className={SHELL}>
        <Reveal>
          <SectionHead
            eyebrow="주요 기능"
            title="묻고, 확인하고, 바꿉니다"
            description="데이터를 읽는 시간을 줄이고 판단에 필요한 것만 남겨요."
            align="center"
            className="mx-auto max-w-2xl"
          />
        </Reveal>

        <div className="mt-14 flex flex-col gap-20 sm:mt-16 sm:gap-24">
          {blocks.map((block, i) => (
            <Reveal key={block.eyebrow}>
              <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
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
