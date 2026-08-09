"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuyerCtaHref } from "../../cta";
import { useInView } from "../../hooks/useInView";
import { SHELL } from "../../ui";
import { BUYER_SCENARIOS } from "../scenarios";
import { BuyerChatDemo } from "./BuyerChatDemo";

/**
 * 소비자 랜딩 히어로 — 카피(좌) + 데모(우) 2열.
 *
 * 데모를 오른쪽에 두는 이유: 한국어는 왼쪽에서 읽기 시작하므로 카피가 먼저 잡히고,
 * 그 주장을 오른쪽 화면이 곧바로 증명하는 순서가 된다. 모바일에서는 카피 → 데모로
 * 세로로 쌓여 같은 순서가 유지된다.
 */
export function BuyerHero() {
  const [index, setIndex] = useState(0);
  const ctaHref = useBuyerCtaHref();
  const scenario = BUYER_SCENARIOS[index];

  // 히어로는 첫 화면이라 대개 보이지만, 아래에서 스크롤해 올라온 경우까지
  // 재생을 보장하려면 관찰이 필요하다.
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.05 });

  return (
    <section className="relative overflow-hidden pb-16 pt-10 sm:pb-24 sm:pt-16">
      {/* 배경 글로우 — 로고색을 아주 옅게. 홈 히어로와 같은 어휘를 쓰되
          랜딩은 읽을 글이 많아 더 낮춘다(글자 뒤가 어수선하면 대비가 떨어진다).
          모션 감소에서는 맥박을 멈춘다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-[380px] w-[880px] max-w-[150vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgb(169_196_245/0.28)_0%,rgb(169_220_182/0.20)_46%,rgb(246_225_151/0)_72%)] blur-[70px] animate-narvis-pulse motion-reduce:animate-none"
      />

      <div
        ref={ref}
        className={cn(SHELL, "relative grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12")}
      >
        {/* ── 좌: 카피 ── */}
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center rounded-full border bg-background/70 px-3.5 py-1.5 text-[13px] font-medium text-brand backdrop-blur-sm">
            대화로 시작하는 AI 쇼핑
          </span>

          {/* 페이지에 하나뿐인 h1. 큰 글자라 자간을 좁히고 행간도 붙인다 */}
          <h1 className="text-[2.125rem] font-bold leading-[1.2] tracking-[-0.03em] text-balance sm:text-[3rem] lg:text-[3.25rem]">
            찾는 것부터 담는 것까지,
            <br />
            대화로 끝내는 쇼핑
          </h1>

          <p className="max-w-[44ch] text-[15px] leading-relaxed text-muted-foreground sm:text-lg">
            원하는 상황과 취향을 평소처럼 말해보세요. Narvis가 조건을 이해하고,
            이유와 함께 상품을 추천해 드려요.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={ctaHref}
              className={cn(
                "inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-brand px-6 text-[15px] font-semibold text-brand-foreground",
                "transition-[transform,scale,opacity] duration-150 ease-out-strong active:scale-[0.97]",
                "hover:[@media(hover:hover)]:opacity-90",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
              )}
            >
              AI 쇼핑 시작하기
              <ArrowRight className="size-4" />
            </Link>

            {/* 핵심 기능 섹션으로 부드럽게 스크롤.
                JS scrollIntoView 대신 앵커를 쓴다 — globals.css의 모션 감소 규칙이
                `scroll-behavior: auto`로 덮어주므로 설정 대응이 공짜로 따라온다.
                (html에 scroll-behavior: smooth를 여기서 켠다) */}
            <a
              href="#features"
              className={cn(
                "inline-flex h-12 items-center justify-center rounded-full border bg-background px-6 text-[15px] font-medium",
                "transition-[transform,scale,background-color] duration-150 ease-out-strong active:scale-[0.97]",
                "hover:[@media(hover:hover)]:bg-muted",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
              )}
            >
              추천 방식 살펴보기
            </a>
          </div>

          {/* 예시 질문 — 고르면 데모가 그 시나리오로 바뀐다.
              button + aria-pressed: 페이지 이동이 아니라 옆 데모의 상태를 바꾸는
              조작이라 링크가 아니다. 키보드로는 Tab → Enter/Space로 동작한다 */}
          <div className="flex w-full flex-col gap-2.5">
            <span className="text-xs font-medium text-muted-foreground">
              이렇게 물어보세요
            </span>
            <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {BUYER_SCENARIOS.map((s, i) => {
                const active = i === index;
                return (
                  <li key={s.question}>
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-pressed={active}
                      className={cn(
                        "flex min-h-11 w-full items-center rounded-full border px-4 py-2.5 text-left text-[13px] leading-snug",
                        "transition-[transform,scale,background-color,border-color,color] duration-150 ease-out-strong active:scale-[0.98]",
                        "motion-reduce:transition-[background-color,border-color,color] motion-reduce:active:scale-100",
                        active
                          ? // 선택 상태를 색만으로 구분하지 않는다 — 테두리와 굵기도 함께 바뀐다
                            "border-brand bg-brand/10 font-semibold text-brand"
                          : "bg-background text-muted-foreground hover:[@media(hover:hover)]:bg-muted hover:[@media(hover:hover)]:text-foreground",
                      )}
                    >
                      {s.question}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* ── 우: 데모 ──
            aria-hidden: 왼쪽 카피와 아래 기능 섹션이 같은 내용을 글로 이미 말한다.
            타이핑 중인 글자가 한 자씩 읽히는 것도 막는다.
            key: 시나리오가 바뀌면 컴포넌트를 다시 마운트해 이전 타이머·장면을
            깨끗이 버린다(요구사항: 기존 애니메이션 정리 후 새 시나리오 실행). */}
        <div
          aria-hidden
          className="h-[440px] sm:h-[500px] lg:h-[540px]"
        >
          <BuyerChatDemo
            key={scenario.question}
            scenario={scenario}
            active={inView}
          />
        </div>
      </div>
    </section>
  );
}
