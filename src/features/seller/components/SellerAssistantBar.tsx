"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { hoverMuted, pressable } from "../interaction";

/**
 * 자주 쓰는 작업 — 문장형 질문이 아니라 "무엇을 시킬지"로 짧게 둔다.
 * 칩이 길면 읽는 데 시간이 들어 버튼이 아니라 안내문처럼 보인다.
 */
const QUICK_TASKS = [
  { label: "매출 분석", q: "이번 주 매출 분석해줘" },
  { label: "재고 점검", q: "재고 부족 상품 정리해줘" },
  { label: "상품 등록", q: "새 상품을 등록하고 싶어" },
  { label: "가격 조정", q: "전환율 낮은 상품 가격 진단해줘" },
];

/**
 * 대시보드 상단 AI 진입 — 한 줄짜리 명령 입력.
 *
 * 종전에는 "무엇을 도와드릴까요?" 큰 제목 + 중앙 정렬 입력창이라 챗봇 랜딩처럼 보였고,
 * 업무 화면의 첫 화면을 AI 가 차지했다. 여기서는 도구 하나로 줄인다 —
 * 판매자가 매일 보는 화면의 주인공은 오늘의 숫자이지 AI 가 아니다.
 */
export function SellerAssistantBar() {
  const [value, setValue] = useState("");
  const router = useRouter();

  const start = (q: string) => {
    const trimmed = q.trim();
    if (trimmed) router.push(`/seller/chat?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <section
      aria-labelledby="assistant-heading"
      className="flex flex-col gap-3 rounded-sm border bg-muted/30 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <h2 id="assistant-heading" className="text-sm font-semibold">
            AI 판매 도우미
          </h2>
          <span className="text-xs text-muted-foreground">
            분석·상품 수정을 대화로 처리해요
          </span>
        </div>
        {/* 전체 화면 진입 — 긴 대화나 이미지 등록은 여기서 한다 */}
        <Link
          href="/seller/chat"
          className={cn(
            "flex items-center gap-1 whitespace-nowrap text-xs font-medium text-muted-foreground",
            "transition-colors duration-150 ease-out-strong",
            "hover:[@media(hover:hover)]:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          에이전트 열기
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* 검색창처럼 보이게 — 채팅 버블이 아니라 명령 입력이라는 인상 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(value);
        }}
        className={cn(
          "flex items-center gap-2 rounded-sm border bg-background px-3",
          "transition-shadow duration-150 ease-out-strong",
          "focus-within:ring-1 focus-within:ring-ring",
        )}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="무엇이든 물어보세요"
          aria-label="AI 판매 도우미에게 질문"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="전송"
          className={cn(
            // 브랜드색은 이 버튼 하나에만 — 화면에서 AI 를 가리키는 유일한 표식이다
            "flex size-7 shrink-0 items-center justify-center rounded-sm bg-brand text-brand-foreground",
            pressable,
            "hover:[@media(hover:hover)]:opacity-90",
            "disabled:scale-100 disabled:opacity-30",
          )}
        >
          <ArrowUp className="size-4" />
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_TASKS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => start(t.q)}
            className={cn(
              "rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground",
              pressable,
              hoverMuted,
              "hover:[@media(hover:hover)]:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}
