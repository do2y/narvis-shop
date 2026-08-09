import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { numeric } from "../interaction";
import type { SellerMetric } from "../types";
import { formatMetric } from "../utils/formatMetric";

/**
 * 오늘의 지표 — 첫 항목(매출)이 히어로, 나머지는 보조 열.
 *
 * 원래는 4장이 전부 같은 테두리 카드에 같은 text-2xl 이었다. 그러면 "오늘 매출"과
 * "실시간 방문자"가 같은 무게로 읽혀 눈이 어디서 멈출지 정하지 못한다. 대시보드에서
 * 가장 먼저 답해야 하는 질문은 "오늘 얼마 벌었나" 하나뿐이라, 그 값만 크기를 올리고
 * 나머지는 한 단 내려 옆에 세운다.
 *
 * 테두리를 걷어낸 이유: 화면에 같은 테두리 상자가 9개였다. 테두리가 반복되면
 * 무엇이 중요한지 말해주지 못한다 — 구분은 여백과 구분선이 대신한다.
 */
export function MetricCards({ items }: { items: SellerMetric[] }) {
  const [hero, ...rest] = items;
  if (!hero) return null;

  return (
    // 히어로와 보조 열 사이만 선으로 가른다 — 카드 4개를 나열하는 대신
    // "주인공 1 + 참고 3"이라는 관계가 레이아웃 자체로 읽히게
    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
      {/* 폭을 고정하지 않는다. 매출은 자릿수가 몇 배로 뛸 수 있는 값이라
          (백만 → 십억) 고정폭 + shrink-0 이면 큰 금액이 칸을 넘어 옆 지표를 침범한다.
          basis 로 "보통 이 정도" 만 제시하고, 길면 늘고 좁으면 줄게 둔다.
          max-w: 늘어나도 보조 3칸의 자리를 다 먹지는 않게 하는 상한. */}
      {/* 폭을 내용에 맞춘다(basis-auto + w-fit). 금액은 자릿수가 몇 배로 뛰는 값이라
          고정폭이면 큰 금액이 칸을 넘어 옆 지표를 침범하고, 작은 금액이면 빈 칸이 남는다.
          max-w 는 상한선 — 여기 닿으면 글자 쪽(clamp)이 줄어 받아낸다.
          min-w-0: flex 자식의 기본 min-width:auto 를 풀어 실제로 줄어들 수 있게 한다. */}
      <div className="min-w-0 lg:w-fit lg:max-w-[52%] lg:shrink">
        <MetricValue metric={hero} hero />
      </div>

      {rest.length > 0 && (
        <div
          className={cn(
            "grid flex-1 grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3",
            // 모바일에서는 위아래로 쌓이므로 위쪽 선, 넓어지면 왼쪽 선으로 바꾼다
            "border-t pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0",
          )}
        >
          {rest.map((m) => (
            <MetricValue key={m.key} metric={m} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 지표 한 칸 — 라벨(작게·흐리게) → 값(크게·굵게) → 증감(색으로만) */
function MetricValue({
  metric: m,
  hero = false,
}: {
  metric: SellerMetric;
  hero?: boolean;
}) {
  // deltaRate 3-state: undefined=줄 숨김 / null=비교 데이터 없음("—") / number=정상 증감률
  const hasRate = m.deltaRate !== undefined; // null은 "표시"에 포함
  const noCompare = m.deltaRate === null;
  const up = (m.deltaRate ?? 0) >= 0;
  const Arrow = up ? TrendingUp : TrendingDown;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-muted-foreground">
        {m.label}
      </span>
      {/* 실시간으로 갱신되는 값이라 고정폭 숫자를 쓴다 — 아니면 자릿수가
          바뀔 때마다 폭이 흔들려 옆 값과 밑선이 어긋난다.
          큰 숫자일수록 자간이 벌어져 보이므로 히어로는 행간·자간을 더 좁힌다.

          히어로 크기를 clamp 로 두는 이유: 매출은 자릿수가 예측되지 않는 값이다.
          백만원(9자)에 맞춰 48px 로 고정하면 십억원(13자)에서 칸을 넘는다.
          좁은 화면일수록 먼저 줄여 두는 편이 안전하다 — 상한 48px 은 지금과 같고,
          하한 30px 은 보조 지표(24px)보다는 확실히 커서 히어로 자리를 지킨다.

          숫자는 공백이 없어 줄바꿈이 안 된다. break-all 로 강제로 꺾지 않는 이유:
          금액이 중간에서 잘리면 자릿수를 잘못 읽는다 — 줄이 넘치느니 글자가
          작아지는 편이 정확하다. */}
      <span
        className={cn(
          "font-bold tracking-tight",
          numeric,
          hero
            ? "text-[clamp(1.875rem,5.5vw,3rem)] leading-tight sm:tracking-[-0.02em]"
            : "text-2xl leading-tight",
        )}
      >
        {formatMetric(m.value, m.unit)}
      </span>
      {hasRate &&
        (noCompare ? (
          // 비교할 이전 데이터가 없음(어제 0 등) — 화살표 없이 "— 어제 대비"
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="font-semibold">—</span>
            {m.caption && <span>{m.caption}</span>}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm">
            <Arrow
              className={cn("size-4", up ? "text-brand" : "text-destructive")}
            />
            <span
              className={cn(
                "font-semibold",
                numeric,
                up ? "text-brand" : "text-destructive",
              )}
            >
              {up ? "+" : ""}
              {m.deltaRate}%
            </span>
            {m.caption && (
              <span className="text-muted-foreground">{m.caption}</span>
            )}
          </span>
        ))}
      {/* 증감률이 없는 지표(실시간 방문자)도 캡션은 남긴다 — "최근 30분"이 빠지면
          그 숫자가 무엇의 값인지 알 수 없다 */}
      {!hasRate && m.caption && (
        <span className="text-sm text-muted-foreground">{m.caption}</span>
      )}
    </div>
  );
}
