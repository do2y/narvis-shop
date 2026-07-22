import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/lib/utils";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import { fetchSellerDashboard } from "./api";
import { SellerHero } from "./components/SellerHero";
import { MetricCards } from "./components/MetricCards";
import { AnalysisChart } from "./components/AnalysisChart";
import { formatMetric } from "./utils/formatMetric";

export default function DashboardPage() {
  // 복원 완료 전에 보내면 AT 없이 나가 401 → 로그인으로 튕긴다
  const isAuthReady = useAuthStore(selectIsAuthReady);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["seller", "dashboard"],
    queryFn: fetchSellerDashboard,
    staleTime: 0, // 오늘 할 일·실시간 지표 — 항상 최신
    enabled: isAuthReady,
  });

  return (
    <div className="flex flex-col gap-10 pb-16">
      <SellerHero />

      {isPending && <DashboardSkeleton />}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-sm border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            현황을 불러오지 못했어요.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="h-11 rounded-full border px-5 text-sm font-medium transition-all hover:bg-muted active:scale-95"
          >
            다시 시도
          </button>
        </div>
      )}

      {data && (
        <>
          {/* 오늘 할 일 */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">오늘 할 일</h2>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">
                  {data.todo.totalCount}건
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                실시간 업데이트
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {data.todo.orderSummaries.map((s) => (
                <Link
                  key={s.status}
                  to={`/seller/orders?status=${s.status}`}
                  className={cn(
                    "flex flex-col gap-3 rounded-sm border bg-background p-4 transition-all hover:shadow-md active:scale-[0.99] sm:p-5",
                    s.primary && "border-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      s.primary ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="text-2xl font-bold tracking-tight">
                    {s.count}건
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {s.caption}
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
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                    {data.todo.lowStock.length}
                  </span>
                </div>
                <Link
                  to="/seller/products"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  전체 보기
                </Link>
              </div>

              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.todo.lowStock.map((p) => (
                  <li
                    key={p.productId}
                    className="flex items-center gap-3 rounded-sm border p-3"
                  >
                    <img
                      src={p.imageUrl}
                      alt=""
                      loading="lazy"
                      className="size-11 shrink-0 rounded-sm bg-muted object-cover"
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {p.name}
                      </span>
                      <span className="text-xs font-semibold text-destructive">
                        남은 수량 {p.stock}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 오늘의 스토어 현황 */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-bold tracking-tight">
              오늘의 스토어 현황
            </h2>

            <MetricCards items={data.metrics} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <AnalysisChart
                  analysis={{
                    title: "매출 추이",
                    chartType: "line",
                    unit: "KRW",
                    series: [{ label: "매출", points: data.revenueTrend }],
                  }}
                />
              </div>

              {/* AI 추천 성과 */}
              <div className="flex flex-col gap-4 rounded-sm border bg-background p-4 sm:p-6">
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-bold tracking-tight">
                    AI 추천 성과
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    AI 추천으로 발생한 매출
                  </p>
                </div>

                <span className="text-3xl font-bold tracking-tight text-brand">
                  {formatMetric(data.aiRevenue.amount, "KRW")}
                </span>

                <span className="flex items-center gap-1.5 text-sm">
                  <TrendingUp className="size-4 text-brand" />
                  <span className="font-semibold text-brand">
                    +{data.aiRevenue.deltaRate}%
                  </span>
                  <span className="text-muted-foreground">지난주 대비</span>
                </span>

                <div className="mt-auto flex flex-col gap-2 border-t pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">
                      오늘 매출 기여도
                    </span>
                    <span className="text-base font-bold">
                      {data.aiRevenue.contributionRate}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={data.aiRevenue.contributionRate}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="AI 추천 매출 기여도"
                    className="h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500"
                      style={{ width: `${data.aiRevenue.contributionRate}%` }}
                    />
                  </div>
                </div>
              </div>
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
