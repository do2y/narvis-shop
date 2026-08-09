"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSellerCta } from "../../cta";
import { useInView } from "../../hooks/useInView";
import { SHELL } from "../../ui";
import { SELLER_SCENARIOS } from "../scenarios";
import { SellerAnalysisDemo } from "./SellerAnalysisDemo";

/**
 * 판매자 랜딩 히어로.
 *
 * 소비자 히어로와 같은 골격(카피 좌 · 데모 우 · 예시 질문)을 쓴다. 두 탭이 한
 * 서비스로 읽히려면 구조가 같아야 한다 — 대상이 다르다고 레이아웃까지 바꾸면
 * 탭을 오갈 때 다른 사이트처럼 느껴진다. 달라지는 것은 내용과 데모다.
 */
export function SellerHero() {
  const [index, setIndex] = useState(0);
  const cta = useSellerCta();
  const scenario = SELLER_SCENARIOS[index];
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.05 });

  return (
    <section className="relative overflow-hidden pb-16 pt-10 sm:pb-24 sm:pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-[380px] w-[880px] max-w-[150vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgb(169_220_182/0.26)_0%,rgb(169_196_245/0.18)_46%,rgb(246_225_151/0)_72%)] blur-[70px] animate-narvis-pulse motion-reduce:animate-none"
      />

      <div
        ref={ref}
        className={cn(SHELL, "relative grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12")}
      >
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center rounded-full border bg-background/70 px-3.5 py-1.5 text-[13px] font-medium text-brand backdrop-blur-sm">
            판매자를 위한 AI 비즈니스 파트너
          </span>

          <h1 className="text-[2.125rem] font-bold leading-[1.2] tracking-[-0.03em] text-balance sm:text-[3rem] lg:text-[3.25rem]">
            데이터를 묻고,
            <br />
            다음 행동을 발견하세요
          </h1>

          <p className="max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground sm:text-lg">
            궁금한 내용을 자연어로 물어보세요. Narvis가 판매 데이터를 여러
            관점으로 분석하고 보고서와 개선안을 정리해 드려요.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={cta.href}
              className={cn(
                "inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-brand px-6 text-[15px] font-semibold text-brand-foreground",
                "transition-[transform,scale,opacity] duration-150 ease-out-strong active:scale-[0.97]",
                "hover:[@media(hover:hover)]:opacity-90",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
              )}
            >
              판매자 AI 시작하기
              <ArrowRight className="size-4" />
            </Link>

            <a
              href="#features"
              className={cn(
                "inline-flex h-12 items-center justify-center rounded-full border bg-background px-6 text-[15px] font-medium",
                "transition-[transform,scale,background-color] duration-150 ease-out-strong active:scale-[0.97]",
                "hover:[@media(hover:hover)]:bg-muted",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
              )}
            >
              분석 기능 살펴보기
            </a>
          </div>

          {/* 판매자 계정이 아닐 때만 이유를 밝힌다.
              버튼을 막지 않고 안내만 두는 이유: 로그인 화면으로 가는 것 자체는
              막다른 길이 아니고, 계정을 바꿔 로그인하면 그대로 이어진다 */}
          {cta.notice && (
            <p className="text-[13px] text-muted-foreground">{cta.notice}</p>
          )}

          <div className="flex w-full flex-col gap-2.5">
            <span className="text-xs font-medium text-muted-foreground">
              이렇게 물어보세요
            </span>
            <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {SELLER_SCENARIOS.map((s, i) => {
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
                          ? "border-brand bg-brand/10 font-semibold text-brand"
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

        {/* key: 시나리오를 바꾸면 재마운트해 이전 타이머·장면을 버린다 */}
        <div aria-hidden className="h-[480px] sm:h-[540px] lg:h-[580px]">
          <SellerAnalysisDemo
            key={scenario.question}
            scenario={scenario}
            active={inView}
          />
        </div>
      </div>
    </section>
  );
}
