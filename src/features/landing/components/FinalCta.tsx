"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, SECTION_Y, SHELL } from "../ui";

/**
 * 마지막 CTA — 두 탭이 같은 껍데기를 쓰고 문구·목적지만 받는다.
 *
 * 배경을 거의 두지 않는다. 랜딩 끝의 큰 색면은 흔하지만 이 서비스의 인상은
 * "밝고 정돈된 화면"이라, 마지막에 와서 색이 바뀌면 다른 사이트처럼 읽힌다.
 * 대신 여백을 크게 주고 문장 하나만 남겨 시선이 버튼으로 모이게 한다.
 */
export function FinalCta({
  headline,
  ctaLabel,
  ctaHref,
  /** 역할이 맞지 않을 때의 안내(판매자 탭에서 일반 회원인 경우). 없으면 그리지 않는다 */
  notice,
}: {
  headline: React.ReactNode;
  ctaLabel: string;
  ctaHref: string;
  notice?: string | null;
}) {
  return (
    <section className={cn(SECTION_Y, "border-t")}>
      <div className={cn(SHELL, "flex flex-col items-center gap-8 text-center")}>
        <Reveal>
          <h2 className="text-[1.75rem] font-bold leading-[1.3] tracking-[-0.025em] text-balance sm:text-[2.25rem]">
            {headline}
          </h2>
        </Reveal>

        <Reveal delayMs={80} className="flex flex-col items-center gap-3">
          <Link
            href={ctaHref}
            className={cn(
              "inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-brand px-7 text-[15px] font-semibold text-brand-foreground",
              "transition-[transform,scale,opacity] duration-150 ease-out-strong active:scale-[0.97]",
              "hover:[@media(hover:hover)]:opacity-90",
              "motion-reduce:transition-none motion-reduce:active:scale-100",
            )}
          >
            {ctaLabel}
            <ArrowRight className="size-4" />
          </Link>

          {notice && (
            <p className="text-[13px] text-muted-foreground">{notice}</p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
