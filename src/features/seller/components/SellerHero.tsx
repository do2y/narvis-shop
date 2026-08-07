"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { hoverMuted, pressable } from "../interaction";

const QUESTIONS = [
  "이번주 판매 전략 알려줘",
  "전환율 낮은 상품 진단해줘",
  "베스트셀러 상세정보 개선안",
  "재고 부족 상품 정리해줘",
];

/** 대시보드 상단 챗봇 진입 히어로 — 입력·칩 모두 /seller/chat?q= 로 첫 메시지 전달(홈과 동일 패턴) */
export function SellerHero() {
  const [value, setValue] = useState("");
  const router = useRouter();

  const start = (q: string) => {
    const trimmed = q.trim();
    if (trimmed) router.push(`/seller/chat?q=${encodeURIComponent(trimmed)}`);
  };

  // 세로 여백을 줄였다(py-10/14 → py-7/9). 업무 화면의 첫 스크롤에는
  // AI 진입보다 "오늘 할 일"이 들어와야 한다 — 히어로는 유지하되 자리만 양보한다.
  return (
    <section className="flex flex-col gap-5 py-7 sm:py-9">
      {/* 큰 글자는 자간을 좁힌다 — 크기가 커질수록 글자 사이가 벌어져 보인다 */}
      <h1 className="text-center text-2xl font-bold tracking-tight sm:text-3xl sm:tracking-[-0.02em]">
        무엇을 도와드릴까요?
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(value);
        }}
        className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-full border bg-background px-4 py-2 shadow-sm transition-shadow duration-150 ease-out-strong focus-within:shadow-md focus-within:ring-1 focus-within:ring-brand/40"
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="상품 상세정보 수정, 판매 전략 등 무엇이든 물어보세요."
          aria-label="AI 어시스턴트에게 질문"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="전송"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground",
            pressable,
            "hover:[@media(hover:hover)]:opacity-90",
            "disabled:scale-100 disabled:opacity-40",
          )}
        >
          <ArrowUp className="size-4" />
        </button>
      </form>

      <div className="flex flex-wrap justify-center gap-2">
        {QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => start(q)}
            className={cn(
              "rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground",
              pressable,
              hoverMuted,
              "hover:[@media(hover:hover)]:text-foreground",
            )}
          >
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}
