import { cn } from "@/lib/utils";
import { numeric } from "../interaction";
import type { SellerAiAttribution } from "../types";
import { formatMetric } from "../utils/formatMetric";

/**
 * AI 추천 경유 매출 카드 — 매출 추이 차트 왼쪽.
 *
 * 표시는 금액·비율·구성비 3종뿐이다. 확정/추정 분리와 추천 퍼널은 응답에 오지만
 * 카드를 작게 유지하기로 해 싣지 않는다.
 *
 * 제목이 "AI 추천 매출"이 아니라 "경유"가 붙는 이유: 이 지표는 기여도(어느 매출이
 * AI를 거쳤는가)이지 증분(AI가 없었다면 얼마였는가)이 아니다. 줄이면 판매자가
 * "AI가 만들어낸 매출"로 읽는다.
 */
export function AiAttributionCard({ data }: { data: SellerAiAttribution }) {
  // 스택바 폭은 aiShare 가 아니라 여기서 직접 계산한다 —
  // aiShare 는 분모 0이면 null 이라 width 에 넣으면 바가 통째로 사라진다.
  const total = data.aiSales + data.directSales;
  const aiPct = total > 0 ? (data.aiSales / total) * 100 : 0;

  return (
    // 테두리 상자 대신 배경톤(muted/40)으로 영역을 잡는다 — 옆의 추이 차트는
    // 배경 없는 평면이라, 톤 차이만으로 "AI 몫"이 따로 읽힌다.
    // 왼쪽 brand 선은 남긴다: 이 화면에서 AI 기능을 가리키는 유일한 표식이다.
    <section className="flex flex-col gap-3 rounded-sm border-l-2 border-l-brand bg-muted/40 p-4 sm:p-5">
      {/* 값이 주인공이라 제목은 한 단 내린다 — 같은 무게면 시선이 갈린다.
          (한글이라 uppercase·wide tracking 은 쓰지 않는다 — 자간만 벌어져 읽기 나빠진다) */}
      <h3 className="text-sm font-medium text-muted-foreground">
        AI 추천 경유 매출
      </h3>

      <div>
        {/* 큰 숫자일수록 자간이 벌어져 보인다 — 행간을 좁혀 금액 덩어리가
            하나로 읽히게 한다(작은 본문은 건드리지 않는다).
            오늘 매출(text-4xl~5xl)보다 한 단 작게 둔다 — 기간 집계라 오늘 숫자보다
            뒤에 읽혀야 한다 */}
        <p
          className={cn(
            "text-2xl font-bold leading-tight tracking-tight",
            numeric,
          )}
        >
          {formatMetric(data.aiSales, "KRW")}
        </p>
        <p className="text-sm text-muted-foreground">
          전체 매출의{" "}
          <span className={cn("font-bold text-brand", numeric)}>
            {/* null 은 0%가 아니라 계산 불가 — 지표 카드의 증감률과 같은 표기로 맞춘다 */}
            {data.aiShare === null ? "—" : `${data.aiShare}%`}
          </span>
        </p>
      </div>

      {/* mt-auto: 차트와 높이를 맞추느라 카드가 늘어날 때 남는 공간을 여기서 흡수한다.
          안 주면 여백이 항목 사이사이로 갈려 들어가 요소가 흩어져 보인다.
          트랙은 border 톤 — 카드 배경이 muted/40 이라 bg-muted 로는 바가 안 보인다 */}
      <div className="mt-auto flex h-2 overflow-hidden rounded-full bg-border">
        <div className="bg-brand" style={{ width: `${aiPct}%` }} />
      </div>

      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-brand" />
          AI 경유{" "}
          <b className={cn("font-semibold text-foreground", numeric)}>
            {data.aiSales.toLocaleString("ko-KR")}
          </b>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-muted-foreground/30" />
          직접{" "}
          <b className={cn("font-semibold text-foreground", numeric)}>
            {data.directSales.toLocaleString("ko-KR")}
          </b>
        </span>
      </div>
    </section>
  );
}
