"use client";

import { cn } from "@/lib/utils";
import { track } from "@/shared/analytics/track";
import type { EventRecommendation } from "@/shared/analytics/types";
import { useVisibleOnce } from "@/shared/analytics/useVisibleOnce";
import { useAuthStore } from "@/shared/stores/authStore";
import { useRevealOnce } from "../hooks/useRevealOnce";
import type { RecommendationResult } from "../types";
import { useRecommendedProducts } from "../useHomeData";
import { ProductCard, ProductCardSkeleton } from "@/shared/ui/ProductCard";
import { SectionHeading } from "./SectionHeading";

export function RecommendedProducts() {
  const nickname = useAuthStore((state) => state.user?.nickname);
  const { data, isError, fetchStatus, isPending } = useRecommendedProducts();

  if (!nickname) return null;

  const isLoading = isPending && fetchStatus === "fetching";

  if (isPending && fetchStatus === "idle") return null;
  if (isLoading) return <RecommendedSkeleton nickname={nickname} />;
  if (isError || !data) return null;
  if (data.source !== "PERSONALIZED" || !data.items.length) return null;

  return <RecommendedSection nickname={nickname} data={data} />;
}

function RecommendedSection({
  nickname,
  data,
}: {
  nickname: string;
  data: RecommendationResult;
}) {
  const recommendation: EventRecommendation = {
    recommendationRequestId: data.recommendationRequestId,
    listId: data.listId,
  };

  const sectionRef = useVisibleOnce<HTMLElement>(
    () => track("recommendation_impression", { recommendation }),
    data.listId,
  );
  const { ref: revealRef, revealed } = useRevealOnce<HTMLDivElement>();

  return (
    <section ref={sectionRef} className="px-5 py-12 sm:px-6 sm:py-16">
      <div
        ref={revealRef}
        className="mx-auto w-full min-w-0 max-w-[24rem] sm:max-w-6xl"
      >
        <div
          className={cn(
            "transition-[opacity,transform] duration-400 ease-out-strong motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
            revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <SectionHeading eyebrow="AI 추천" title={`${nickname}님을 위한 추천`} />
        </div>

        <div className="mt-5 grid w-full min-w-0 grid-cols-2 gap-x-3 gap-y-6 sm:mt-8 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4">
          {data.items.map((product, index) => (
            <div
              key={product.productId}
              className={cn(
                "transition-[opacity,transform] duration-400 ease-out-strong motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
                revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
              )}
              style={{ transitionDelay: `${140 + index * 45}ms` }}
            >
              <ProductCard
                product={product}
                recommendation={recommendation}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecommendedSkeleton({ nickname }: { nickname: string }) {
  return (
    <section className="px-5 py-12 sm:px-6 sm:py-16" aria-busy="true">
      <div className="mx-auto w-full min-w-0 max-w-[24rem] sm:max-w-6xl">
        <SectionHeading eyebrow="AI 추천" title={`${nickname}님을 위한 추천`} />

        <div className="mt-5 grid w-full min-w-0 grid-cols-2 gap-x-3 gap-y-6 sm:mt-8 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
