import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/lib/utils";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import { fetchSellerSummary } from "./api";
import type { SellerOrderStatus, SellerSummary } from "./types";
import { SellerHero } from "./components/SellerHero";
import { MetricCards } from "./components/MetricCards";
import { AnalysisChart } from "./components/AnalysisChart";
import type { SellerMetric } from "@/shared/types/chat";

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

/** "2026-07-15" → "7/15" — 추이 차트 x축은 좁아서 연도를 뺀다 */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : iso;
}

export default function DashboardPage() {
  // 복원 완료 전에 보내면 AT 없이 나가 401 → 로그인으로 튕긴다
  const isAuthReady = useAuthStore(selectIsAuthReady);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["seller", "summary"],
    queryFn: () => fetchSellerSummary(),
    staleTime: 0, // 오늘 할 일·실시간 방문자 — 항상 최신
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
                  to={`/seller/orders?status=${c.status}`}
                  className={cn(
                    "flex flex-col gap-3 rounded-sm border bg-background p-4 transition-all hover:shadow-md active:scale-[0.99] sm:p-5",
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
                  <span className="text-2xl font-bold tracking-tight">
                    {data.orderStatus.counts[c.status] ?? 0}건
                  </span>
                  {/* 배송 중 카드에만 평균 배송일 — 나머지는 붙일 지표가 없다 */}
                  <span className="text-sm text-muted-foreground">
                    {c.status === "SHIPPING"
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
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                    {data.lowStock.count}
                  </span>
                </div>
                <Link
                  to="/seller/products"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
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