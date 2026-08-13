"use client";

import { cn } from "@/lib/utils";
import type { BrandCategory } from "../types";

/**
 * 카테고리 칩 — brand.categories(서버가 준 필터 축)를 그대로 쓴다.
 * 선택 시 카테고리 ID를 쿼리로 보내 서버가 필터링한다.
 *
 * "전체"와 세부 카테고리를 **같은 부품**으로 그린다. 종전에는 선택된 칩만 검정
 * 면색(bg-foreground)이라, 기본 상태인 "전체"가 늘 검게 칠해져 다른 종류의
 * 버튼처럼 보였다 — 같은 역할이면 같은 모양이어야 한 체계로 읽힌다(§16 familiarity).
 *
 * 선택 표현도 낮춘다. 검정 면색은 이 페이지에서 가장 강한 요소가 되어, 필터가
 * 상품보다 먼저 읽혔다. 옅은 면 + 진한 글자로 구분하면 충분하다.
 */
export function CategoryFilter({
  categories,
  selected,
  onSelect,
}: {
  categories: BrandCategory[];
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
}) {
  return (
    // 모바일에서만 가로 스크롤(칩이 많으면 넘친다). sm 이상에서는 자연스럽게 wrap
    // 시킨다 — 넓은 화면에서 가로 스크롤은 있는 줄도 모른다.
    // scrollbar-none + 음수 마진: 스크롤바는 감추되 좌우 padding 은 컨테이너와 맞춘다.
    <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:px-0">
      <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        <Chip active={selected === null} onClick={() => onSelect(null)}>
          전체
        </Chip>
        {categories.map((category) => {
          const { parent, leaf } = splitCategoryPath(category.name);
          return (
            <Chip
              key={category.id}
              active={selected === category.id}
              onClick={() => onSelect(category.id)}
              // 칩 안에는 소분류만 보이므로, 스크린리더에는 전체 경로를 준다 —
              // "한식" 만 읽히면 무엇의 한식인지 알 수 없다.
              title={category.name}
              label={category.name}
            >
              {/* 대분류는 있을 때만, 한 단계 낮춰서. 칩 하나에 긴 경로를 통째로
                  넣으면 칩이 길어져 필터 줄이 흐트러지고, 실제로 고르는 축인
                  소분류가 경로 안에 묻힌다. */}
              {parent && (
                <span className="text-muted-foreground/70">{parent}</span>
              )}
              <span>{leaf}</span>
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

/**
 * "바디케어 > 생활선물세트" → { parent: "바디케어", leaf: "생활선물세트" }
 *
 * 서버가 카테고리를 대분류·소분류로 나눠 주지 않는다 — 이미 합쳐진 한 문자열이
 * 전부다(BrandCategory.name). 계약에 없는 구조를 만들지 않고, 서버가 쓰는
 * 구분자(">")로 갈라 표시만 단계적으로 읽히게 한다.
 *
 * 구분자가 없으면 그대로 leaf 로 둔다 — 1단 카테고리인 브랜드에서도 깨지지 않는다.
 * 3단 이상이면 마지막만 leaf, 앞은 전부 parent 로 묶는다.
 */
function splitCategoryPath(name: string): {
  parent: string | null;
  leaf: string;
} {
  const parts = name.split(">").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return { parent: null, leaf: name.trim() };
  return {
    parent: parts.slice(0, -1).join(" › "),
    leaf: parts[parts.length - 1],
  };
}

function Chip({
  active,
  onClick,
  children,
  title,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  /** 스크린리더용 전체 이름. 칩 안에 일부만 보일 때 필요하다 */
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      aria-label={label}
      className={cn(
        // h-10(40px) — 종전 h-11 은 필터 줄이 툴바보다 무거워 보였다.
        // press 즉시 반응(§1). reduced-motion 에선 스케일 없이 색만 바뀐다
        // border 를 양쪽 다 준다(선택 시 transparent) — 한쪽만 테두리가 있으면
        // 1px 만큼 폭·높이가 달라져 칩을 누를 때마다 줄이 미세하게 흔들린다.
        //
        // 대분류·소분류 두 span 사이에 › 를 넣는다(가상 요소라 마크업이 늘지 않고,
        // 대분류가 없는 칩에는 자동으로 안 붙는다).
        "inline-flex h-10 shrink-0 items-center gap-1 rounded-full border px-4 text-sm transition duration-100 ease-out",
        "[&>span+span]:before:mr-1 [&>span+span]:before:text-muted-foreground/50 [&>span+span]:before:content-['›']",
        "active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:active:scale-100",
        active
          ? // 선택 — 옅은 면 + 진한 글자. 검정 면색은 이 페이지에서 가장 강한
            // 요소가 되어 필터가 상품보다 먼저 읽힌다
            "border-transparent bg-foreground/[0.06] font-medium text-foreground"
          : // 비선택 — 투명 배경 + 아주 옅은 테두리. hover 에서만 진해진다
            "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
