"use client";

import { useId } from "react";
import type { SellerReportChart } from "@/shared/types/chat";
import type { SellerAnalysis } from "../types";
import { formatMetric } from "../utils/formatMetric";

// x축 라벨 최대 개수. 리포트 차트는 한 달치(31점)가 오는데 전부 찍으면
// 글자가 겹쳐 읽을 수 없다 — 균등 간격으로 솎아낸다(대시보드 7점은 그대로 다 나온다).
const MAX_X_LABELS = 10;

// viewBox 좌표계 — 실제 크기는 CSS가 결정한다.
// preserveAspectRatio="none" 으로 좌표계를 컨테이너에 꽉 채운다. 기본값(비율 유지)이면
// 컨테이너가 528px(=44rem, h-44 기준 3:1 비율의 폭)를 넘는 순간 그림만 528px 에 고정돼
// 가운데 정렬되는데, x축 라벨은 컨테이너 폭 기준으로 절대 배치돼 둘이 어긋난다.
// 대신 스케일이 비균등해지므로 선·점은 non-scaling 처리가 필요하다(아래 참조).
const W = 600;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 24, left: 12 };

/**
 * 판매 분석 그래프 — line/bar.
 * 차트 라이브러리 없이 인라인 SVG로 직접 구현(도메인 컴포넌트, CLAUDE.md).
 * 시각 요소는 보조 수단이므로 값은 표로도 함께 노출한다(스크린리더·색 구분 불가 사용자).
 */
export function AnalysisChart({
  analysis,
}: {
  // 대시보드(SellerAnalysis)와 리포트(SellerReportChart)가 같은 형태를 쓴다.
  // 후자는 계약 타입이라 shared 에 있다(shared → features 역참조 금지).
  analysis: SellerAnalysis | SellerReportChart;
}) {
  const gradientId = useId();
  const { series, chartType, unit } = analysis;
  const points = series[0]?.points ?? [];

  if (points.length === 0) return null;

  const max = Math.max(...points.map((p) => p.y));
  const min = Math.min(0, ...points.map((p) => p.y));
  const span = max - min || 1;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left +
    (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1));
  const y = (v: number) => PAD.top + innerH - ((v - min) / span) * innerH;

  const line = points.map((p, i) => `${x(i)},${y(p.y)}`).join(" ");
  const area = `M${x(0)},${PAD.top + innerH} L${line.split(" ").join(" L")} L${x(points.length - 1)},${PAD.top + innerH} Z`;

  const total = points.reduce((sum, p) => sum + p.y, 0);

  // 라벨을 몇 개 걸러 찍을지 — 31점이면 4칸마다(8개), 7점이면 전부.
  const labelStep = Math.ceil(points.length / MAX_X_LABELS);

  return (
    <section className="flex flex-col gap-4 rounded-sm border bg-background p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold tracking-tight">{analysis.title}</h3>
        <span className="text-sm text-muted-foreground">
          합계{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatMetric(total, unit)}
          </span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
        aria-label={`${analysis.title} ${chartType === "line" ? "선" : "막대"} 그래프`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              stopColor="currentColor"
              stopOpacity="0.18"
              className="text-brand"
            />
            <stop
              offset="1"
              stopColor="currentColor"
              stopOpacity="0"
              className="text-brand"
            />
          </linearGradient>
        </defs>

        {/* 가로 기준선 */}
        {[0, 0.5, 1].map((r) => (
          <line
            key={r}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + innerH * r}
            y2={PAD.top + innerH * r}
            className="stroke-border"
            strokeWidth="1"
          />
        ))}

        {chartType === "bar"
          ? points.map((p, i) => {
              const bw = Math.max(6, (innerW / points.length) * 0.5);
              return (
                <rect
                  key={p.x}
                  x={x(i) - bw / 2}
                  y={y(p.y)}
                  width={bw}
                  height={PAD.top + innerH - y(p.y)}
                  // rx 를 두면 비균등 스케일에서 모서리가 가로로만 늘어나 찌그러진다
                  className="fill-brand"
                />
              );
            })
          : (
            <>
              <path d={area} fill={`url(#${gradientId})`} />
              {/* vector-effect: 비균등 스케일에서 선 굵기가 가로로만 늘어나는 걸 막는다 */}
              <polyline
                points={line}
                fill="none"
                className="stroke-brand"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {/* 마지막 점 마커 — circle 은 비균등 스케일에서 타원으로 찌그러진다.
                  획만 남기고 채움을 stroke 로 옮겨 vector-effect 로 원형을 유지한다. */}
              <circle
                cx={x(points.length - 1)}
                cy={y(points[points.length - 1].y)}
                r="0.01"
                fill="none"
                className="stroke-brand"
                strokeWidth="8"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
      </svg>

      {/* 라벨은 점 위치에 맞춰 절대 배치한다 — justify-between 은 솎아낸 뒤
          남은 라벨을 균등 분배해 버려서 실제 데이터 위치와 어긋난다 */}
      <div className="relative h-4 text-xs tabular-nums text-muted-foreground">
        {points.map((p, i) =>
          labelStep === 1 || i % labelStep === 0 ? (
            <span
              key={p.x}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              // viewBox 좌표를 폭 비율로 환산 — SVG 와 같은 x 를 쓰므로 항상 정렬된다
              style={{ left: `${(x(i) / W) * 100}%` }}
            >
              {p.x}
            </span>
          ) : null,
        )}
      </div>

      {analysis.summary && (
        <p className="rounded-sm bg-muted/60 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
          {analysis.summary}
        </p>
      )}
    </section>
  );
}
