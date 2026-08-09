"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Skeleton } from "@/shared/ui/skeleton";
import { ProductImage } from "@/shared/ui/ProductImage";
import { cn } from "@/lib/utils";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import { fetchSellerProducts } from "../api";
import { numeric, pressable } from "../interaction";
import type {
  SellerProductDisplayStatus,
  SellerProductSort,
  SellerProductTab,
} from "../types";
import { StatusTabs } from "./StatusTabs";
import { Pagination } from "./Pagination";
import { SellerErrorState } from "./SellerErrorState";

const TABS: { key: SellerProductTab; label: string; alert?: boolean }[] = [
  { key: "ALL", label: "전체" },
  { key: "ON_SALE", label: "판매중" },
  { key: "SOLD_OUT", label: "품절", alert: true },
  { key: "HIDDEN", label: "숨김" },
];

const SORTS: { value: SellerProductSort; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "sales", label: "판매량순" },
  { value: "stock", label: "재고순" },
  { value: "price", label: "가격순" },
];

// 배지는 원본 status가 아니라 displayStatus(3종)로 그린다(계약 §표시 상태 파생).
const STATUS_LABEL: Record<SellerProductDisplayStatus, string> = {
  ON_SALE: "판매중",
  SOLD_OUT: "품절",
  HIDDEN: "숨김",
};

const STATUS_CLASS: Record<SellerProductDisplayStatus, string> = {
  ON_SALE: "bg-brand/10 text-brand",
  SOLD_OUT: "bg-destructive/10 text-destructive",
  HIDDEN: "bg-muted text-muted-foreground",
};

// 빨강 강조 기준 — S-1 lowStockThreshold 기본값과 맞춘다(계약)
const LOW_STOCK_THRESHOLD = 10;

/** "2026-07-01T10:12:00+09:00" → "2026-07-01" (등록일은 날짜만) */
function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

interface ProductListProps {
  tab: SellerProductTab;
  sort: SellerProductSort;
  page: number; // 0-base (API 기준)
  onTabChange: (tab: SellerProductTab) => void;
  onSortChange: (sort: SellerProductSort) => void;
  onPageChange: (page: number) => void;
  /**
   * 표 헤더 고정 기준. 스크롤 컨테이너가 무엇인지는 부모만 안다 —
   * 단독 페이지는 뷰포트가 스크롤하고 그 위에 h-16 헤더가 떠 있어 "page",
   * 챗 워크스페이스는 자체 overflow-y-auto 안이라 "container" 다.
   * 생략하면 고정하지 않는다(잘못된 위치에 붙는 것보다 낫다).
   *
   * 클래스 문자열 대신 두 값으로 받는 이유: Tailwind 는 클래스명을 정적으로
   * 스캔하므로 바깥에서 조립해 넘긴 문자열은 CSS 가 생성되지 않을 수 있다.
   */
  stickyHeader?: "page" | "container";
}

/**
 * 판매자 상품 목록 — 표 + 상태 탭 + 정렬 + 페이지네이션 + 상태 처리(조회 전용).
 * 단독 페이지(ProductsPage)와 챗 워크스페이스가 공유한다. 상태는 부모가 제어한다.
 * 대상 선택은 채팅 자연어로 처리하므로 목록에 선택 UI는 두지 않는다.
 */
export function ProductList({
  tab,
  sort,
  page,
  onTabChange,
  onSortChange,
  onPageChange,
  stickyHeader,
}: ProductListProps) {
  // 복원 완료 전에 보내면 AT 없이 나가 401 → 로그인으로 튕긴다
  const isAuthReady = useAuthStore(selectIsAuthReady);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["seller", "products", { tab, sort, page }],
    queryFn: () => fetchSellerProducts({ tab, page, sort }),
    staleTime: 0,
    placeholderData: keepPreviousData,
    enabled: isAuthReady,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusTabs
          tabs={TABS.map((t) => ({ ...t, count: data?.tabCounts[t.key] }))}
          value={tab}
          onChange={onTabChange}
        />
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">정렬 기준</span>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SellerProductSort)}
            className={cn(
              "h-11 rounded-full border bg-background px-4 text-sm font-medium",
              pressable,
              "hover:[@media(hover:hover)]:border-foreground/30",
            )}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isError && (
        <SellerErrorState
          error={error}
          fallbackMessage="목록을 불러오지 못했습니다."
          onRetry={() => refetch()}
        />
      )}

      {isPending && <ProductTableSkeleton />}

      {data && data.content.length === 0 && (
        <div className="rounded-sm border py-16 text-center text-sm text-muted-foreground">
          등록된 상품이 없습니다.
        </div>
      )}

      {data && data.content.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-sm border bg-background">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                {/* 헤더 고정 — 목록이 길어도 어느 열을 보는지 잃지 않게.
                    th 에 걸어야 한다(thead·tr 은 sticky 가 먹지 않는다).
                    고정 위치는 부모가 준다(스크롤 컨테이너를 부모만 안다) —
                    안 주면 고정하지 않는다(잘못된 위치에 붙는 것보다 낫다). */}
                <tr
                  className={cn(
                    "text-xs text-muted-foreground",
                    // 헤더 배경은 불투명이어야 한다 — 반투명이면 고정된 헤더 뒤로
                    // 지나가는 행이 비쳐 글자가 겹쳐 읽힌다
                    "[&>th]:border-b [&>th]:bg-muted [&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold",
                    // 클래스는 리터럴로 적는다 — 조립하면 Tailwind 가 못 찾는다
                    stickyHeader === "page" &&
                      "[&>th]:sticky [&>th]:top-16 [&>th]:z-10",
                    stickyHeader === "container" &&
                      "[&>th]:sticky [&>th]:top-0 [&>th]:z-10",
                  )}
                >
                  <th className="text-left">상품</th>
                  <th className="text-left">카테고리</th>
                  <th className="text-right">판매가</th>
                  <th className="text-right">재고</th>
                  <th className="text-right">판매량</th>
                  <th className="text-left">등록일</th>
                  <th className="text-left">상태</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((p) => {
                  const discounted = p.originalPrice > p.price;
                  return (
                    <tr
                      key={p.productId}
                      // 행 hover — 넓은 표에서 눈이 가로로 이동할 때 줄을 놓치지 않게.
                      // 터치에는 잔상이 남으므로 게이팅한다.
                      className="border-b transition-colors duration-150 ease-out-strong last:border-0 hover:[@media(hover:hover)]:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProductImage
                            src={p.imageUrl}
                            alt=""
                            className="size-10 shrink-0 rounded-sm bg-muted object-cover"
                          />
                          <span className="min-w-0 truncate font-medium">
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {p.category}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-4 py-3 text-right",
                          numeric,
                        )}
                      >
                        <span className="font-semibold">
                          {p.price.toLocaleString("ko-KR")}원
                        </span>
                        {discounted && (
                          <span className="block text-xs text-muted-foreground line-through">
                            {p.originalPrice.toLocaleString("ko-KR")}원
                          </span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-semibold",
                          numeric,
                          p.stockQuantity <= LOW_STOCK_THRESHOLD &&
                            "text-destructive",
                        )}
                      >
                        {p.stockQuantity.toLocaleString("ko-KR")}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right text-muted-foreground",
                          numeric,
                        )}
                      >
                        {p.displayedSalesCount.toLocaleString("ko-KR")}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-4 py-3 text-muted-foreground",
                          numeric,
                        )}
                      >
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
                            STATUS_CLASS[p.displayStatus],
                          )}
                        >
                          {STATUS_LABEL[p.displayStatus]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.page + 1} // API 0-base → UI 1-base
            totalPages={data.totalPages}
            onChange={(p) => onPageChange(p - 1)} // UI 1-base → API 0-base
          />
        </>
      )}
    </div>
  );
}

function ProductTableSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-sm border p-4">
      <p className="pb-1 text-sm text-muted-foreground">
        상품 목록을 불러오는 중입니다.
      </p>
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-sm" />
      ))}
    </div>
  );
}
