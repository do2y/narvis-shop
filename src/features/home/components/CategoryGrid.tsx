"use client";

import { useRouter } from "next/navigation";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  DEFAULT_CATEGORY_IMAGE,
  categoryEmoji,
  categoryImage,
} from "../categoryEmoji";
import { useCategories } from "../useHomeData";
import { SectionHeading } from "./SectionHeading";

export function CategoryGrid() {
  const router = useRouter();
  const { data: categories, isLoading, isError } = useCategories();

  return (
    <section className="bg-muted/30 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="카테고리"
          title="어떤 걸 찾고 계세요?"
          aside="클릭하면 AI가 해당 분야에서 도와드려요"
        />

        {/* 14개를 7열 2행으로 — 좁은 화면에서는 2·4열로 접어 행 수만 늘어난다 */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {isLoading &&
            Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-sm" />
            ))}

          {isError && (
            <p className="col-span-full text-sm text-muted-foreground">
              카테고리를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
            </p>
          )}

          {categories?.map((cat) => {
            const image = categoryImage(cat.name);
            return (
            // 인기상품 API에 카테고리 필터가 없어(P-4), 카테고리명을 질문으로 넘겨
            // 챗봇이 해당 분야를 추천하게 한다.
            <button
              key={cat.id}
              type="button"
              onClick={() =>
                router.push(`/chat?q=${encodeURIComponent(`${cat.name} 추천해줘`)}`)
              }
              className="flex flex-col items-center gap-2 rounded-sm border bg-background px-3 py-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:bg-muted hover:shadow-md active:translate-y-0 active:scale-[0.98]"
            >
              {/* 이미지가 준비된 카테고리만 그림으로, 나머지는 이모지로 폴백한다.
                  표에 등록돼 있어도 파일이 없을 수 있어(에셋 교체 중) onError 로 기본 아이콘을 세운다.
                  깨진 이미지 아이콘이 그대로 노출되는 것을 막는 마지막 방어다 */}
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- 고정 크기 로컬 아이콘이라 최적화 이득이 없다
                <img
                  src={image}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 object-contain"
                  aria-hidden
                  onError={(e) => {
                    // 기본 아이콘마저 실패하면 무한 루프가 되므로 한 번만 교체한다
                    const img = e.currentTarget;
                    if (img.dataset.fallback) return;
                    img.dataset.fallback = "true";
                    img.src = DEFAULT_CATEGORY_IMAGE;
                  }}
                />
              ) : (
                <span className="text-2xl leading-8" aria-hidden>
                  {categoryEmoji(cat.name)}
                </span>
              )}
              <span className="text-sm font-medium">#{cat.name}</span>
            </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
