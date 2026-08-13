"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { hoverMuted, pressable } from "../interaction";
import { SELLER_SUGGESTED_QUESTIONS } from "../suggestedQuestions";

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
  //
  // 바깥 여백(py)은 그대로 두고 **안쪽 간격만** 벌린다. 제목-입력창-칩이 균일한
  // gap 으로 붙어 있으면 셋이 한 덩어리로 읽혀 무엇이 핵심 액션인지 알 수 없다.
  // gap 을 없애고 각 요소가 자기 위쪽 여백을 갖게 해 단계를 나눈다.
  return (
    // pt 를 pb 보다 크게 준다 — 위는 헤더(sticky)와의 간격이라 더 필요하고,
    // 아래는 이어지는 섹션의 border-t pt-8 이 이미 여백을 갖고 있다.
    <section className="flex flex-col pb-7 pt-10 sm:pb-9 sm:pt-14">
      {/* 큰 글자는 자간을 좁힌다 — 크기가 커질수록 글자 사이가 벌어져 보인다 */}
      <h1 className="text-center text-2xl font-bold tracking-tight sm:text-3xl sm:tracking-[-0.02em]">
        무엇을 도와드릴까요?
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(value);
        }}
        // mt-7: 제목과 입력창 사이를 벌려 "묻는 말"과 "입력하는 곳"을 갈라 놓는다
        className="mx-auto mt-7 flex w-full max-w-2xl items-center gap-2 rounded-full border bg-background px-4 py-2 shadow-sm transition-shadow duration-150 ease-out-strong focus-within:shadow-md focus-within:ring-1 focus-within:ring-brand/40"
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

      {/* 칩은 보조 액션이다 — 입력창과 같은 폭 안에 가두고(max-w-2xl) 위쪽 여백을
          입력창과의 간격으로 삼아 별도 단계로 읽히게 한다.
          모바일에서는 여러 줄로 빽빽하게 쌓이는 대신 한 줄로 두고 가로 스크롤한다
          (음수 마진으로 화면 끝까지 흘려 잘린 칩이 "더 있다"를 알린다).
          sm 이상에서는 줄바꿈 — 데스크톱은 대개 한 줄에 들어간다. */}
      {/* 바깥: 모바일에서 화면 끝까지 흘리려고 음수 마진을 쓰는데 그건 mx-auto 와
          같은 축이라 한 요소에 둘 다 걸 수 없다 — 정렬(바깥)과 스크롤(안쪽)을 나눈다.
          폭은 입력창(max-w-2xl)보다 넓게 둔다: 문구가 길어져 4개가 2xl 안에서는
          한 줄에 안 들어간다. 억지로 줄이는 대신 칩 줄만 넓혀 한 줄을 유지하고,
          그래도 부족하면 아래에서 자연스럽게 줄바꿈한다. */}
      <div className="mx-auto mt-4 w-full max-w-4xl">
        <div
          className={cn(
            "-mx-4 flex gap-1.5 overflow-x-auto px-4",
            "sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0",
          )}
        >
          {SELLER_SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => start(q)}
              className={cn(
                // 높이·글자·패딩을 한 단 내린다(py-2 → h-8, text-sm → text-xs).
                // radius 는 유지하되 높이를 줄여 통통해 보이지 않게 한다.
                "flex h-8 shrink-0 items-center rounded-full border px-3 text-xs",
                // whitespace-nowrap: 문구 길이가 제각각이라(9자~19자) 줄바꿈을 허용하면
                // 긴 칩만 2줄이 되어 혼자 높이가 달라진다. 한 줄로 고정하고 폭만 늘린다.
                "whitespace-nowrap",
                // 테두리·글자를 흐리게 — 눌러도 되는 보조 액션이라는 뜻만 남긴다
                "border-border/70 text-muted-foreground",
                pressable,
                hoverMuted,
                "hover:[@media(hover:hover)]:text-foreground",
              )}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
