import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "@/shared/ui/AppHeader";
import { ErrorState } from "@/pages/mypage/components/PageState";
import { ApiError } from "@/shared/api/client";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/lib/utils";
import { BrandHeader } from "./components/BrandHeader";
import { BrandProductCard } from "./components/BrandProductCard";
import { BrandSkeleton } from "./components/BrandSkeleton";
import { CategoryFilter } from "./components/CategoryFilter";
import { SortSelect } from "./components/SortSelect";
import { useBrandHome } from "./useBrandHome";
import type { BrandSort } from "./types";

export default function BrandPage() {
  const { brandId } = useParams();
  const [category, setCategory] = useState<number | null>(null);
  const [sort, setSort] = useState<BrandSort>("popular");
  const [page, setPage] = useState(0);

  const { data, error, isPending, isError, isFetching, refetch } = useBrandHome(
    Number(brandId),
    { category: category ?? undefined, sort, page },
  );

  // 없는 브랜드는 재시도해도 결과가 같으므로 일반 오류와 구분한다(재시도 대신 홈으로).
  const notFound = error instanceof ApiError && error.code === "BRAND_NOT_FOUND";

  // 필터·정렬을 바꾸면 첫 페이지로 되돌린다(2페이지에서 필터를 바꾸면 빈 목록이 될 수 있음)
  const changeCategory = (next: number | null) => {
    setCategory(next);
    setPage(0);
  };
  const changeSort = (next: BrandSort) => {
    setSort(next);
    setPage(0);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {isPending ? (
          <BrandSkeleton />
        ) : notFound ? (
          <div className="flex flex-col items-center gap-4 rounded-sm bg-muted/30 px-6 py-20 text-center">
            <p className="text-sm text-muted-foreground">
              존재하지 않는 브랜드예요.
            </p>
            <Link
              to="/"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 rounded-full px-6 transition-transform active:scale-[0.98]",
              )}
            >
              홈으로
            </Link>
          </div>
        ) : isError ? (
          <ErrorState
            message="브랜드 정보를 불러오지 못했어요."
            onRetry={() => refetch()}
          />
        ) : (
          <div className="flex flex-col gap-8 sm:gap-10">
            <BrandHeader
              brand={data.brand}
              productCount={data.products.totalElements}
            />

            <div className="flex flex-col gap-5 border-t pt-8">
              <CategoryFilter
                categories={data.brand.categories}
                selected={category}
                onSelect={changeCategory}
              />

              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {data.products.totalElements.toLocaleString("ko-KR")}개 상품
                </p>
                <SortSelect value={sort} onChange={changeSort} />
              </div>

              {data.products.content.length === 0 ? (
                <div className="rounded-sm bg-muted/30 px-6 py-20 text-center">
                  <p className="text-sm text-muted-foreground">
                    해당 카테고리에 상품이 없어요.
                  </p>
                </div>
              ) : (
                <div
                  // 필터·정렬 재조회 중에는 살짝 흐리게 — 이전 결과를 유지하되 갱신 중임을 알린다
                  className={cn(
                    "grid grid-cols-2 gap-x-4 gap-y-8 transition-opacity sm:grid-cols-3 lg:grid-cols-4",
                    isFetching && "opacity-60",
                  )}
                >
                  {data.products.content.map((product) => (
                    <BrandProductCard
                      key={product.productId}
                      product={product}
                    />
                  ))}
                </div>
              )}

              {data.products.totalPages > 1 && (
                <nav className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    // 서버가 응답한 page를 기준으로 이동한다 — 요청 page와 다를 수 있어
                    // (범위 초과 등) 로컬 상태를 신뢰하면 표시와 실제가 어긋난다
                    onClick={() => setPage(Math.max(0, data.products.page - 1))}
                    disabled={data.products.page === 0}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "h-11 rounded-full px-5 disabled:opacity-40",
                    )}
                  >
                    이전
                  </button>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {data.products.page + 1} / {data.products.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage(
                        Math.min(
                          data.products.totalPages - 1,
                          data.products.page + 1,
                        ),
                      )
                    }
                    disabled={data.products.page >= data.products.totalPages - 1}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "h-11 rounded-full px-5 disabled:opacity-40",
                    )}
                  >
                    다음
                  </button>
                </nav>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
