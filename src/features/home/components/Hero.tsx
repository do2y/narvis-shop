"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, SendHorizontal } from "lucide-react";
import { useTypingText } from "../hooks/useTypingText";

// 예시 질문 칩 — 클릭 시 해당 문장으로 채팅 시작
const EXAMPLE_CHIPS = [
  "시계 추천해줘",
  "5만원 이하 집들이 선물 추천해줘",
  "유럽 여행에 뭐 가져가야해?",
  "감자탕 재료 추천해줘",
];

// placeholder 예시 질문
const PLACEHOLDER_PHRASES = [
  "자취 시작템 추천해줘.",
  "유럽 여행 준비물 골라줘.",
  "10만원 안 상품 추천해줘.",
  "후기 좋은 샤워기 필터 찾아줘.",
];

export function Hero() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);

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

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  useEffect(() => {
    const section = sectionRef.current;
    const scene = sceneRef.current;
    if (!section || !scene || typeof window === "undefined") return;

    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let prefersReducedMotion = mediaQuery.matches;
    let rafId = 0;
    let lastProgress = -1;
    let lastSnapState = "";

    const setProgress = (progress: number) => {
      if (progress === lastProgress) return;
      scene.style.setProperty("--hero-scroll-progress", progress.toFixed(3));
      lastProgress = progress;
    };

    const setSnapState = (state: "active" | "inactive") => {
      if (state === lastSnapState) return;
      root.dataset.homeSnap = state;
      lastSnapState = state;
    };

    const syncScene = () => {
      rafId = 0;

      const sectionHeight = Math.max(section.offsetHeight, 1);
      const inputActive = isFocusedRef.current;
      const rawProgress = Math.min(
        Math.max(window.scrollY / Math.max(sectionHeight * 0.34, 1), 0),
        1,
      );
      const progress = prefersReducedMotion || inputActive ? 0 : rawProgress;
      // 히어로 전환이 진행 중인 동안에는 스냅을 끈다 — 켜두면 전환 도중
      // 스크롤이 되돌려져 모션이 중간에 걸린다. 히어로를 다 지난 뒤에야
      // 아래 섹션들끼리 스냅되게 한다
      const snapState =
        prefersReducedMotion || inputActive || window.scrollY < sectionHeight
          ? "inactive"
          : "active";

      setProgress(progress);
      setSnapState(snapState);
    };

    const requestSync = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(syncScene);
    };

    const handleMediaChange = (event: MediaQueryListEvent) => {
      prefersReducedMotion = event.matches;
      requestSync();
    };

    requestSync();

    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      mediaQuery.removeEventListener("change", handleMediaChange);
      scene.style.setProperty("--hero-scroll-progress", "0");
    };
  }, [isFocused]);

  // 이 섹션에는 snap-start 를 걸지 않는다 — 스크롤 전환이 진행되는 구간이라
  // 스냅이 히어로 시작점으로 되돌리면 모션이 중간에 걸린다. 스냅은 아래 카테고리부터다
  return (
    <section ref={sectionRef} className="relative overflow-hidden px-5 sm:px-6">
      <div
        ref={sceneRef}
        className="relative mx-auto w-full min-w-0 max-w-[24rem] text-center [--hero-scroll-progress:0] [--hero-scroll-shift:clamp(180px,30vh,360px)] [opacity:calc(1-var(--hero-scroll-progress)*0.85)] [transform:translate3d(0,calc(var(--hero-scroll-progress)*var(--hero-scroll-shift)*-1),0)] motion-reduce:[opacity:1] motion-reduce:[transform:none] sm:max-w-3xl"
      >
        {/* 배경 격자 — 가장자리는 radial mask 로 지워 가운데만 남긴다.
            안 지우면 선이 섹션 경계에서 잘려 "잘린 표" 처럼 보인다 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(150_165_200/0.13)_1px,transparent_1px),linear-gradient(90deg,rgb(150_165_200/0.13)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_62%_at_50%_46%,#000_0%,transparent_78%)]"
        />
        {/* 로고색 글로우 — 제목·검색바 뒤에 깔린다 */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-[42%] left-1/2 h-[460px] w-[900px] max-w-[145vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgb(169_196_245/0.5)_0%,rgb(169_220_182/0.32)_45%,rgb(246_225_151/0)_72%)] blur-[60px] animate-narvis-pulse motion-reduce:animate-none sm:top-[44%] sm:h-[420px] sm:max-w-[140vw]"
        />

        <div className="relative flex min-h-[calc(100svh-3.5rem)] flex-col justify-center pb-[calc(env(safe-area-inset-bottom)+4.75rem)] pt-8 sm:min-h-[calc(100svh-4rem)] sm:pb-28 sm:pt-12">
          <div className="w-full min-w-0 max-w-full translate-y-[clamp(-5rem,-8vh,-2rem)] sm:translate-y-[clamp(-2rem,-3vh,0rem)]">
            <div className="w-full min-w-0 max-w-full self-end">
              <p className="text-sm font-medium tracking-widest text-muted-foreground">
                AI SHOPPING AGENT
              </p>
              <h1 className="mx-auto mt-3 w-full max-w-full text-[clamp(1.34rem,7vw,2.9rem)] font-bold leading-[1.06] tracking-[-0.04em] sm:mt-4 sm:text-5xl sm:leading-tight sm:tracking-tight">
                <span className="block">원하는 걸 말하면</span>
                {/* 글자에 그라데이션을 클리핑 — color:transparent 라 배경이 글자 모양으로 보인다.
                    여기에 text-wordmark 같은 색 유틸리티를 fallback 으로 같이 두면 안 된다:
                    둘 다 color 를 쓰는 같은 레이어 유틸리티라 클래스 순서와 무관하게
                    단색이 이겨서 그라데이션이 통째로 가려진다 */}
                {/* 크기는 em 배율 — h1 의 4xl/5xl 을 따라가면서 이 단어만 비율로 커진다.
                    text-5xl 같은 고정 유틸리티를 쓰면 sm: 이상에서 h1 과 같은 크기가 돼 안 커진다 */}
                <span className="mt-1 block max-w-full whitespace-nowrap sm:mt-0">
                  <span className="mr-1.5 text-[1.15em] font-bold bg-[linear-gradient(96deg,#8FB4F2,#A6A8EE,#8FD3A6,#F0D274,#8FB4F2)] bg-[size:200%_100%] bg-clip-text text-transparent animate-narvis-flow motion-reduce:animate-none sm:mr-2">
                    Narvis
                  </span>
                  가 찾아드립니다
                </span>
              </h1>
            </div>

            {/* 그라데이션 테두리 — border-image 는 rounded-full 과 함께 못 쓴다.
                바깥 래퍼에 그라데이션을 깔고 p-0.5 만큼만 드러내 테두리처럼 보이게 한다 */}
            <div className="mt-10 w-full min-w-0 max-w-full justify-self-center rounded-full bg-[linear-gradient(96deg,#A9C4F5,#B9BCF2,#A9DCB6,#F6E197,#A9C4F5)] bg-[size:200%_100%] p-px shadow-[0_10px_28px_rgb(120_150_210/0.16)] animate-narvis-flow motion-reduce:animate-none sm:mt-15 sm:max-w-none sm:p-0.5 sm:shadow-[0_10px_34px_rgb(120_150_210/0.18)]">
              {/* 입력 내용을 첫 메시지로 채팅 화면에 전달 */}
              <form
                className="flex h-14 w-full min-w-0 max-w-full items-center gap-2.5 rounded-full bg-background pr-2.5 pl-4 sm:h-auto sm:gap-3.5 sm:py-3 sm:pr-3 sm:pl-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  startChat(message);
                }}
                aria-label="Narvis에게 요청하기"
              >
                <Search className="size-[18px] shrink-0 text-muted-foreground sm:size-5" />
                <input
                  value={message}
                  placeholder={isFocused ? "" : text}
                  onChange={(event) => setMessage(event.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="min-w-0 flex-1 overflow-hidden bg-transparent pl-1.5 text-[15px] leading-5 text-ellipsis whitespace-nowrap outline-none placeholder:text-muted-foreground sm:pl-2 sm:text-base sm:leading-6"
                />
                <button
                  type="submit"
                  aria-label="보내기"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8FB4F2,#8FD3A6_55%,#F0D274)] text-white transition-[transform,box-shadow] hover:scale-105 hover:shadow-[0_4px_16px_rgb(143_180_242/0.5)] active:scale-90 sm:size-10"
                >
                  <SendHorizontal className="size-[14px] sm:size-4" />
                </button>
              </form>
            </div>

            <div className="mt-4 w-full min-w-0 max-w-full self-start sm:mt-6">
              <div className="w-full min-w-0 max-w-full overflow-x-auto text-left [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:overflow-visible sm:text-center">
                <ul className="motion-safe:animate-home-chip-drift flex w-max min-w-max justify-start gap-2 sm:mx-auto sm:w-fit sm:min-w-0 sm:justify-center sm:animate-none sm:pr-0">
                  {EXAMPLE_CHIPS.map((chip) => (
                    <li key={chip} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => startChat(chip)}
                        className="h-9 shrink-0 whitespace-nowrap rounded-full border bg-background/70 px-3.5 text-sm text-muted-foreground backdrop-blur-sm transition hover:bg-muted hover:text-foreground active:scale-95 sm:h-auto sm:px-4 sm:py-2"
                      >
                        {chip}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <a
          href="#home-categories"
          aria-label="카테고리 섹션으로 이동"
          className="absolute bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-[11px] font-medium text-muted-foreground/75 transition-colors motion-reduce:transition-none hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wordmark/20 focus-visible:ring-offset-4 sm:bottom-8 sm:text-xs"
        >
          <span>아래로 스크롤</span>
          <ChevronDown className="size-4 animate-hero-scroll-cue motion-reduce:animate-none" />
        </a>
      </div>
    </section>
  );
}
