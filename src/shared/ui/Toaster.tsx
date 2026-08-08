"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * 전역 토스트.
 *
 * 카드 안 인라인 문구를 대체한다 — 문구를 카드에 넣으면 그 카드만 세로로 늘어나
 * 그리드에서 옆 카드와 높이가 어긋나고, 사라질 때 또 한 번 튄다.
 *
 * sonner 기본 스타일 대신 토큰(bg-background·border·text-foreground)으로 덮는다.
 * 이 프로젝트는 임의 색상을 쓰지 않고 tailwind 테마 값만 쓴다(CLAUDE.md).
 *
 * 위치를 하단 중앙으로 둔 이유: 상단은 AppHeader 와 겹치고, 챗 화면에서는
 * 우측 상단에 상품 카드의 찜 버튼이 있어 방금 누른 곳을 토스트가 가린다.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      // 기본 4초는 한 줄 안내로는 길다. 읽고 넘기기 충분한 정도만.
      duration={2500}
      // 모바일에서 화면 가장자리에 붙지 않게(CLAUDE.md 반응형 규칙)
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-full !border !bg-background !text-foreground !shadow-md !text-sm !px-4 !py-3",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-full",
          error: "!text-destructive",
        },
      }}
    />
  );
}
