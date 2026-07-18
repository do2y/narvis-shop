import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp } from "lucide-react";

const QUESTIONS = [
  "이번주 판매 전략 알려줘",
  "전환율 낮은 상품 진단해줘",
  "베스트셀러 상세정보 개선안",
  "재고 부족 상품 정리해줘",
];

/** 대시보드 상단 챗봇 진입 히어로 — 입력·칩 모두 /seller/chat?q= 로 첫 메시지 전달(홈과 동일 패턴) */
export function SellerHero() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  const start = (q: string) => {
    const trimmed = q.trim();
    if (trimmed) navigate(`/seller/chat?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <section className="flex flex-col gap-6 py-10 sm:py-14">
      <h1 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
        무엇을 도와드릴까요?
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(value);
        }}
        className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-full border bg-background px-4 py-2 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-brand/40"
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
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-all hover:opacity-90 active:scale-90 disabled:scale-100 disabled:opacity-40"
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
            className="rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
          >
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}
