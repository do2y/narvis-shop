"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { AlertTriangle, Check } from "lucide-react";
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

/**
 * 섹션 라벨 — 모든 섹션 제목의 유일한 크기.
 *
 * 원래 h2 가 text-xl font-bold 였는데, 그러면 제목이 그 아래 숫자만큼 굵어
 * "무엇을 먼저 볼지"를 제목이 가로챈다. 대시보드에서 시선이 멈춰야 할 곳은
 * 값이지 구획 이름이 아니라, 제목은 값을 찾아가는 이정표 크기로만 둔다.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
      {children}
    </h2>
  );
}

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
  const { from, to } = useMemo(() => trendRange(), []);

  const { data, isPending, isError, error, refetch } = useQuery({
    // 기간을 키에 넣어야 자정을 넘겼을 때 옛 기간 캐시를 그대로 쓰지 않는다
    queryKey: ["seller", "summary", from, to],
    queryFn: () => fetchSellerSummary({ from, to }),
    staleTime: 0, // 오늘 할 일·실시간 방문자 — 항상 최신
    enabled: isAuthReady,
  });

  return (
    // gap-8: 섹션 사이 간격은 각 섹션의 border-t pt-8 이 맡는다. 여기서 gap-10 을
    // 더 주면 구분선과 제목 사이가 벌어져 선이 어느 쪽 것인지 모호해진다.
    <div className="flex flex-col gap-8 pb-16">
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
          {/* 오늘의 스토어 현황 — 오늘 하루의 요약 숫자라 기간 집계(AI 경유 매출·
              매출 추이)보다 먼저 온다. "지금 무슨 일이 있었나"를 먼저 답하고,
              추세는 그 다음이다.
              제목을 라벨 크기로 낮춘 이유: 아래 매출 숫자가 이 화면의 주인공이라
              제목이 그보다 크면 시선이 제목에서 먼저 멈춘다. */}
          <section className="flex flex-col gap-5">
            <SectionLabel>오늘의 스토어 현황</SectionLabel>
            <MetricCards items={toMetrics(data.today)} />
          </section>

          {/* 매출 현황 — 기간 집계(AI 경유 매출 + 추이).
              위 블록과 선으로 가른다 — 오늘(스냅샷)과 최근 7일(추세)은 성격이 다른
              숫자라, 여백만으로는 같은 묶음으로 읽힌다.
              높이는 grid 기본값(stretch)으로 둘을 맞춘다 — items-start 로 두면
              짧은 카드 아래에 빈 공간이 남아 두 박스가 어긋나 보인다.
              minmax(0,1fr): 차트 열이 콘텐츠 폭에 밀려 넘치지 않게. */}
          <section className="flex flex-col gap-5 border-t pt-8">
            <SectionLabel>최근 {TREND_DAYS}일 매출</SectionLabel>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
              {/* 이 가드 하나가 곧 실패 처리다 — 집계 실패로 블록이 null 이면 카드가 빠지고
                  그리드 첫 칸이 사라지며 차트가 자동으로 전폭이 된다. 별도 에러 UI 불필요. */}
              {data.aiAttribution && (
                <AiAttributionCard data={data.aiAttribution} />
              )}

              {/* bare: 바깥이 이미 섹션으로 갈려 있어 테두리를 또 두르면 상자 안의 상자가 된다 */}
              <AnalysisChart
                compact
                bare
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

          {/* 오늘 할 일 — 유일하게 "눌러서 처리하는" 구역이라 위 두 섹션(읽는 숫자)과
              선으로 가른다 */}
          <section className="flex flex-col gap-5 border-t pt-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SectionLabel>오늘 할 일</SectionLabel>
                {/* 처리할 일이 있을 때만 배지가 눈에 띈다 — 0건에도 같은 톤이면
                    "할 일 있음"으로 잘못 읽힌다 */}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    numeric,
                    data.orderStatus.activeTotal > 0
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {data.orderStatus.activeTotal}건
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                실시간 업데이트
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {TODO_CARDS.map((c) => {
                const count = data.orderStatus.counts[c.status] ?? 0;
                // 0건이면 눌러도 빈 목록이다 — 같은 무게로 두면 처리할 일이 있는
                // 타일과 구분이 안 된다. 숫자를 흐리게 내려 "여긴 볼 것 없다"를
                // 한눈에 읽히게 한다. 타일 자체는 남긴다 — 자리가 고정돼야 다음에 찾기 쉽다.
                const idle = count === 0;
                // 처리 대기(신규 주문)가 실제로 쌓였을 때만 강조한다
                const urgent = c.primary && !idle;

                return (
                  <Link
                    key={c.status}
                    href={`/seller/orders?status=${c.status}`}
                    className={cn(
                      // 테두리 대신 배경톤 — 누를 수 있는 면이라는 것만 전하면 된다
                      "flex items-baseline justify-between gap-3 rounded-sm p-4",
                      pressableCard,
                      // hover 는 두 갈래 모두에 준다 — 한쪽만 반응하면 같은 줄의
                      // 타일인데 누를 수 있는지 여부가 달라 보인다
                      urgent
                        ? "bg-foreground text-background hover:[@media(hover:hover)]:bg-foreground/90"
                        : "bg-muted/50 hover:[@media(hover:hover)]:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium",
                        urgent ? "text-background/80" : "text-muted-foreground",
                      )}
                    >
                      {c.label}
                    </span>
                    <span
                      className={cn(
                        "text-2xl font-bold tracking-tight",
                        numeric,
                        idle && "text-muted-foreground/40",
                      )}
                    >
                      {count}
                      <span className="ml-0.5 text-sm font-medium">건</span>
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* 재고 부족 알림 — 이 화면에서 유일하게 "조치가 필요한" 항목이라
                destructive 톤으로 따로 세운다. 단, 0건이면 경고가 아니라
                정상 상태이므로 톤을 걷어 조용히 알린다(항상 빨가면 경고가 무뎌진다). */}
            {data.lowStock.items.length === 0 ? (
              <p className="flex items-center gap-2 rounded-sm bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                <Check className="size-4 shrink-0" />
                재고가 부족한 상품이 없어요.
              </p>
            ) : (
              <div className="flex flex-col gap-3 rounded-sm border-l-2 border-l-destructive bg-destructive/5 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-destructive" />
                    <h3 className="text-sm font-semibold text-destructive">
                      재고 부족
                    </h3>
                    <span className={cn("text-sm text-destructive/70", numeric)}>
                      {data.lowStock.count}건
                    </span>
                  </div>
                  <Link
                    href="/seller/products"
                    className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:text-foreground hover:[@media(hover:hover)]:underline"
                  >
                    전체 보기
                  </Link>
                </div>

                {/* 카드 격자 대신 구분선 리스트 — 상품명·남은 수량 2개뿐이라
                    칸을 나눌 이유가 없다. 행이 얇아져 한 번에 더 많이 보인다 */}
                <ul className="flex flex-col divide-y divide-destructive/10">
                  {data.lowStock.items.map((p) => (
                    <li
                      key={p.productId}
                      className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <ProductImage
                        src={p.imageUrl}
                        alt=""
                        className="size-9 shrink-0 rounded-sm bg-muted object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {p.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold text-destructive",
                          numeric,
                        )}
                      >
                        {p.stockQuantity}개 남음
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    // 구조·간격을 실제 화면과 같게 둔다 — 다르면 데이터가 도착하는 순간 블록이 뛴다.
    // 오늘의 스토어 현황(히어로 + 보조 3) → 최근 7일 매출 → 오늘 할 일
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
        <Skeleton className="h-4 w-32 rounded-full" />
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* 히어로 지표 — 실제 화면의 text-4xl/5xl 자리 */}
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

      <section className="flex flex-col gap-5 border-t pt-8">
        <Skeleton className="h-4 w-28 rounded-full" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          <Skeleton className="h-36 rounded-sm" />
          <Skeleton className="h-36 rounded-sm" />
        </div>
      </section>

      <section className="flex flex-col gap-5 border-t pt-8">
        <Skeleton className="h-4 w-20 rounded-full" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] rounded-sm" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-sm" />
      </section>
    </div>
  );
}