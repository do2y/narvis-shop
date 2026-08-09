"use client";

import { Check, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoSequence } from "../../hooks/useDemoSequence";
import { useTypeOnce } from "../../hooks/useTypeOnce";
import { DemoBar, DemoFrame } from "../../ui";
import { ANALYSIS_STAGES, type SellerScenario } from "../scenarios";

/**
 * 판매자 분석 데모 — 질문에서 보고서까지 순서대로 진행된다.
 *
 * **한 화면에 결과를 동시에 뿌리지 않는다**(요구사항). 분석이 시간을 들여 진행되는
 * 일이라는 것 자체가 이 데모가 전할 내용이라, 단계가 하나씩 완료되는 과정을 보여준 뒤
 * 결과가 나온다.
 *
 * 실제 판매자 화면(`features/seller`)의 시각 언어를 따른다:
 *  - 지표는 라벨(작게·흐리게) → 값(크게·굵게) → 증감(화살표+색), 고정폭 숫자
 *  - 리포트는 브랜드색 왼쪽 굵은 선 + "핵심 요약", 발견은 severity 배지
 *  - 브랜드 청록(--brand)은 AI 기능 강조에만 쓴다
 *
 * ## 장면
 * 0 질문 타이핑 → 1 범위 확인 → 2 단계 진행(내부 3틱) → 3 지표 →
 * 4 이상 징후 강조 → 5 보고서 정리 → 6 개선안
 */
export function SellerAnalysisDemo({
  scenario,
  active,
}: {
  scenario: SellerScenario;
  active: boolean;
}) {
  // 분석 단계 5개를 각각 한 장면으로 둔다(2~6). 하나의 장면 안에서 CSS 지연으로
  // 흘리면 되감을 때 타이밍이 어긋나 "단계만 남은" 상태가 생긴다 —
  // 진행 자체가 이 데모의 내용이므로 시퀀서가 직접 소유한다.
  const { reached, resetting, reducedMotion } = useDemoSequence(
    [2100, 1500, 700, 700, 700, 700, 900, 1800, 1600, 2200, 2400],
    { paused: !active, loopDelayMs: 3400 },
  );

  /** 장면 번호 → 의미. 배열 인덱스를 직접 읽으면 장면을 하나 끼울 때마다 전부 틀어진다 */
  const SCENE = {
    scope: 1,
    stagesStart: 2,
    metrics: 7,
    anomaly: 8,
    report: 9,
    recommend: 10,
  } as const;

  const typing = useTypeOnce(scenario.question, {
    charMs: 40,
    enabled: active && !reducedMotion,
  });

  /**
   * 몇 번째 분석 단계까지 끝났는지.
   *
   * 장면 번호에서 파생한다 — 별도 타이머를 두면 되감기와 어긋나 단계 표시만
   * 남는 상태가 생긴다. 지표 장면에 도달하면 전부 완료로 본다.
   */
  const stagesDone = reached(SCENE.metrics)
    ? ANALYSIS_STAGES.length
    : ANALYSIS_STAGES.filter((_, i) => reached(SCENE.stagesStart + i)).length;

  return (
    <DemoFrame dimmed={resetting} className="flex h-full flex-col">
      <DemoBar>Narvis 판매자 분석</DemoBar>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-5">
        {/* ① 질문 */}
        <div className="flex justify-end">
          <span className="max-w-[88%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-[13px] leading-relaxed tracking-tight text-primary-foreground">
            {typing.text}
            {!typing.done && (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-[1em] w-px translate-y-[2px] bg-primary-foreground/70 motion-safe:animate-pulse"
              />
            )}
          </span>
        </div>

        {/* ② 질문 범위 확인 — 무엇을 분석할지 되짚는다.
            분석 범위를 벗어난 요청을 사전에 구분한다는 원칙이 여기서 보인다 */}
        {reached(SCENE.scope) && (
          <div
            className={cn(
              "flex flex-wrap gap-x-4 gap-y-1.5 rounded-sm border bg-muted/40 px-3 py-2.5",
              "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
            )}
          >
            {scenario.scope.map((s) => (
              <span key={s.label} className="flex items-center gap-1.5 text-[11px]">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-semibold">{s.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* ③ 분석 진행 — 단계가 하나씩 완료된다 */}
        {reached(SCENE.stagesStart) && !reached(SCENE.report) && (
          <ol className="flex flex-col gap-1.5">
            {ANALYSIS_STAGES.map((stage, i) => {
              const done = i < stagesDone;
              // 방금 끝난 단계 — 지금 무엇이 진행 중인지 눈이 따라갈 지점
              const current = i === stagesDone - 1 && !reached(SCENE.metrics);
              return (
                <li
                  key={stage.label}
                  className={cn(
                    "flex items-center gap-2.5 text-[12px]",
                    "transition-opacity duration-300 ease-out-strong",
                    done ? "opacity-100" : "opacity-40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                      "transition-colors duration-300 ease-out-strong",
                      done
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-border",
                    )}
                  >
                    {done && <Check className="size-2.5" />}
                  </span>
                  <span
                    className={cn("font-medium", current && "text-brand")}
                  >
                    {stage.label}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {stage.detail}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* ④ 핵심 지표 — 이상 징후는 다음 장면에서 강조된다 */}
        {reached(SCENE.metrics) && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-sm border p-3">
            {scenario.metrics.map((m, i) => {
              const flag = m.flagged && reached(SCENE.anomaly);
              const up = (m.deltaRate ?? 0) >= 0;
              const Arrow = up ? TrendingUp : TrendingDown;
              return (
                <div
                  key={m.label}
                  style={{ transitionDelay: `${i * 70}ms` }}
                  className={cn(
                    "flex min-w-0 flex-col gap-0.5 rounded-sm px-1.5 py-1",
                    "transition-[opacity,transform,background-color,box-shadow] duration-300 ease-out-strong",
                    "motion-reduce:transition-[opacity,background-color]",
                    reached(SCENE.metrics)
                      ? "translate-y-0 opacity-100"
                      : "translate-y-1 opacity-0",
                    // 이상 징후 — 배경 + 얇은 링. 색만으로 구분하지 않도록
                    // 아래 캡션에 "확인 필요"를 함께 붙인다
                    flag && "bg-amber-50 shadow-[inset_0_0_0_1px_rgb(252_211_77/0.8)]",
                  )}
                >
                  <span className="truncate text-[10px] font-medium text-muted-foreground">
                    {m.label}
                  </span>
                  <span className="text-[15px] font-bold leading-tight tabular-nums">
                    {m.value}
                  </span>
                  <span className="flex items-center gap-1 text-[10px]">
                    {m.deltaRate === null ? (
                      <span className="font-semibold text-muted-foreground">
                        —
                      </span>
                    ) : (
                      <>
                        <Arrow
                          className={cn(
                            "size-3",
                            up ? "text-brand" : "text-destructive",
                          )}
                        />
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            up ? "text-brand" : "text-destructive",
                          )}
                        >
                          {up ? "+" : ""}
                          {m.deltaRate}
                          {m.label.includes("전환율") ? "%p" : "%"}
                        </span>
                      </>
                    )}
                    <span className="truncate text-muted-foreground">
                      {flag ? "확인 필요" : m.caption}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ⑤ 보고서 — 여러 관점의 결과가 하나로 정리된다 */}
        {reached(SCENE.report) && (
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-2 overflow-hidden",
              "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Sparkles className="size-3" />
              </span>
              <span className="text-[11px] font-bold">AI 분석 리포트</span>
            </div>

            {/* 핵심 요약 — 실제 리포트와 같은 왼쪽 굵은 선 */}
            <p className="rounded-sm border border-l-[3px] border-l-brand bg-background px-3 py-2 text-[12px] leading-relaxed">
              {scenario.summary}
            </p>

            {/* 발견 — 데이터로 확인된 사실.
                근거(evidence)를 회색 박스로 한 겹 더 가둬 "수치로 확인된 것"과
                요약 문장을 구분한다 */}
            {scenario.findings.slice(0, 2).map((f) => (
              <div
                key={f.summary}
                className="flex flex-col gap-1 rounded-sm border bg-background px-3 py-2"
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold">
                    {f.analysisLabel}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-px text-[9px] font-bold",
                      f.severity === "critical"
                        ? "border-red-200 bg-red-50 text-red-600"
                        : f.severity === "warning"
                          ? "border-amber-200 bg-amber-50 text-amber-600"
                          : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {f.severity}
                  </span>
                </span>
                <span className="text-[11px] leading-snug">{f.summary}</span>
                {f.evidence[0] && (
                  <span className="rounded-sm bg-muted/60 px-2 py-1 text-[10px] tabular-nums text-muted-foreground">
                    {f.evidence[0]}
                  </span>
                )}
              </div>
            ))}

            {/* ⑥ 개선안 — AI 제안임이 드러나야 한다 */}
            {reached(SCENE.recommend) && (
              <div
                className={cn(
                  "flex flex-col gap-1.5 rounded-sm border border-brand/30 bg-brand/5 px-3 py-2.5",
                  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-400",
                )}
              >
                <span className="text-[10px] font-bold text-brand">
                  권장 개선안
                </span>
                {scenario.recommendations.slice(0, 2).map((r) => (
                  <span key={r.index} className="flex items-start gap-2">
                    <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-brand text-[9px] font-extrabold text-white">
                      {r.index}
                    </span>
                    <span className="min-w-0 text-[11px] leading-snug">
                      {r.title}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DemoFrame>
  );
}
