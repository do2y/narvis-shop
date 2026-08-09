"use client";

import { cn } from "@/lib/utils";
import { useInView } from "./hooks/useInView";

/**
 * 랜딩 공통 조판 부품.
 *
 * 페이지 전용이라 `shared/ui`로 올리지 않는다(CLAUDE.md: 2개 이상 페이지가 쓸 때만 승격).
 * 두 탭이 같은 리듬으로 읽히려면 여백·글자 크기가 한 곳에서 정해져야 한다 —
 * 섹션마다 눈으로 맞추면 탭을 바꿀 때 리듬이 어긋난 게 바로 보인다.
 */

/** 콘텐츠 최대 폭 — 본문 가독 폭(약 1120px)에 맞춘다 */
export const SHELL = "mx-auto w-full max-w-6xl px-5 sm:px-8";

/**
 * 섹션 세로 여백.
 *
 * 토스식 "한 섹션 = 한 메시지"는 여백이 만든다. 좁으면 두 메시지가 한 덩어리로
 * 읽히고, 과하면 스크롤이 빈 화면만 지나간다. 모바일에서는 화면 자체가 짧아
 * 같은 값을 쓰면 허전해지므로 한 단 줄인다.
 */
export const SECTION_Y = "py-20 sm:py-28";

/**
 * 스크롤 진입 시 떠오르는 래퍼.
 *
 * transform·opacity만 쓴다(합성 단계에서 끝나 레이아웃을 다시 계산하지 않는다).
 * 이동 거리는 16px — 더 크면 시선이 따라가느라 글을 읽기 시작하는 시점이 늦고,
 * 더 작으면 등장이 인지되지 않아 그냥 깜빡인 것처럼 보인다.
 *
 * 모션 감소에서는 `motion-reduce:` 유틸리티가 transform을 지우고 opacity만 남긴다 —
 * 등장 사실은 전하되 이동은 없앤다(globals.css의 프로젝트 방침과 동일).
 */
export function Reveal({
  children,
  delayMs = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <Tag
      // as로 태그를 바꿔도 ref 타입은 HTMLElement 계열로 같다
      ref={ref as React.Ref<HTMLDivElement & HTMLLIElement>}
      style={{ transitionDelay: inView ? `${delayMs}ms` : "0ms" }}
      className={cn(
        "transition-[opacity,transform] duration-[600ms] ease-out-strong",
        "motion-reduce:transition-opacity motion-reduce:translate-y-0",
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * 섹션 머리 — eyebrow + 제목 + 설명.
 *
 * eyebrow를 제목 위 작은 글자로 두는 건 코들·토스가 공유하는 위계다. 제목만 있으면
 * "이 섹션이 무엇에 관한 것인지"를 제목 한 줄이 전부 떠안아 길어진다.
 *
 * 제목 자간이 음수인 이유: 글자가 커질수록 사이가 벌어져 보인다(apple-design §15).
 * 본문은 0 근처로 둔다 — 작은 글자에 음수 자간을 주면 뭉쳐서 읽기 어렵다.
 */
export function SectionHead({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow && (
        <span className="text-[13px] font-semibold tracking-tight text-brand">
          {eyebrow}
        </span>
      )}
      <h2 className="text-[1.75rem] font-bold leading-[1.25] tracking-[-0.025em] text-balance sm:text-[2.25rem] lg:text-[2.5rem]">
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "text-[15px] leading-relaxed text-muted-foreground sm:text-base",
            // 설명은 한 줄이 너무 길면 다음 줄 첫 글자를 찾기 어렵다 —
            // 폭을 제한해 45~75자 사이로 유지한다
            "max-w-[46ch]",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * 데모를 감싸는 "제품 화면" 틀.
 *
 * 실제 서비스 UI를 랜딩에 얹으면 배경과 경계가 없어 본문 카드처럼 읽힌다.
 * 얕은 그림자 + 밝은 테두리로 한 겹 띄워 "이건 화면 안의 화면"임을 알린다.
 *
 * ⚠️ 데모는 장식이 아니라 설명이지만, 스크린리더에는 같은 내용이 본문 텍스트로
 * 이미 있다. 중복해 읽히지 않게 호출부에서 `aria-hidden`을 건다(§접근성).
 */
export function DemoFrame({
  children,
  className,
  /** 되감는 중 페이드 — useDemoSequence의 resetting을 그대로 넘긴다 */
  dimmed = false,
}: {
  children: React.ReactNode;
  className?: string;
  dimmed?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-background",
        "shadow-[0_1px_2px_rgb(16_24_40/0.04),0_12px_32px_-8px_rgb(16_24_40/0.10)]",
        "transition-opacity duration-300 ease-out-strong",
        dimmed && "opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * 데모 창의 상단 바 — 제목 한 줄.
 *
 * 신호등 점(macOS 창 흉내)은 쓰지 않는다. 이건 웹 서비스지 데스크톱 앱이 아니고,
 * 점 3개는 정보 없이 자리만 차지한다. 대신 지금 무슨 화면인지를 글자로 적는다.
 */
export function DemoBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-muted/40 px-4">
      <span className="text-xs font-semibold text-muted-foreground">
        {children}
      </span>
    </div>
  );
}
