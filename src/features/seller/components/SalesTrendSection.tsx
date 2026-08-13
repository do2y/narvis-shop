"use client";

import { cn } from "@/lib/utils";
import { numeric } from "../interaction";
import type { SellerAiAttribution, SellerSummary } from "../types";
import { AnalysisChart } from "./AnalysisChart";
import { SectionHeading } from "./SectionHeading";

/** "2026-07-15" → "7/15" — 추이 차트 x축은 좁아서 연도를 뺀다 */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : iso;
}

/**
 * 매출 추이 — 차트와 AI 경유 비중을 **하나의 분석 영역**으로 묶는다.
 *
 * 종전에는 좁은 "AI 추천 경유 매출" 카드와 넓은 차트가 좌우로 갈려 있어 서로 다른
 * 이야기처럼 보였고, AI 카드가 배경톤·브랜드선을 달고 홍보물처럼 읽혔다.
 * 여기서는 합계를 머리에 두고 AI 몫은 그 아래 **범례 한 줄**로 내린다 —
 * 전체 매출과 비교되는 보조 지표라는 관계가 위치로 드러난다.
 */
export function SalesTrendSection({
  salesTrend,
  aiAttribution,
  trendDays,
}: {
  salesTrend: SellerSummary["salesTrend"];
  aiAttribution: SellerAiAttribution | null;
  trendDays: number;
}) {
  const points = salesTrend.points;
  // 값이 하나도 없거나 전부 0이면 차트는 바닥에 붙은 선 한 줄이 된다 —
  // 그건 "데이터 없음"을 알려주지 못하고 화면이 고장난 것처럼 보인다.
  const allZero = points.length === 0 || points.every((p) => p.sales === 0);

  return (
    <section className="flex flex-col gap-5">
      <SectionHeading
        title={`최근 ${trendDays}일 매출`}
        // 합계는 제목에 딸린 요약이다 — 종전엔 text-lg font-bold 라 제목보다
        // 강해서 눈이 숫자에 먼저 멈췄다. 제목과 같은 크기·한 단 낮은 굵기로 맞춘다.
        action={
          <p className={cn("text-base font-medium", numeric)}>
            {salesTrend.total.toLocaleString("ko-KR")}
            <span className="ml-0.5 text-sm text-muted-foreground">원</span>
          </p>
        }
      />

      {allZero ? (
        <div className="flex flex-col items-center gap-1 rounded-sm border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">
            아직 집계된 매출이 없어요
          </p>
          <p className="text-xs text-muted-foreground">
            주문이 들어오면 이 자리에 추이가 그려집니다
          </p>
        </div>
      ) : (
        <AnalysisChart
          compact
          bare
          analysis={{
            // 합계는 위 머리글이 이미 말했다 — 차트 제목에 또 얹지 않는다.
            // 빈 문자열로 두지 않는 이유: 이 값이 svg 의 aria-label 에도 들어가
            // 스크린리더가 "  선 그래프"로 읽는다.
            title: "일별 매출",
            chartType: "line",
            unit: "KRW",
            series: [
              {
                label: "매출",
                points: points.map((p) => ({
                  x: shortDate(p.date),
                  y: p.sales,
                })),
              },
            ],
          }}
        />
      )}

      {/* AI 경유 비중 — 차트 아래 범례 줄.
          집계 실패(null)면 이 줄만 빠지고 차트는 그대로다. */}
      {aiAttribution && <AiShareLegend data={aiAttribution} />}
    </section>
  );
}

/**
 * AI 경유 매출 — 전체 매출과 비교되는 보조 지표.
 *
 * "경유"를 붙이는 이유: 이 지표는 기여도(어느 매출이 AI 를 거쳤나)이지
 * 증분(AI 가 없었다면 얼마였나)이 아니다. 줄이면 "AI 가 만든 매출"로 읽힌다.
 */
function AiShareLegend({ data }: { data: SellerAiAttribution }) {
  const total = data.aiSales + data.directSales;
  // 폭은 aiShare 가 아니라 여기서 계산한다 — aiShare 는 분모 0이면 null 이라
  // width 에 넣으면 바가 통째로 사라진다.
  const aiPct = total > 0 ? (data.aiSales / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-border">
        <div className="bg-brand" style={{ width: `${aiPct}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-sm bg-brand" aria-hidden />
          <span className="text-muted-foreground">AI 추천 경유</span>
          <b className={cn("font-semibold", numeric)}>
            {data.aiSales.toLocaleString("ko-KR")}원
          </b>
          <span className={cn("text-muted-foreground", numeric)}>
            {/* null 은 0%가 아니라 계산 불가 — 지표 카드의 증감률과 같은 표기 */}
            ({data.aiShare === null ? "—" : `${data.aiShare}%`})
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-sm bg-muted-foreground/30"
            aria-hidden
          />
          <span className="text-muted-foreground">직접 유입</span>
          <b className={cn("font-semibold", numeric)}>
            {data.directSales.toLocaleString("ko-KR")}원
          </b>
        </span>
      </div>
    </div>
  );
}
