"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SendHorizontal } from "lucide-react";
import { useTypingText } from "../hooks/useTypingText";

// 예시 질문 칩 — 클릭 시 해당 문장으로 채팅 시작
const EXAMPLE_CHIPS = [
  "자취 시작템 추천",
  "유럽 여행 준비물",
  "2만원 이하 선물",
  "집들이 선물 추천",
  "무선 키보드 추천",
];

// placeholder 예시 질문
const PLACEHOLDER_PHRASES = [
  "자취 시작하는데 필요한 물건 알려줘.",
  "유럽여행 준비물 한 번에 골라줘.",
  "10만원 안에서 필요한 상품 추천해줘.",
  "후기 좋은 샤워기 필터 찾아줘.",
];

export function Hero() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const { text } = useTypingText(PLACEHOLDER_PHRASES, {
    typingMs: 70,
    deletingMs: 35,
    holdMs: 1800,
    paused: isFocused || message.length > 0,
  });

  // 입력 내용을 첫 메시지로 채팅 화면에 전달
  const startChat = (message: string) => {
    const q = message.trim();
    if (q) router.push(`/chat?q=${encodeURIComponent(q)}`);
  };

  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-36 sm:pt-28 sm:pb-44">
      {/* 배경 격자 — 가장자리는 radial mask 로 지워 가운데만 남긴다.
          안 지우면 선이 섹션 경계에서 잘려 "잘린 표" 처럼 보인다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(150_165_200/0.13)_1px,transparent_1px),linear-gradient(90deg,rgb(150_165_200/0.13)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_62%_at_50%_46%,#000_0%,transparent_78%)]"
      />
      {/* 로고색 글로우 — 제목·검색바 뒤에 깔린다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[110px] left-1/2 h-[420px] w-[900px] max-w-[140vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgb(169_196_245/0.5)_0%,rgb(169_220_182/0.32)_45%,rgb(246_225_151/0)_72%)] blur-[60px] animate-narvis-pulse motion-reduce:animate-none"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium tracking-widest text-muted-foreground">
          AI SHOPPING AGENT
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          원하는 걸 말하면
          <br />
          {/* 글자에 그라데이션을 클리핑 — color:transparent 라 배경이 글자 모양으로 보인다.
              여기에 text-wordmark 같은 색 유틸리티를 fallback 으로 같이 두면 안 된다:
              둘 다 color 를 쓰는 같은 레이어 유틸리티라 클래스 순서와 무관하게
              단색이 이겨서 그라데이션이 통째로 가려진다 */}
          {/* 크기는 em 배율 — h1 의 4xl/5xl 을 따라가면서 이 단어만 비율로 커진다.
              text-5xl 같은 고정 유틸리티를 쓰면 sm: 이상에서 h1 과 같은 크기가 돼 안 커진다 */}
          <span className="mr-2 text-[1.15em] font-bold bg-[linear-gradient(96deg,#8FB4F2,#A6A8EE,#8FD3A6,#F0D274,#8FB4F2)] bg-[size:200%_100%] bg-clip-text text-transparent animate-narvis-flow motion-reduce:animate-none">
            Narvis
          </span>
          가 찾아드립니다
        </h1>

        {/* 그라데이션 테두리 — border-image 는 rounded-full 과 함께 못 쓴다.
            바깥 래퍼에 그라데이션을 깔고 p-0.5 만큼만 드러내 테두리처럼 보이게 한다 */}
        <div className="mt-12 rounded-full bg-[linear-gradient(96deg,#A9C4F5,#B9BCF2,#A9DCB6,#F6E197,#A9C4F5)] bg-[size:200%_100%] p-0.5 shadow-[0_10px_34px_rgb(120_150_210/0.18)] animate-narvis-flow motion-reduce:animate-none sm:mt-15">
          {/* 입력 내용을 첫 메시지로 채팅 화면에 전달 */}
          <form
            className="flex items-center gap-3 rounded-full bg-background py-3 pr-3 pl-5 sm:gap-3.5 sm:pl-6"
            onSubmit={(e) => {
              e.preventDefault();
              startChat(message);
            }}
            aria-label="Narvis에게 요청하기"
          >
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <input
              value={message}
              placeholder={isFocused ? "" : text}
              onChange={(event) => setMessage(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="min-w-0 flex-1 bg-transparent text-base leading-6 outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label="보내기"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8FB4F2,#8FD3A6_55%,#F0D274)] text-white transition-[transform,box-shadow] hover:scale-105 hover:shadow-[0_4px_16px_rgb(143_180_242/0.5)] active:scale-90"
            >
              <SendHorizontal className="size-4" />
            </button>
          </form>
        </div>

        <ul className="mt-6 flex flex-wrap justify-center gap-2.5">
          {EXAMPLE_CHIPS.map((chip) => (
            <li key={chip}>
              <button
                type="button"
                onClick={() => startChat(chip)}
                className="rounded-full border bg-background/70 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm transition hover:bg-muted hover:text-foreground active:scale-95"
              >
                {chip}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
