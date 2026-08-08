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
    <div className="flex shrink-0 items-center gap-5">
      {/*
        스위치 — 확인창 없음(다시 켜면 복원되므로). 연타도 허용된다.

        <label>로 감싸지 않는다: label은 폼 컨트롤을 위한 것이고, role="switch"
        버튼을 감싸면 라벨 클릭이 버튼 클릭으로 한 번 더 전달돼 토글이 두 번
        일어날 수 있다. 텍스트는 aria-labelledby로 연결한다.
      */}
      <div className="flex items-center gap-2.5">
        <span
          id="personalization-switch-label"
          className="text-sm font-medium tracking-tight"
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
            "relative flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
            // 강한 색을 쓰는 세 군데 중 하나(노션 10.5) — 켜진 스위치
            enabled ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute size-5 rounded-full bg-background shadow-sm transition-transform",
              enabled ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>

      <button
        type="button"
        onClick={onResetClick}
        disabled={isResetting}
        className="h-11 rounded-full border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
      >
        전체 초기화
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
