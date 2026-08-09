"use client";

import { useEffect, useState } from "react";
import { List, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PreferenceView = "graph" | "list";

/**
 * 방사형이 성립하지 않는 폭. 라벨이 겹쳐 아무것도 안 읽힌다.
 *
 * CSS로 숨기지 않고 상태로 판정하는 이유: SVG를 그려놓고 display:none 하면
 * 좌표 계산만 낭비된다. 좁은 화면에서는 아예 그리지 않는다.
 */
const GRAPH_MIN_WIDTH = 768;

export function useIsNarrow(): boolean {
  // SSR·첫 페인트에서는 false로 시작한다. 이 화면은 클라이언트 렌더라
  // 하이드레이션 불일치가 없고, 첫 프레임에 잘못된 뷰가 잠깐 보이지도 않는다
  // (데이터 로딩 중이라 스켈레톤이 떠 있다).
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${GRAPH_MIN_WIDTH - 1}px)`);
    const sync = () => setIsNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isNarrow;
}

interface ViewToggleProps {
  view: PreferenceView;
  onChange: (view: PreferenceView) => void;
}

/**
 * 그래프 ⇄ 목록 전환.
 *
 * 목록은 "전체 보기"를 겸한다 — 그래프는 관계당 6개까지만 그릴 수 있어
 * 항목이 많으면 전부 확인할 수단이 필요하고, 방사형으로 40개를 그리면
 * 라벨이 겹쳐 오히려 못 읽는다. 많을 때 정리하려는 요구에는 목록이 정직하다.
 */
export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="보기 방식"
      className="flex items-center gap-1 rounded-full border border-border p-1"
    >
      <ToggleButton
        active={view === "graph"}
        onClick={() => onChange("graph")}
        icon={<Share2 className="size-4" />}
        label="그래프"
      />
      <ToggleButton
        active={view === "list"}
        onClick={() => onChange("list")}
        icon={<List className="size-4" />}
        label="전체 보기"
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
