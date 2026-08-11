"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";
import { DEFAULT_CATEGORY_IMAGE } from "../categoryEmoji";
import { useRevealOnce } from "../hooks/useRevealOnce";
import { useCategories } from "../useHomeData";
import { SectionHeading } from "./SectionHeading";

export function CategoryGrid() {
  const router = useRouter();
  const { data: categories, isLoading, isError } = useCategories();
  const { ref, revealed } = useRevealOnce<HTMLElement>();

  return (
    <section
      ref={ref}
      className="bg-muted/30 px-5 py-12 md:snap-start md:scroll-mt-20 sm:px-6 sm:py-16"
    >
      <div className="mx-auto max-w-[24rem] sm:max-w-6xl">
        <div
          className={cn(
            "transition-[opacity,transform] duration-400 ease-out-strong motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
            revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <SectionHeading
            eyebrow="카테고리"
            title="어떤 걸 찾고 계세요?"
            aside="클릭하면 AI가 해당 분야에서 도와드려요"
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
          {isLoading &&
            Array.from({ length: 14 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-[68px] rounded-lg sm:h-24 sm:rounded-sm"
              />
            ))}

          {isError && (
            <p className="col-span-full text-sm text-muted-foreground">
              카테고리를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
            </p>
          )}

          {categories?.map((category, index) => (
            <div
              key={category.id}
              className={cn(
                "transition-[opacity,transform] duration-400 ease-out-strong motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
                revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
              )}
              style={{ transitionDelay: `${120 + Math.min(index, 7) * 40}ms` }}
            >
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/chat?q=${encodeURIComponent(`${category.name} 추천해줘`)}`,
                  )
                }
                className="flex min-h-[68px] w-full items-center gap-3 rounded-lg border border-border/80 bg-background px-3.5 py-3 text-left shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-[transform,background-color,box-shadow] duration-150 ease-out active:scale-[0.98] active:bg-muted/55 sm:flex-col sm:items-center sm:justify-center sm:gap-2 sm:rounded-sm sm:px-3 sm:py-4 sm:text-center sm:shadow-sm sm:hover:-translate-y-0.5 sm:hover:bg-muted sm:hover:shadow-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local icon */}
                <img
                  src={DEFAULT_CATEGORY_IMAGE}
                  alt=""
                  width={28}
                  height={28}
                  className="size-6 shrink-0 object-contain sm:size-8"
                  aria-hidden
                />

                <span className="min-w-0 text-[14px] font-semibold leading-[1.28] text-foreground sm:text-sm sm:font-medium">
                  <span className="line-clamp-2 break-words text-left sm:line-clamp-none sm:text-center">
                    #{category.name}
                  </span>
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
