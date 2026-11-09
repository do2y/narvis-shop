"use client";

import { cn } from "@/lib/utils";
import { hoverMuted, pressable } from "../interaction";

/**
 * 남은 초안 결과로 돌아가는 버튼(채팅 칸·목록 상단 공용).
 * 특정 초안이 아니라 결과 패널 전체를 연다 — 개수는 그 패널이 그리는 초안 카드 수다.
 */
export function DraftEntryButton({
  count,
  onClick,
  className,
}: {
  count: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center rounded-full border bg-background px-4 text-sm font-semibold text-foreground",
        pressable,
        hoverMuted,
        className,
      )}
    >
      초안 보기 ({count})
    </button>
  );
}
