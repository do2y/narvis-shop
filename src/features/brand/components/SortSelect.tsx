"use client";

import { ChevronDown } from "lucide-react";
import { BRAND_SORTS, type BrandSort } from "../types";

/**
 * 정렬 — 네이티브 select. 옵션이 4개뿐이고 모바일에서 OS 피커가 가장 다루기 쉽다.
 *
 * 알약(rounded-full)에서 rounded-lg 로 낮췄다. 툴바에서 알약은 "누르는 버튼"으로
 * 읽혀 옆의 카테고리 칩과 같은 종류로 보였는데, 이건 값을 고르는 입력이다.
 *
 * 네이티브 select 의 기본 화살표를 지우고 직접 그린다 — OS 마다 모양·위치가 달라
 * 그대로 두면 화면이 브라우저마다 다르게 보인다. 피커 동작은 네이티브 그대로다.
 */
export function SortSelect({
  value,
  onChange,
}: {
  value: BrandSort;
  onChange: (sort: BrandSort) => void;
}) {
  return (
    <div className="relative">
      {/* 접근 가능한 이름만 제공하고 화면에는 "정렬" 글자를 따로 두지 않는다 —
          고른 값(인기순)이 곧 무엇인지 말하고 있어 라벨은 소음이 된다. */}
      <label className="sr-only" htmlFor="brand-sort">
        정렬 기준
      </label>
      <select
        id="brand-sort"
        value={value}
        onChange={(e) => onChange(e.target.value as BrandSort)}
        // appearance-none + pr-9: 기본 화살표를 지우고 그 자리를 아래 아이콘에 내준다.
        className="h-10 w-full appearance-none rounded-lg border bg-background pl-3.5 pr-9 text-sm font-medium transition-colors duration-150 ease-out-strong hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {BRAND_SORTS.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
