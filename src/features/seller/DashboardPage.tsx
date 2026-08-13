"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/shared/ui/skeleton";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import { fetchSellerSummary } from "./api";
import type { SellerMetric, SellerSummary } from "./types";
import { SellerErrorState } from "./components/SellerErrorState";
import { MetricCards } from "./components/MetricCards";
import { SalesTrendSection } from "./components/SalesTrendSection";
import { TodoSection } from "./components/TodoSection";
import { LowStockSection } from "./components/LowStockSection";
import { SectionBadge, SectionHeading } from "./components/SectionHeading";
import { SellerHero } from "./components/SellerHero";

// 매출 추이 차트가 쓰는 서버 기본값(trendDays=7)과 같은 창을 aiAttribution 에도 준다.
// 어긋나면 "전체 매출의 N%"의 분모만 다른 기간이 되는데, 판매자는 그걸 알 방법이 없다.
const TREND_DAYS = 7;

/** 응답의 today 블록 → 지표 4종 */
function toMetrics(today: SellerSummary["today"]): SellerMetric[] {
  return [
    {
      key: "revenue",
      label: "오늘 매출",
      value: today.sales,
      unit: "KRW",
      // null(어제 매출 0)이면 카드가 "— 어제 대비"로 표기한다. undefined로 바꾸지 말 것 —
      // undefined는 "증감률 개념 없음"이라 줄이 통째로 사라진다(방문자 카드와 혼동).
      deltaRate: today.salesChangeRate,
      caption: "어제 대비",
    },
    {
      key: "orders",
      label: "주문 건수",
      value: today.orderCount,
      unit: "COUNT",
      deltaRate: today.orderCountChangeRate,
      caption: "어제 대비",
    },
    {
      key: "aov",
      label: "객단가",
      value: today.avgOrderValue,
      unit: "KRW",
      deltaRate: today.avgOrderValueChangeRate,
      caption: "어제 대비",
    },
    {
      key: "visitors",
      label: "실시간 방문자",
      value: today.activeVisitors,
      unit: "COUNT",
      caption: "최근 30분",
    },
  ];
}

/**
 * Date → "YYYY-MM-DD" (로컬 기준).
 * toISOString() 을 쓰면 UTC 로 변환돼 KST 오전 9시 이전에는 하루 전 날짜가 나온다.
 */
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 추이 차트와 같은 창(오늘 포함 최근 TREND_DAYS일)의 from·to */
function trendRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (TREND_DAYS - 1));
  return { from: ymd(from), to: ymd(to) };
}

/**
 * 판매자 대시보드.
 *
 * 맨 위에 AI 진입 히어로를 두고, 그 아래를 업무 흐름 순서로 읽게 한다:
 *   ① 핵심 운영 현황(오늘 얼마 벌었나) → ② 매출 추이(흐름은 어떤가)
 *   → ③ 오늘 처리할 일(무엇을 해야 하나) → ④ 재고 부족(무엇이 급한가)
 */
export default function DashboardPage() {
  // 복원 완료 전에 보내면 AT 없이 나가 401 → 로그인으로 튕긴다
  const isAuthReady = useAuthStore(selectIsAuthReady);

  // 마운트 시점에 한 번 고정한다 — 렌더마다 새로 만들면 queryKey 가 흔들려 재조회가 돈다
  const { from, to } = useMemo(() => trendRange(), []);

  const { data, isPending, isError, error, refetch } = useQuery({
    // 기간을 키에 넣어야 자정을 넘겼을 때 옛 기간 캐시를 그대로 쓰지 않는다
    queryKey: ["seller", "summary", from, to],
    queryFn: () => fetchSellerSummary({ from, to }),
    staleTime: 0, // 오늘 할 일·실시간 방문자 — 항상 최신
    enabled: isAuthReady,
  });

  return (
    // max-w-5xl: 종전에는 셸의 6xl 을 그대로 써 지표 사이가 과하게 벌어졌다.
    // 폭을 좁히면 같은 값이 더 촘촘히 읽힌다.
    // pt 를 따로 두지 않는다 — 히어로가 자체 py-7/9 를 갖고 있어 두 겹이 된다.
    // 섹션 사이 리듬은 gap-8(모바일 gap-10 은 과하다)과 각 섹션의 border-t pt-8 이
    // 함께 만든다. pb 는 마지막 블록이 화면 밑단에 붙지 않을 만큼만.
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-20 sm:pb-24">
      <h1 className="sr-only">판매자 대시보드</h1>

      {/* AI 진입 히어로 — 데이터를 기다리지 않는다. 조회가 실패해도 질문은 할 수 있어야 하고,
          로딩 중 이 자리가 비면 아래 블록이 도착하면서 화면이 통째로 밀린다. */}
      <SellerHero />

      {isPending && <DashboardSkeleton />}

      {isError && (
        <SellerErrorState
          error={error}
          fallbackMessage="현황을 불러오지 못했어요."
          onRetry={() => refetch()}
        />
      )}

      {data && (
        <>
          {/* ① 핵심 운영 현황 — 오늘 하루의 요약. 기간 집계보다 먼저 온다 */}
          <section className="flex flex-col gap-5 border-t pt-8">
            <SectionHeading title="오늘의 스토어 현황" />
            <MetricCards items={toMetrics(data.today)} />
          </section>

          {/* ② 매출 추이 — 오늘(스냅샷)과 최근 7일(추세)은 성격이 달라 선으로 가른다 */}
          <div className="border-t pt-8">
            <SalesTrendSection
              salesTrend={data.salesTrend}
              aiAttribution={data.aiAttribution}
              trendDays={TREND_DAYS}
            />
          </div>

          {/* ③ 오늘 처리할 일 — 여기부터는 "읽는 숫자"가 아니라 "누르는 것" */}
          <div className="border-t pt-8">
            <TodoSection orderStatus={data.orderStatus} />
          </div>

          {/* ④ 재고 부족 — 조치가 필요한 항목 */}
          <section className="flex flex-col gap-5 border-t pt-8">
            <SectionHeading
              title="재고 부족 상품"
              trailing={
                data.lowStock.count > 0 ? (
                  <SectionBadge>
                    {/* count 는 상품 수가 아니라 재고 부족인 "옵션 수"다(2026-08-09) */}
                    <span className="font-semibold text-foreground tabular-nums">
                      {data.lowStock.count}
                    </span>
                    개 옵션
                  </SectionBadge>
                ) : undefined
              }
            />
            <LowStockSection
              items={data.lowStock.items}
              threshold={data.lowStock.threshold}
            />
          </section>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    // 구조·간격을 실제 화면과 같게 둔다 — 다르면 데이터가 도착하는 순간 블록이 뛴다.
    <div className="flex flex-col gap-8">
      {/* 상단 AI 도우미는 데이터와 무관하게 이미 그려져 있다 —
          스켈레톤은 그 아래(오늘의 현황)부터 시작한다 */}
      <section className="flex flex-col gap-4 border-t pt-8">
        <Skeleton className="h-4 w-24 rounded-full" />
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <div className="flex flex-col gap-2 lg:w-[280px] lg:shrink-0">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-11 w-48 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-full" />
          </div>
          <div className="grid flex-1 grid-cols-1 gap-x-8 gap-y-6 border-t pt-6 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t pt-8">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-28 rounded-sm" />
      </section>

      <section className="flex flex-col gap-4 border-t pt-8">
        <Skeleton className="h-4 w-24 rounded-full" />
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-sm" />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t pt-8">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-40 rounded-sm" />
      </section>
    </div>
  );
}
