import { describe, expect, it } from "vitest";
import type { SellerReport } from "@/shared/types/chat";
import { resolveAnalysisReport } from "./analysisReport";

/**
 * 판매자 분석 리포트 — 계약 §3.2 v0.24.0 (이슈 #296).
 *
 * 회귀 방지 대상은 계약이 FE 에 위임한 규약이다:
 *  1. report 를 받았으면 그것이 정본 (token 연문으로 덮이면 안 된다)
 *  2. 못 받았으면 token 연문을 body 부분치로 승계 — 구버전 서버 호환.
 *     이게 깨지면 AI 서버가 report 를 켜기 전까지 분석 패널이 통째로 빈다.
 */

const report: SellerReport = {
  title: "판매 분석 보고서",
  period: { from: "2026-07-01", to: "2026-07-31" },
  generatedAt: "2026-08-05T18:12:00+09:00",
  summary: "지난달 매출은 전월 대비 12% 감소했습니다.",
  body: "종합 해설 전문…",
  findings: [],
  limitations: [],
  chartRequested: false,
  charts: [],
  recommendations: [],
  applyGuide: "",
};

describe("resolveAnalysisReport", () => {
  it("report 를 받았으면 그것이 정본이다", () => {
    expect(resolveAnalysisReport(report, "스트리밍된 연문")).toBe(report);
  });

  it("report 가 없으면 token 연문을 body 부분치로 승계한다(구버전 서버)", () => {
    expect(resolveAnalysisReport(null, "지난주 매출은 12% 감소했어요")).toEqual({
      body: "지난주 매출은 12% 감소했어요",
    });
  });

  it("부분치는 findings 가 없다 — ReportView 의 구조화 분기가 이걸로 판정한다", () => {
    const view = resolveAnalysisReport(null, "연문만 왔다");
    expect(view?.findings).toBeUndefined();
  });

  it("둘 다 없으면 null — 패널을 건드리지 말라는 신호다", () => {
    // 빈 리포트로 덮으면 직전 턴 리포트까지 사라진다
    expect(resolveAnalysisReport(null, undefined)).toBeNull();
    expect(resolveAnalysisReport(null, "")).toBeNull();
  });

  it("degrade 리포트(summary 빈 문자열)도 그대로 통과시킨다", () => {
    // 분석 일부 실패로 summary 분리에 실패해도 리포트 자체는 유효하다.
    // 섹션을 감출지는 렌더러가 필드 유무로 판단한다 — 여기서 거르지 않는다.
    const degraded = { ...report, summary: "" };
    expect(resolveAnalysisReport(degraded, "연문")).toBe(degraded);
  });
});
