"use client";

import { track } from "@/shared/analytics/track";
import type { EventRecommendation } from "@/shared/analytics/types";
import { useVisibleOnce } from "@/shared/analytics/useVisibleOnce";
import { useAuthStore } from "@/shared/stores/authStore";
import type { RecommendationResult } from "../types";
import { useRecommendedProducts } from "../useHomeData";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
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

  return (
    <section ref={sectionRef} className="px-5 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto w-full min-w-0 max-w-[24rem] sm:max-w-6xl">
        <SectionHeading eyebrow="AI 추천" title={`${nickname}님을 위한 추천`} />

        <div className="mt-5 grid w-full min-w-0 grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {data.items.map((product) => (
            <ProductCard
              key={product.productId}
              product={product}
              recommendation={recommendation}
            />
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

        <div className="mt-5 grid w-full min-w-0 grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
