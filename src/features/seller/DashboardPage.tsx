"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import { ProductImage } from "@/shared/ui/ProductImage";
import { cn } from "@/lib/utils";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import { fetchSellerSummary } from "./api";
import { numeric, pressableCard } from "./interaction";
import type { SellerOrderStatus, SellerSummary } from "./types";
import { SellerHero } from "./components/SellerHero";
import { SellerErrorState } from "./components/SellerErrorState";
import { MetricCards } from "./components/MetricCards";
import { AnalysisChart } from "./components/AnalysisChart";
import { AiAttributionCard } from "./components/AiAttributionCard";
import type { SellerMetric } from "./types";

// 매출 추이 차트가 쓰는 서버 기본값(trendDays=7)과 같은 창을 aiAttribution 에도 준다.
// 어긋나면 "전체 매출의 N%"의 분모만 다른 기간이 되는데, 카드에 기간 라벨이 없어
// 판매자는 그걸 알 방법이 없다.
const TREND_DAYS = 7;

// 오늘 할 일 4칸 — 처리해야 할 순서대로. CANCELLED·RETURNED는 활성 주문이 아니라 제외.
// (구 "배송 준비" 카드는 order_item.status에 PREPARING이 없어 2026-07-21자로 삭제)
const TODO_CARDS: {
  status: SellerOrderStatus;
  label: string;
  primary?: boolean;
}[] = [
  { status: "ORDERED", label: "신규 주문", primary: true },
  { status: "SHIPPING", label: "배송 중" },
  { status: "DELIVERED", label: "배송 완료" },
  { status: "CONFIRMED", label: "구매 확정" },
];

/** 응답의 today 블록 → 지표 카드 4장 */
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

/** "2026-07-15" → "7/15" — 추이 차트 x축은 좁아서 연도를 뺀다 */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : iso;
}

export default function DashboardPage() {
  // 복원 완료 전에 보내면 AT 없이 나가 401 → 로그인으로 튕긴다
  const isAuthReady = useAuthStore(selectIsAuthReady);

  // 마운트 시점에 한 번 고정한다 — 렌더마다 새로 만들면 queryKey 가 흔들려 재조회가 돈다
  const { from, to } = useMemo(trendRange, []);

  const { data, isPending, isError, error, refetch } = useQuery({
    // 기간을 키에 넣어야 자정을 넘겼을 때 옛 기간 캐시를 그대로 쓰지 않는다
    queryKey: ["seller", "summary", from, to],
    queryFn: () => fetchSellerSummary({ from, to }),
    staleTime: 0, // 오늘 할 일·실시간 방문자 — 항상 최신
    enabled: isAuthReady,
  });

  return (
    <div className="flex flex-col gap-10 pb-16">
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
          {/* 오늘 할 일 */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">오늘 할 일</h2>
                <span
                  className={cn(
                    "rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold text-muted-foreground",
                    numeric,
                  )}
                >
                  {data.orderStatus.activeTotal}건
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                실시간 업데이트
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {TODO_CARDS.map((c) => (
                <Link
                  key={c.status}
                  href={`/seller/orders?status=${c.status}`}
                  className={cn(
                    "flex flex-col gap-3 rounded-sm border bg-background p-4 sm:p-5",
                    pressableCard,
                    "hover:[@media(hover:hover)]:shadow-md",
                    c.primary && "border-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      c.primary ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {c.label}
                  </span>
                  <span
                    className={cn(
                      "text-2xl font-bold tracking-tight",
                      numeric,
                    )}
                  >
                    {data.orderStatus.counts[c.status] ?? 0}건
                  </span>
                  {/* 배송 중 카드에만 평균 배송일 — 나머지는 붙일 지표가 없다.
                      표본(배송 완료 건)이 없으면 null 이라 문구를 숨긴다 —
                      그대로 넣으면 "평균 배송 null일"로 렌더된다. */}
                  <span className="text-sm text-muted-foreground">
                    {c.status === "SHIPPING" &&
                    data.orderStatus.avgDeliveryDays !== null
                      ? `평균 배송 ${data.orderStatus.avgDeliveryDays}일`
                      : " "}
                  </span>
                </Link>
              ))}
            </div>

            {/* 재고 부족 알림 */}
            <div className="flex flex-col gap-4 rounded-sm border bg-background p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive" />
                  <h3 className="text-base font-bold tracking-tight">
                    재고 부족 알림
                  </h3>
                  <span
                    className={cn(
                      "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive",
                      numeric,
                    )}
                  >
                    {data.lowStock.count}
                  </span>
                </div>
                <Link
                  href="/seller/products"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:text-foreground hover:[@media(hover:hover)]:underline"
                >
                  전체 보기
                </Link>
              </div>

              {data.lowStock.items.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  재고가 부족한 상품이 없어요.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.lowStock.items.map((p) => (
                    <li
                      key={p.productId}
                      className="flex items-center gap-3 rounded-sm border p-3"
                    >
                      <ProductImage
                        src={p.imageUrl}
                        alt=""
                        className="size-11 shrink-0 rounded-sm bg-muted object-cover"
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {p.name}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold text-destructive",
                            numeric,
                          )}
                        >
                          남은 수량 {p.stockQuantity}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* 오늘의 스토어 현황 */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-bold tracking-tight">
              오늘의 스토어 현황
            </h2>

            <MetricCards items={toMetrics(data.today)} />

            {/* items-start: 카드가 차트보다 짧아 늘어나지 않게.
                minmax(0,1fr): 차트 열이 콘텐츠 폭에 밀려 넘치지 않게. */}
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              {/* 이 가드 하나가 곧 실패 처리다 — 집계 실패로 블록이 null 이면 카드가 빠지고
                  그리드 첫 칸이 사라지며 차트가 자동으로 전폭이 된다. 별도 에러 UI 불필요. */}
              {data.aiAttribution && (
                <AiAttributionCard data={data.aiAttribution} />
              )}

              <AnalysisChart
                analysis={{
                  title: `매출 추이 · 합계 ${data.salesTrend.total.toLocaleString("ko-KR")}원`,
                  chartType: "line",
                  unit: "KRW",
                  series: [
                    {
                      label: "매출",
                      points: data.salesTrend.points.map((p) => ({
                        x: shortDate(p.date),
                        y: p.sales,
                      })),
                    },
                  ],
                }}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-sm border p-5">
            <Skeleton className="h-3 w-1/2 rounded-full" />
            <Skeleton className="h-6 w-2/3 rounded-full" />
            <Skeleton className="h-3 w-1/3 rounded-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-40 rounded-sm" />
      <Skeleton className="h-64 rounded-sm" />
    </div>
  );
}