"use client";

import { Skeleton } from "@/shared/ui/skeleton";
import { ProductCardSkeleton } from "@/shared/ui/ProductCard";

// 목록/상세는 스피너 단독 금지 → 스켈레톤 (CLAUDE.md)
//
// 실제 레이아웃과 같은 간격·grid 를 쓴다. 스켈레톤이 다른 배치면 데이터가
// 도착하는 순간 화면이 재배치돼 튄다. 카드도 공용 스켈레톤을 그대로 재사용한다.
export function BrandSkeleton() {
  return (
    <div className="flex flex-col">
      {/* 브랜드 헤더 — 로고 72px + 이름·상품 수 */}
      <div className="flex items-center gap-4 sm:gap-5">
        <Skeleton className="size-[72px] shrink-0 rounded-[18px] sm:size-20" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-40 rounded-full sm:h-7" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
      </div>

      {/* 카테고리 칩 */}
      <div className="mt-10 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-20 shrink-0 rounded-full" />
        ))}
      </div>

      {/* 툴바 */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
