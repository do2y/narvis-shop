"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LandingTab } from "../types";
import { Reveal, SHELL } from "../ui";

/**
 * 반대편 탭으로 넘어가는 안내.
 *
 * 헤더의 탭과 중복처럼 보이지만 역할이 다르다 — 헤더 탭은 "지금 바꾸겠다"는
 * 사람을 위한 것이고, 이 블록은 **다 읽고 내려온 사람에게** 다른 대상의 서비스가
 * 있다는 사실을 알린다. 스크롤 끝에서 헤더로 눈을 되돌리지 않아도 되게 한다.
 *
 * 최종 CTA 바로 위에 둔다. 아래에 두면 "시작하기"를 누르려던 사람의 시선을
 * 마지막 순간에 다른 곳으로 돌린다.
 */
export function CrossLink({
  to,
  question,
  label,
  onNavigate,
}: {
  to: LandingTab;
  question: string;
  label: string;
  onNavigate: (tab: LandingTab) => void;
}) {
  return (
    <div className={cn(SHELL, "pb-4")}>
      <Reveal>
        <a
          href={`/?tab=${to}`}
          onClick={(e) => {
            // 수식키 클릭은 새 탭으로 여는 기본 동작을 유지한다
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            onNavigate(to);
            window.scrollTo({ top: 0, behavior: "auto" });
          }}
          className={cn(
            "group flex min-h-16 flex-col gap-2 rounded-xl border bg-muted/30 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-7",
            "transition-[background-color,border-color,transform,scale] duration-200 ease-out-strong",
            "hover:[@media(hover:hover)]:border-brand/30 hover:[@media(hover:hover)]:bg-brand/5",
            "active:scale-[0.995] motion-reduce:transition-[background-color,border-color] motion-reduce:active:scale-100",
          )}
        >
          <span className="text-[15px] font-medium text-muted-foreground sm:text-base">
            {question}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand sm:text-base">
            {label}
            {/* 화살표가 hover에서 조금 나아간다 — 이동을 예고하는 방향 힌트 */}
            <ArrowRight className="size-4 transition-transform duration-200 ease-out-strong group-hover:[@media(hover:hover)]:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </a>
      </Reveal>
    </div>
  );
}
