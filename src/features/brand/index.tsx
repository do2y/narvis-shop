"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AppHeader } from "@/shared/ui/AppHeader";
import { ErrorState } from "@/features/mypage/components/PageState";
import { ApiError } from "@/shared/api/client";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/lib/utils";
import { BrandHeader } from "./components/BrandHeader";
import { BrandProductCard } from "./components/BrandProductCard";
import { BrandSkeleton } from "./components/BrandSkeleton";
import { CategoryFilter } from "./components/CategoryFilter";
import { SortSelect } from "./components/SortSelect";
import { useBrandHome } from "./useBrandHome";
import type { BrandHome, BrandQuery, BrandSort } from "./types";

// id·initialData는 서버 컴포넌트(app/brands/[brandId]/page.tsx)가 넘긴다.
export default function BrandPage({
  id,
  initialData,
  serverQuery,
}: {
  id: string;
  initialData?: BrandHome;
  /** initialData가 어떤 필터 조합의 결과인지 — 그 조합에서만 승계한다 */
  serverQuery?: BrandQuery;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 필터·정렬·페이지를 URL 쿼리에 둔다(원본은 useState).
  // 이유: 이 조합이 곧 하나의 화면이라 공유·뒤로가기가 동작해야 하고,
  // 서버가 같은 조건으로 렌더할 수 있어야 필터별 URL이 색인된다.
  // Number() 로 감싸지 않는다 — 64비트 카테고리 id 의 끝자리가 조용히 바뀐다
  // (brandId 와 같은 사유 — app/brands/[brandId]/page.tsx 의 resolveId 주석 참조).
  const category = searchParams.get("category") || null;
  const sort = (searchParams.get("sort") as BrandSort | null) ?? "popular";
  const page = Number(searchParams.get("page") ?? 0);

  const { data, error, isPending, isError, isFetching, refetch } = useBrandHome(
    id,
    { category: category ?? undefined, sort, page },
    initialData,
    serverQuery,
  );

  // 없는 브랜드는 재시도해도 결과가 같으므로 일반 오류와 구분한다(재시도 대신 홈으로).
  const notFound = error instanceof ApiError && error.code === "BRAND_NOT_FOUND";

  // 쿼리스트링 갱신 헬퍼. 기본값은 URL에서 빼 주소를 짧게 유지한다
  // (같은 화면이 ?sort=popular 유무로 두 URL이 되면 색인이 갈린다).
  const updateQuery = (next: {
    category?: string | null;
    sort?: BrandSort;
    page?: number;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    const set = (key: string, value: string | null) => {
      if (value === null) params.delete(key);
      else params.set(key, value);
    };

    if ("category" in next) {
      set("category", next.category ?? null);
    }
    if (next.sort !== undefined) {
      set("sort", next.sort === "popular" ? null : next.sort);
    }
    if (next.page !== undefined) {
      set("page", next.page === 0 ? null : String(next.page));
    }

    const qs = params.toString();
    // 네이티브 History API를 쓴다 — Next 문서가 "상품 목록 정렬"을 이 방식으로 안내한다.
    // router.push는 서버 라운드트립을 도는 페이지 이동이라 이런 화면 내 필터 갱신에는
    // 주소창이 즉시 반영되지 않는다. pushState는 Next 라우터와 통합되어
    // useSearchParams가 그대로 갱신되고, 뒤로가기도 정상 동작한다.
    window.history.pushState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  // 필터·정렬을 바꾸면 첫 페이지로 되돌린다(2페이지에서 필터를 바꾸면 빈 목록이 될 수 있음)
  const changeCategory = (next: string | null) =>
    updateQuery({ category: next, page: 0 });
  const changeSort = (next: BrandSort) => updateQuery({ sort: next, page: 0 });
  const changePage = (next: number) => updateQuery({ page: next });

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
              href="/"
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
                    onClick={() => changePage(Math.max(0, data.products.page - 1))}
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
                      changePage(
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
