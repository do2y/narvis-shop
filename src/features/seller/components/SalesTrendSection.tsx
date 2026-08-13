"use client";

import type { SellerAiAttribution, SellerSummary } from "../types";
import { AiAttributionCard } from "./AiAttributionCard";
import { AnalysisChart } from "./AnalysisChart";
import { SectionHeading } from "./SectionHeading";

/** "2026-07-15" → "7/15" — 추이 차트 x축은 좁아서 연도를 뺀다 */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : iso;
}

/**
 * 매출 추이 — AI 성과 카드(좌) + 추이 차트(우).
 *
 * AI 경유 매출을 차트 아래 범례 한 줄로 내려 본 적이 있는데, 그러면 이 서비스의
 * 성과 지표가 눈에 걸리지 않는다. 별도 카드로 세워 금액·비율·구성비를 함께 보여준다.
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
      <SectionHeading title={`최근 ${trendDays}일 매출`} />

      {/* AI 성과 카드 + 추이 차트를 좌우로 나란히 둔다 — AI 경유 매출은 이 서비스의
          성과 지표라 차트 아래 범례 한 줄로 흘리면 눈에 걸리지 않는다.
          집계 실패(null)면 카드가 빠지고 그리드 첫 칸이 사라지며 차트가 전폭이 된다
          — 이 가드 하나가 곧 실패 처리다(별도 에러 UI 불필요).
          minmax(0,1fr): 차트 열이 콘텐츠 폭에 밀려 넘치지 않게. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
        {aiAttribution && <AiAttributionCard data={aiAttribution} />}

        {allZero ? (
          <div className="flex flex-col items-center justify-center gap-1 rounded-sm border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 집계된 매출이 없어요
            </p>
            <p className="text-xs text-muted-foreground">
              주문이 들어오면 이 자리에 추이가 그려집니다
            </p>
          </div>
        ) : (
          // bare: 바깥이 이미 섹션으로 갈려 있어 테두리를 또 두르면 상자 안의 상자가 된다
          <AnalysisChart
            compact
            bare
            analysis={{
              title: `매출 추이 · 합계 ${salesTrend.total.toLocaleString("ko-KR")}원`,
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
      </div>
    </section>
  );
}

