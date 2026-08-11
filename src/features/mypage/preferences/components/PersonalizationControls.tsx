"use client";

import { cn } from "@/lib/utils";

/**
 * 개인화 ON/OFF 스위치 + [전체 초기화] — 우상단 컨트롤.
 *
 * ⚠️ 두 컨트롤이 나란히 있어 **[전체 초기화]를 잘못 누르기 쉽다**(노션 3.6).
 * 그래서 시각적으로 확실히 구분한다: 스위치는 채워진 알약, 초기화는 테두리만
 * 있는 조용한 버튼 + 사이 간격을 넉넉히. 초기화는 색으로 위협하지 않는다 —
 * 파괴적인 것은 확인창이 막고, 여기서 빨갛게 두면 매번 시선을 끈다.
 *
 * 빈 상태(취향 0개)에서도 **둘 다 보인다.** 개인화 설정은 취향 유무와 무관하고,
 * 초기화는 대화 기록도 지우므로 취향이 없어도 지울 것이 남아 있다.
 */
export function PersonalizationControls({
  enabled,
  isToggling,
  isResetting,
  onToggle,
  onResetClick,
}: {
  enabled: boolean;
  isToggling: boolean;
  isResetting: boolean;
  onToggle: (next: boolean) => void;
  onResetClick: () => void;
}) {
  return (
    <div className="flex shrink-0 self-start items-center gap-3 sm:gap-5">
      {/*
        스위치 — 확인창 없음(다시 켜면 복원되므로). 연타도 허용된다.

        <label>로 감싸지 않는다: label은 폼 컨트롤을 위한 것이고, role="switch"
        버튼을 감싸면 라벨 클릭이 버튼 클릭으로 한 번 더 전달돼 토글이 두 번
        일어날 수 있다. 텍스트는 aria-labelledby로 연결한다.
      */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        <span
          id="personalization-switch-label"
          className="text-[13px] font-medium tracking-tight sm:text-sm"
        >
          개인화
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="personalization-switch-label"
          disabled={isToggling}
          onClick={() => onToggle(!enabled)}
          className={cn(
            "relative inline-flex h-11 w-[46px] shrink-0 items-center justify-center rounded-full disabled:opacity-60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2",
            "transition-transform duration-150 ease-out-strong active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
            "[--toggle-track-width:40px] [--toggle-track-height:22px] [--toggle-thumb-size:18px] [--toggle-track-padding:2px]",
            "sm:w-12 sm:[--toggle-track-width:42px] sm:[--toggle-track-height:24px] sm:[--toggle-thumb-size:18px] sm:[--toggle-track-padding:3px]",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "relative h-[var(--toggle-track-height)] w-[var(--toggle-track-width)] rounded-full transition-colors duration-150 ease-out-strong",
              enabled ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute left-[var(--toggle-track-padding)] top-1/2 size-[var(--toggle-thumb-size)] -translate-y-1/2 rounded-full bg-background shadow-[0_1px_2px_rgba(15,23,42,0.18)]",
                "transition-transform duration-150 ease-out-strong will-change-transform",
                enabled
                  ? "translate-x-[calc(var(--toggle-track-width)-var(--toggle-thumb-size)-(var(--toggle-track-padding)*2))]"
                  : "translate-x-0",
              )}
            />
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={onResetClick}
        disabled={isResetting}
        className={cn(
          "group inline-flex h-11 items-center justify-center rounded-full px-0 disabled:opacity-60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2",
          "transition-transform duration-150 ease-out-strong active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
        )}
      >
        <span
          className={cn(
            "inline-flex h-8 items-center justify-center rounded-full border border-border px-3.5 text-[13px] font-medium leading-none text-muted-foreground",
            "transition-colors duration-150 ease-out-strong group-hover:[@media(hover:hover)]:bg-muted group-hover:[@media(hover:hover)]:text-foreground",
            "sm:h-11 sm:px-4 sm:text-sm",
          )}
        >
          전체 초기화
        </span>
      </button>
    </div>
  );
}

/**
 * 개인화 꺼짐 배너.
 *
 * 끄면 무슨 일이 일어나는지 **반드시 알려야 한다**(노션 3.1). 특히 채팅의
 * "기억해" 요청이 저장되지 않는다는 것 — 이걸 모르면 사용자가 기억해달라고
 * 말해놓고 나중에 아무것도 저장되지 않은 걸 발견해 배신감을 느낀다.
 *
 * 데이터가 보존된다는 것도 함께 적는다. 그게 없으면 "껐으니 지워졌나?" 하고
 * 불안해하거나, 반대로 지우려고 끄는 사람이 생긴다.
 */
export function PersonalizationOffBanner() {
  return (
    <div className="rounded-sm bg-muted/50 px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
      <p className="font-medium text-foreground">개인화가 꺼져 있어요.</p>
      <p className="mt-1">
        추천에 취향을 쓰지 않고 새 취향도 기록하지 않아요. “기억해”라고 말해도
        저장되지 않아요. 지금까지의 데이터는 그대로 보관돼요.
      </p>
    </div>
  );
}
