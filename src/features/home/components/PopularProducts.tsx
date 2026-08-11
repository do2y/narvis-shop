"use client";

import { usePopularProducts } from "../useHomeData";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import { SectionHeading } from "./SectionHeading";

export function PopularProducts() {
  const { data: products, isLoading, isError } = usePopularProducts();

  return (
    <section className="px-5 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto w-full min-w-0 max-w-[24rem] sm:max-w-6xl">
        <SectionHeading eyebrow="인기 상품" title="지금 많이 찾는 상품" />

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

          {products?.map((product) => (
            <ProductCard key={product.productId} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
