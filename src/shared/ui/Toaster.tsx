"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * 전역 토스트.
 *
 * 카드 안 인라인 문구를 대체한다 — 문구를 카드에 넣으면 그 카드만 세로로 늘어나
 * 그리드에서 옆 카드와 높이가 어긋나고, 사라질 때 또 한 번 튄다.
 *
 * 디자인은 apple-design 스킬을 따랐다:
 *
 * §12 재질·깊이 — 토스트는 콘텐츠 위에 잠깐 떠 있는 기능 레이어다. 불투명 알약으로
 *   두면 화면을 덮는 판때기가 되지만, 반투명 + backdrop-blur 로 두면 아래 내용이
 *   비쳐 "위에 얹혀 있다"가 형태로 읽힌다. 작은 표면이라 블러는 얕게(12px),
 *   그림자도 과하지 않게 준다("큰 표면일수록 두껍게" 의 역).
 *   테두리 윗변을 밝게 줘 빛을 받는 재질처럼 보이게 한다.
 *
 * §12 vibrancy — 반투명 위의 글자는 흐린 회색을 쓰지 않는다. 배경이 계속 바뀌므로
 *   본문은 text-foreground(고대비)에 font-medium 으로 무게를 살짝 얹는다.
 *
 * §15 타이포 — tracking 은 크기별로 다르게. 작은 UI 텍스트라 살짝 양수(tracking-wide
 *   대신 미세하게)로 두어 흐린 배경 위 가독성을 확보한다.
 *
 * §14 접근성 — 투명도·대비 설정을 존중한다. prefers-reduced-transparency 에서는
 *   블러를 끄고 불투명하게, prefers-contrast: more 에서는 테두리를 진하게 세운다.
 *   (모션은 sonner 가 prefers-reduced-motion 을 자체 처리한다)
 *
 * 위치는 상단 중앙. 헤더와 겹치지 않게 그 높이(64px)만큼 내려서 띄운다 —
 * 반투명끼리 포개지면 둘 다 읽기 어려워진다(§12).
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      // 기본 4초는 한 줄 안내로는 길다. 읽고 넘기기 충분한 정도만.
      duration={2500}
      // AppHeader 가 sticky top-0 에 h-16(64px)이라 그 아래로 내린다 —
      // 겹치면 반투명끼리 포개져 둘 다 읽기 어려워진다(§12: 밝은 반투명을
      // 다른 반투명 위에 쌓지 않는다). 가장자리 여백 16px 을 더해 80px.
      offset={80}
      // 모바일은 헤더가 화면을 더 많이 차지해 같은 값이면 답답하다.
      mobileOffset={72}
      // 같은 동작을 연달아 하면 알림이 쌓여 화면을 가린다. 최신 것만 남긴다
      // (§16 단순함 — 모든 것을 다 보여주는 게 친절한 게 아니다).
      visibleToasts={2}
      toastOptions={{
        classNames: {
          toast: [
            // 재질: 반투명 + 얕은 블러. saturate 로 뒤 색이 탁해지지 않게 한다.
            "!bg-background/75 !backdrop-blur-md !backdrop-saturate-150",
            // 빛을 받는 윗변 — 아래보다 밝아 판이 아니라 표면으로 읽힌다.
            "!border !border-black/[0.06] !border-t-white/60",
            // 작은 표면이라 그림자는 얕게. 떠 있다는 것만 전달하면 된다.
            "!shadow-lg !shadow-black/5",
            // 알약 형태 — CLAUDE.md radius 규칙(버튼·칩은 rounded-full)
            "!rounded-full !px-4 !py-3",
            // vibrancy: 흐린 회색 대신 고대비 + 살짝 무게. tracking 은 미세하게 양수.
            "!text-sm !font-medium !tracking-[0.01em] !text-foreground",
            "!gap-2.5",
            // 투명도를 낮춘 사용자에게는 불투명하게(§14)
            "[@media(prefers-reduced-transparency:reduce)]:!bg-background",
            "[@media(prefers-reduced-transparency:reduce)]:!backdrop-blur-none",
            // 고대비 설정에서는 테두리를 세운다(§14)
            "[@media(prefers-contrast:more)]:!border-foreground/40",
          ].join(" "),
          // 보조 설명은 한 단계 낮추되, 반투명 위라 너무 흐리지 않게 유지.
          description: "!text-muted-foreground !font-normal",
          // 색은 불투명 레이어에 얹는다(§12: 반투명 전경에 색을 칠하지 않는다).
          actionButton:
            "!rounded-full !bg-primary !text-primary-foreground !font-medium",
          cancelButton: "!rounded-full !bg-muted !text-muted-foreground",
          // 성공/실패는 아이콘 색으로만 가른다 — 배경까지 물들이면 재질이 깨지고,
          // 실패가 성공보다 시끄러워야 할 이유도 없다(§16 절제).
          // sonner 아이콘은 currentColor SVG 라 색만 바꾸면 된다.
          success: "[&_[data-icon]]:!text-muted-foreground",
          error: "[&_[data-icon]]:!text-destructive",
        },
      }}
    />
  );
}
