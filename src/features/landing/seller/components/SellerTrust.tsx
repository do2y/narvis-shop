"use client";

import { cn } from "@/lib/utils";
import { Reveal, SECTION_Y, SHELL, SectionHead } from "../../ui";

/**
 * 서비스 원칙 — 차분하게.
 *
 * **보안 인증 배지·정확성 보장 표현을 쓰지 않는다**(요구사항). 받은 적 없는 인증
 * 로고를 붙이거나 "완벽하게 보호"라고 적으면 그 순간 이 화면 전체가 거짓이 된다.
 * 여기 적힌 넷은 전부 코드에 실제로 구현된 동작이다:
 *  - 판매자 권한 확인 → `RequireRole role="SELLER"` (app/seller/layout.tsx)
 *  - 분석 범위 구분 → 질문 범위 확인 단계
 *  - 최종 확인 후 적용 → 초안 confirm(HITL, ProductDiffCard)
 *  - 진행 상황 표시 → 분석 진행 단계 표시
 *
 * 아이콘을 붙이지 않는다. 네 항목 모두 "약속"이라 성격이 같은데 서로 다른 아이콘을
 * 달면 각기 다른 기능처럼 보이고, 같은 아이콘을 달면 아무 정보도 더하지 않는다.
 * 번호만으로 충분하다.
 */

const PRINCIPLES = [
  {
    title: "판매자 권한이 확인된 사용자만 접근해요",
    body: "판매자 계정으로 로그인한 경우에만 분석 기능을 이용할 수 있어요.",
  },
  {
    title: "분석 범위를 벗어난 요청은 미리 구분해요",
    body: "질문을 받으면 무엇을 분석할지 범위를 먼저 확인해 드려요.",
  },
  {
    title: "상품 변경은 판매자의 최종 확인 후 적용돼요",
    body: "수정 초안과 변경 전후를 보고 직접 확인한 뒤에만 반영됩니다.",
  },
  {
    title: "분석 진행 상황을 확인할 수 있어요",
    body: "어느 단계까지 진행됐는지 화면에서 볼 수 있어요.",
  },
] as const;

export function SellerTrust() {
  return (
    <section className={cn(SECTION_Y, "bg-muted/25")}>
      <div className={SHELL}>
        <Reveal>
          <SectionHead
            eyebrow="서비스 원칙"
            title="판매자의 결정을 대신하지 않아요"
            description="분석은 돕되, 무엇을 바꿀지는 판매자가 정합니다."
            align="center"
            className="mx-auto max-w-2xl"
          />
        </Reveal>

        <ul className="mt-12 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {PRINCIPLES.map((p, i) => (
            <Reveal as="li" key={p.title} delayMs={i * 60}>
              <div className="flex h-full flex-col gap-2 rounded-sm border bg-background p-5 sm:p-6">
                <span className="text-[11px] font-bold tabular-nums text-brand">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[15px] font-bold leading-snug tracking-tight">
                  {p.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
                  {p.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
