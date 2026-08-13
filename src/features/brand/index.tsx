"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AppHeader } from "@/shared/ui/AppHeader";
import { ErrorState } from "@/shared/ui/PageState";
import { ApiError } from "@/shared/api/client";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/shared/ui/ProductCard";
import { BrandHeader } from "./components/BrandHeader";
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

      {/* max-w-6xl + px-5(모바일 20px) — 브랜드 헤더·필터·툴바·상품 grid 가
          전부 이 하나의 컨테이너 안에 들어가 같은 좌우 정렬선을 쓴다.
          종전에는 py-12(48px)로 위아래가 과했다 — 헤더 아래 40px 로 줄인다. */}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 sm:py-12">
        {isPending ? (
          <BrandSkeleton />
        ) : notFound ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-sm text-muted-foreground">
              존재하지 않는 브랜드예요.
            </p>
            <Link
              href="/home"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 rounded-lg px-6 transition-transform active:scale-[0.98]",
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
          /* 간격 체계: 브랜드 소개 → 필터 40px, 필터 → 툴바 32px,
             툴바 → grid 20px. 아래로 갈수록 좁아져 "묶음 안으로 들어간다"가
             형태로 읽힌다(§16 근접성 = 관계). */
          <div className="flex flex-col">
            <BrandHeader
              brand={data.brand}
              productCount={data.products.totalElements}
            />

            {/* divider 를 두지 않는다 — 종전에는 긴 선 + pt-8 이 브랜드 소개와
                상품 목록을 두 개의 다른 화면으로 갈라놓았다. 간격만으로 충분히
                구분되고, 하나의 흐름으로 이어진다. */}
            <div className="mt-10">
              <CategoryFilter
                categories={data.brand.categories}
                selected={category}
                onSelect={changeCategory}
              />
            </div>

            {/* 툴바 — 상품 수와 정렬을 한 줄로 묶는다. grid 와 같은 컨테이너 안에
                있어 양 끝이 카드의 시작선·끝선과 정확히 맞는다.
                320px 에서도 겹치지 않게 정렬 쪽에 shrink-0 을 준다. */}
            <div className="mt-8 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground tabular-nums">
                상품 {data.products.totalElements.toLocaleString("ko-KR")}개
              </p>
              <div className="shrink-0">
                <SortSelect value={sort} onChange={changeSort} />
              </div>
            </div>

            <div className="mt-5">
              {data.products.content.length === 0 ? (
                // 빈 상태 — 회색 카드를 걷어내고 문구만. 면을 깔면 "상품이 없다"가
                // 아니라 "무언가 담긴 영역"으로 보인다.
                <p className="py-20 text-center text-sm text-muted-foreground">
                  해당 카테고리에 상품이 없어요.
                </p>
              ) : (
                <div
                  // 필터·정렬 재조회 중에는 살짝 흐리게 — 이전 결과를 유지하되 갱신 중임을 알린다.
                  //
                  // 상품이 적어도 카드가 커지지 않는다: grid-cols 는 그대로 두고,
                  // 열 수보다 상품이 적으면 남는 칸은 비워 둔다(justify-start 기본).
                  // 1개일 때 카드를 늘리면 다른 화면의 같은 카드와 크기가 달라진다.
                  // 대신 gap 을 홈(gap-x-5)과 맞춰 카드가 고립돼 보이지 않게 한다.
                  className={cn(
                    "grid grid-cols-2 gap-x-3 gap-y-6 transition-opacity duration-150 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4",
                    isFetching && "opacity-60",
                  )}
                >
                  {data.products.content.map((product) => (
                    // 브랜드명을 감추지 않는다(hideBrandName 미사용) — 평점이
                    // 우측 정렬이라 왼쪽 이름을 지우면 그 줄에 평점만 덩그러니
                    // 남아 제목 위가 비어 보인다. 반복이 소음이긴 해도, 카드
                    // 안에서 균형을 잡아주는 쪽이 낫다.
                    <ProductCard
                      key={product.productId}
                      product={product}
                      wishlist
                      purchaseState={product.purchaseState}
                    />
                  ))}
                </div>
              )}
            </div>

            {data.products.totalPages > 1 && (
              <nav className="mt-12 flex items-center justify-center gap-3">
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
        )}
      </main>
    </div>
  );
}
