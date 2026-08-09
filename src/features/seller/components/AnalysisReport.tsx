"use client";

import { useRef, useState } from "react";
import {
  ChevronDown,
  MessageSquare,
  Printer,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { printElement } from "@/shared/utils/printElement";
import type { AnalysisReportView } from "@/shared/chat/store";
import type {
  SellerAnalysisType,
  SellerFindingSeverity,
  SellerReportRecommendation,
} from "@/shared/types/chat";
import { hoverMuted, pressable } from "../interaction";
import { AnalysisChart } from "./AnalysisChart";

interface AnalysisReportProps {
  /**
   * 분석 리포트. 구조화(report 이벤트) 또는 부분치({body}만, 구버전 서버 fallback).
   * null이면 로딩 스켈레톤을 보여준다.
   */
  report: AnalysisReportView | null;
  /** 분석 스트림 진행 중 여부 — report 확정 전 스켈레톤 표시 */
  loading: boolean;
}

const SEVERITY: Record<SellerFindingSeverity, { label: string; cls: string }> = {
  info: { label: "info", cls: "border-border bg-muted text-muted-foreground" },
  warning: { label: "warning", cls: "border-amber-200 bg-amber-50 text-amber-600" },
  critical: { label: "critical", cls: "border-red-200 bg-red-50 text-red-600" },
};

const ANALYSIS_LABEL: Record<SellerAnalysisType, string> = {
  sales_anomaly: "매출 이상 분석",
  conversion: "구매전환 분석",
  behavior: "고객 행동 분석",
  churn: "고객 이탈 분석",
  abuse: "어뷰징 점검",
  review: "리뷰 분석",
};

const ACTION_LABEL: Record<SellerReportRecommendation["actionType"], string> = {
  price_adjust: "가격 조정",
  description_update: "설명 개선",
  stock_adjust: "재고 조정",
  product_visibility: "노출 변경",
  promotion: "프로모션",
};

/**
 * body·summary 에 섞여 오는 마크다운 기호를 걷어낸다.
 * 계약상 이 필드는 연문(plain text)이지만 LLM 이 "## 제목"·"**강조**"를 섞어 보내는
 * 사례를 실측했다(2026-08-05). 마크다운 렌더러를 들이면 계약에 없는 구조를 화면이
 * 떠안게 되므로, 기호만 제거해 연문으로 되돌린다.
 */
function stripMd(s: string): string {
  return s
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .trim();
}

/** "2026-08-05T18:12:00+09:00" → "2026-08-05 18:12" (KST 기준값이 그대로 온다) */
function formatGeneratedAt(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : iso;
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

const CARD = "rounded-sm border bg-background p-4 sm:p-5";

/**
 * 판매자 분석 리포트 패널 — done{panel:replace}+lane:analysis 시 우측에 표시.
 *
 * 각 섹션은 해당 필드가 있고 비어있지 않을 때만 렌더한다. 그래서 구버전 서버의
 * 부분치({body}만)가 들어와도 헤더·발견·차트·추천이 자연스럽게 빠지고 본문만 남는다
 * (계약 §0 fallback — 분기 코드를 따로 두지 않는 이유).
 * 브랜드 청록(--brand)은 AI 기능 강조 전용(CLAUDE.md 디자인 토큰).
 */
export function AnalysisReport({ report, loading }: AnalysisReportProps) {
  const [bodyOpen, setBodyOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  if (loading && !report) {
    return (
      <section className={cn(CARD, "flex flex-col gap-4")}>
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Sparkles className="size-4" />
          </span>
          <h3 className="text-base font-bold tracking-tight">AI 분석 리포트</h3>
        </div>
        <div className="flex flex-col gap-2.5" aria-label="분석 중">
          {[100, 92, 96, 70].map((w, i) => (
            <span
              key={i}
              className="h-4 animate-pulse rounded-sm bg-muted"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (!report) return null;

  // 구조화 리포트인지(=헤더를 그릴 수 있는지). fallback 부분치는 body 만 있다.
  const structured = !!report.findings;

  // 리포트는 스트림 1회성이라 새로고침하면 사라진다(복원 API 없음) —
  // 남겨 두려면 사용자가 직접 저장해야 한다.
  //
  // 파일을 만들지 않고 브라우저 인쇄를 띄운다: 사용자가 "PDF로 저장"을 고르면
  // 화면과 같은 폰트·차트(SVG)로 출력된다. PDF 라이브러리를 쓰면 한글 폰트를
  // 통째로 임베딩(수 MB)해야 하고 레이아웃을 좌표로 다시 짜야 한다.
  const print = () => printElement(rootRef.current);

  const printButton = (
    <button
      type="button"
      onClick={print}
      // 인쇄물에 "저장" 버튼 자체가 찍히면 안 된다
      data-print-hide
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium text-muted-foreground",
        pressable,
        hoverMuted,
        "hover:[@media(hover:hover)]:text-foreground",
      )}
    >
      <Printer className="size-3.5" />
      PDF로 저장
    </button>
  );

  return (
    // ref: 인쇄 시 이 서브트리를 body 밑으로 복제해 단독 출력한다(printElement)
    <div ref={rootRef} className="flex flex-col gap-3.5">
      {/* ① 헤더 — 제목 + 생성 시각 + 기간 배지 */}
      {structured && report.title && (
        <section className={cn(CARD, "flex flex-wrap items-center gap-3")}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold tracking-tight">
              {report.title}
            </h3>
            {report.generatedAt && (
              <span className="text-xs text-muted-foreground">
                {formatGeneratedAt(report.generatedAt)} 생성
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {report.period && (
              <span className="whitespace-nowrap rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold tabular-nums text-brand">
                {report.period.from} ~ {report.period.to}
              </span>
            )}
            {printButton}
          </div>
        </section>
      )}

      {/* fallback(구버전 서버)은 헤더가 없어 저장 버튼이 갈 곳이 없다 —
          본문만 있어도 내려받을 값은 있으므로 별도 줄로 노출한다 */}
      {!structured && (
        <div className="flex justify-end">{printButton}</div>
      )}

      {/* ② 핵심 요약 — summary 가 ""(분리 실패 degrade)면 body 가 정보를 싣는다 */}
      {report.summary && (
        <section className={cn(CARD, "border-l-[3px] border-l-brand")}>
          <SectionLabel className="mb-1.5">핵심 요약</SectionLabel>
          <p className="text-[15px] leading-relaxed">
            {stripMd(report.summary)}
          </p>
        </section>
      )}

      {/* ③ 발견 상세 */}
      {report.findings?.length ? (
        <section className="flex flex-col gap-2.5">
          <SectionLabel className="ml-1">발견 상세</SectionLabel>
          {report.findings.map((f, i) => (
            <article key={i} className={CARD}>
              <header className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">
                  {ANALYSIS_LABEL[f.analysisType] ?? f.analysisType}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-bold",
                    SEVERITY[f.severity]?.cls ?? SEVERITY.info.cls,
                  )}
                >
                  {SEVERITY[f.severity]?.label ?? f.severity}
                </span>
              </header>

              <p className="text-sm leading-relaxed">{f.summary}</p>

              {/* 수치 근거 — tabular-nums 로 자릿수 정렬 */}
              {f.evidence?.length ? (
                <div className="mt-2 flex flex-col gap-1">
                  {f.evidence.map((e, j) => (
                    <p
                      key={j}
                      className="rounded-sm bg-muted/60 px-2.5 py-1.5 text-[13px] tabular-nums text-muted-foreground"
                    >
                      {e}
                    </p>
                  ))}
                </div>
              ) : null}

              {f.recommendation && (
                <p className="mt-2 text-[13px] leading-relaxed text-brand">
                  ↳ {f.recommendation}
                </p>
              )}
            </article>
          ))}
        </section>
      ) : null}

      {/* ④ 종합 해설(body) — 구조화면 접기 기본(요약·발견이 이미 위에 있다),
          fallback 이면 이게 유일한 내용이라 항상 펼침 */}
      {report.body && (
        <section className={CARD}>
          {structured ? (
            <>
              <button
                type="button"
                onClick={() => setBodyOpen((v) => !v)}
                aria-expanded={bodyOpen}
                // 펼치기 토글은 화면 전용 — 인쇄물엔 본문이 항상 펼쳐져 나간다
                data-print-hide
                className="flex w-full items-center justify-between gap-2 text-left transition-colors duration-150 ease-out-strong hover:[@media(hover:hover)]:text-brand"
              >
                <span className="text-sm font-bold">종합 해설 전문</span>
                <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                  {bodyOpen ? "접기" : "펼치기"}
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform",
                      bodyOpen && "rotate-180",
                    )}
                  />
                </span>
              </button>
              {/* 접힌 상태에서도 DOM 에 둔다 — 인쇄 CSS 가 펼쳐야 하는데
                  조건부 렌더면 아예 없어서 되살릴 수가 없다 */}
              <p
                data-print-body
                className={cn(
                  "mt-3 whitespace-pre-wrap text-sm leading-relaxed",
                  !bodyOpen && "hidden",
                )}
              >
                {stripMd(report.body)}
              </p>
            </>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {report.body}
            </p>
          )}
        </section>
      )}

      {/* ⑤ 데이터 한계 — 분석이 일부 실패해도 리포트는 나온다(degrade). 그 사실을 숨기지 않는다 */}
      {report.limitations?.length ? (
        <section className="rounded-sm border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <SectionLabel className="mb-1.5 flex items-center gap-1.5 text-amber-600">
            <TriangleAlert className="size-3.5" />
            데이터 한계
          </SectionLabel>
          <div className="flex flex-col gap-1">
            {report.limitations.map((l, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-amber-800">
                {l}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* ⑥ 차트 — 부분 성공이 있어 블록을 나눈다. 하나로 묶으면(삼항) 차트가
          한 장이라도 있을 때 실패 안내가 통째로 사라진다 */}

      {/* 차트 기간이 분석 기간과 다를 때만 온다. 헤더 뱃지는 분석 기간이라
          이걸 안 그리면 판매자가 두 기간을 같은 것으로 읽는다 */}
      {report.chartPeriod && (
        <p className="text-[13px] text-muted-foreground">
          그래프 기간{" "}
          <span className="tabular-nums">
            {report.chartPeriod.from} ~ {report.chartPeriod.to}
          </span>
        </p>
      )}

      {report.charts?.map((c, i) => <AnalysisChart key={i} analysis={c} />)}

      {/* message 는 서버가 완성한 문장이라 그대로 싣는다 — reason 으로 분기해
          FE 가 문구를 만들면 지원 축이 늘 때마다 배포를 기다려야 한다 */}
      {report.chartUnavailable?.map((u, i) => (
        <p
          key={i}
          className="rounded-sm bg-muted/60 px-3 py-2 text-[13px] text-muted-foreground"
        >
          {u.message}
        </p>
      ))}

      {/* 구버전 서버 폴백 — chartUnavailable 을 안 주는 배포와 겹칠 때만 탄다.
          원인을 모르므로 특정 원인("데이터 부족")을 단정하지 않는다 */}
      {report.chartRequested &&
        !report.charts?.length &&
        !report.chartUnavailable?.length && (
          <p className="rounded-sm bg-muted/60 px-3 py-2 text-[13px] text-muted-foreground">
            요청하신 차트를 만들지 못했습니다.
          </p>
        )}

      {/* ⑦ 추천 행동 — index 는 서버값 그대로("N번 적용해줘"의 그 N) */}
      {report.recommendations?.length ? (
        <section className={CARD}>
          <SectionLabel className="mb-2.5">추천 행동</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {report.recommendations.map((r) => (
              <article
                key={r.index}
                className="flex flex-wrap items-start gap-3 rounded-sm border p-3.5"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-extrabold text-white">
                  {r.index}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{r.title}</p>
                  {r.expectedEffect && (
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                      기대 효과: {r.expectedEffect}
                    </p>
                  )}
                </div>
                <span className="ml-auto whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  {ACTION_LABEL[r.actionType] ?? r.actionType} · #{r.productId}
                </span>
              </article>
            ))}
          </div>

          {report.applyGuide && (
            <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
              <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
              {report.applyGuide}
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
