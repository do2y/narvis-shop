"use client";

import { cn } from "@/lib/utils";
import { PREDICATE_STYLE } from "../predicateStyle";
import type { SummaryStats } from "../summaryStats";
import { SummaryMarkdown } from "./SummaryMarkdown";

/**
 * 페이지 대표 카드 — "내 취향이 이렇게 정리돼 있구나"를 몇 초 안에 전한다.
 *
 * ## 왜 이것만 무게가 다른가
 * 아래 관계도·목록과 같은 흰 카드에 같은 테두리로 두면 셋이 같은 비중으로
 * 읽혀 어디부터 볼지 정할 수 없다. 이 카드만 **옅은 브랜드 배경 + 위쪽
 * 그라데이션 라인**을 줘 한 단계 올린다. 나머지는 테두리만 남긴다.
 *
 * 그라데이션은 로고색(파랑→초록→노랑)을 **2px 라인 한 줄**로만 쓴다. 면을
 * 칠하면 글자 대비가 떨어지고 "화려한 그라데이션 금지"에도 걸린다.
 *
 * ## 관리자 대시보드처럼 보이지 않게
 * 큰 숫자를 나열하지 않는다. 수치는 문장 안에 섞고(“취향 200개를 모았어요”),
 * 분포는 **개수에 비례한 막대 한 줄**로 보여준다 — 퍼센트도 축도 없다.
 * 장식용 차트를 새로 만들지 않는다는 원칙과 같은 선이다.
 */
export function SummaryCard({
  stats,
  markdown,
}: {
  stats: SummaryStats;
  /** LLM 요약 문단. null 이면(신규 회원·배치 전) 그 블록만 빠진다 */
  markdown: string | null;
}) {
  const filled = stats.counts.filter((c) => c.count > 0);

  return (
    <section
      aria-labelledby="preference-summary-heading"
      className="relative overflow-hidden rounded-lg border border-brand/15 bg-brand/[0.035] px-4 py-4 sm:px-7 sm:py-6"
    >
      {/* 로고색 라인 — 이 카드가 대표라는 유일한 장식. 2px 라 글자를 방해하지 않는다 */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,#8FB4F2,#8FD3A6_55%,#F0D274)]"
      />

      <h2
        id="preference-summary-heading"
        className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand sm:text-[11px]"
      >
        취향 요약
      </h2>

      {/*
        데스크탑 2열: 왼쪽은 "무엇을 좋아하나"(문장), 오른쪽은 "얼마나 쌓였나"(수치).
        성격이 다른 두 정보라 섞으면 둘 다 흐려진다. 모바일에서는 세로로 쌓인다.
      */}
      <div className="mt-2.5 grid gap-x-7 gap-y-4 sm:mt-3 sm:gap-x-10 sm:gap-y-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/*
          왼쪽은 **정성적 요약** — "나는 어떤 취향인가".
          gap 을 균등하게 두지 않는다. 결론(핵심 문장) → 근거(단서) →
          곁가지(최근 관심) 로 갈수록 간격을 벌려, 간격 자체가 묶음을 말한다.
        */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <div className="flex min-w-0 flex-col gap-2.5 sm:gap-3">
            {/* ① 결론 한 문장 — 카드에서 가장 큰 글자.
                불릿은 그리지 않는다(headlineOnly): 그 내용은 아래 단서에
                라벨+값으로 다시 나오므로 함께 두면 같은 말이 두 번이다 */}
            {markdown ? (
              <SummaryMarkdown markdown={markdown} hideHeading headlineOnly />
            ) : null}

            {/*
              ② 취향을 설명하는 단서 — `라벨 + 값`.

              문장이 아니라 칸으로 두는 이유: 셋이 같은 위계라 같은 규칙으로
              읽혀야 하는데, 문장으로 늘여 쓰면 길이가 제각각이라 무엇이
              같은 종류인지 알기 어렵다.

              데이터가 없는 칸은 애초에 만들어지지 않으므로(summaryStats),
              1~3개 어디든 정렬이 무너지지 않는다.
            */}
            {stats.facets.length > 0 ? (
              <dl className="flex flex-wrap gap-x-6 gap-y-2.5 sm:gap-x-8 sm:gap-y-3">
                {stats.facets.map((facet) => (
                  <div key={facet.label} className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-[10px] font-medium text-brand/80 sm:text-[11px]">
                      {facet.label}
                    </dt>
                    <dd className="min-w-0 text-[13px] font-semibold tracking-tight sm:text-sm">
                      {facet.value}
                      {facet.extra ? (
                        // 보조값은 한 단계 낮춰 대표값과 구분한다
                        <span className="font-normal text-muted-foreground">
                          {" · "}
                          {facet.extra}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {/*
            요즘 관심 — `interestedIn` 앞쪽 몇 개.
            "최근"이라고 부를 수 있는 근거는 서버 정렬(최근 확인 시각 내림차순)
            뿐이라, 그 관계가 비면 이 블록도 통째로 빠진다(summaryStats 주석).

            문장을 칩 앞뒤로 감싸지 않는다 — "…을(를) 자주 보셨어요" 처럼
            조사를 괄호로 처리하면 시스템 문구처럼 읽히고, 칩이 줄바꿈될 때
            뒷문장이 홀로 떨어져 나온다. 라벨을 앞에 한 번만 둔다.
          */}
          {stats.recent.length > 0 ? (
            <div className="flex flex-col gap-1 sm:gap-1.5">
              <span className="text-[11px] text-muted-foreground sm:text-xs">
                요즘 자주 보신 것
              </span>
              <ul className="flex flex-wrap gap-1.5">
                {stats.recent.map((label) => (
                  <li
                    key={label}
                    className={cn(
                      "max-w-full truncate rounded-full border px-2.5 py-0.5 text-[12px] font-medium sm:text-[13px]",
                      PREDICATE_STYLE.interestedIn.chipClass,
                    )}
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* ── 오른쪽: 얼마나 쌓였나 ── */}
        <div className="flex min-w-0 flex-col gap-2 sm:gap-2.5">
          {/*
            오른쪽은 **정량적 요약** — "얼마나, 어떻게 쌓였나".

            문장을 짧게 줄였다. 굵은 글자가 좌우에 동시에 많으면 어디를 먼저
            읽을지 정할 수 없어, 왼쪽 결론 문장과 경쟁했다. 여기서 굵게 두는
            것은 총 개수 하나뿐이고 나머지는 아래 막대·라벨이 말한다.
            (가장 많은 관계·대상 종류는 막대와 범례에 이미 드러난다)
          */}
          <p className="text-[12px] leading-snug text-muted-foreground sm:text-[13px]">
            지금까지{" "}
            <strong className="font-semibold tabular-nums text-foreground">
              {stats.total}개
            </strong>
            의 취향이 쌓였어요
          </p>

          {/*
            분포 — 개수 비례 막대 한 줄. 퍼센트·축·범례를 두지 않는다.
            비율 자체가 목적이 아니라 "어느 쪽에 쏠려 있나"만 보이면 된다.

            role="img" + aria-label: 색 막대는 스크린리더에 아무 의미가 없어,
            아래 라벨 목록과 별개로 한 문장으로 읽히게 한다.
          */}
          {filled.length > 0 ? (
            <>
              <div
                role="img"
                aria-label={filled
                  .map((c) => `${c.label} ${c.count}개`)
                  .join(", ")}
                className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                {filled.map((c) => (
                  <span
                    key={c.predicate}
                    style={{ width: `${(c.count / stats.total) * 100}%` }}
                    className={cn("h-full", PREDICATE_STYLE[c.predicate].barClass)}
                  />
                ))}
              </div>

              {/* 막대의 범례이자 그 자체로 읽히는 목록.
                  색만으로 구분하지 않도록 이름과 개수를 함께 적는다 */}
              <ul
                aria-hidden
                className="flex flex-wrap gap-x-3.5 gap-y-1"
              >
                {filled.map((c) => (
                  <li
                    key={c.predicate}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs"
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        PREDICATE_STYLE[c.predicate].barClass,
                      )}
                    />
                    {c.label}
                    <span className="font-semibold tabular-nums text-foreground/75">
                      {c.count}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
