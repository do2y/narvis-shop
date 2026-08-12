"use client";

import { cn } from "@/lib/utils";
import { useRevealOnce } from "../hooks/useRevealOnce";
import { usePopularProducts } from "../useHomeData";
import { ProductCard, ProductCardSkeleton } from "@/shared/ui/ProductCard";
import { SectionHeading } from "./SectionHeading";

export function PopularProducts() {
  const { data: products, isLoading, isError } = usePopularProducts();
  const { ref, revealed } = useRevealOnce<HTMLElement>();

  return (
    <section ref={ref} className="px-5 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto w-full min-w-0 max-w-[24rem] sm:max-w-6xl">
        <div
          className={cn(
            "transition-[opacity,transform] duration-400 ease-out-strong motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
            revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <SectionHeading eyebrow="인기 상품" title="지금 많이 찾는 상품" />
        </div>

        <div className="mt-5 grid w-full min-w-0 grid-cols-2 gap-x-3 gap-y-6 sm:mt-8 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4">
          {isLoading &&
            Array.from({ length: 4 }).map((_, index) => (
              <ProductCardSkeleton key={index} />
            ))}

          {isError && (
            <p className="col-span-full text-sm text-muted-foreground">
              상품을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
            </p>
          )}

          {products?.map((product, index) => (
            <div
              key={product.productId}
              className={cn(
                "transition-[opacity,transform] duration-400 ease-out-strong motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
                revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
              )}
              style={{ transitionDelay: `${140 + index * 45}ms` }}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
