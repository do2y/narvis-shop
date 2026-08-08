import type { AnalysisReportView } from "./store";
import type { SellerReport } from "@/shared/types/chat";

/**
 * done{analysis+replace} 시점에 우측 패널에 꽂을 리포트를 고른다.
 *
 * 훅 밖에 두는 이유는 progress.ts 와 같다 — 계약 §3.2 가 FE 에 위임한 규약이
 * 여기 모여 있는데, 스트림 소비 흐름(switch) 안에 두면 테스트로 고정할 수가 없다.
 *
 * 규약 두 가지:
 *  1. report 를 받았으면 그것이 정본이다(구조화 리포트).
 *  2. 못 받았으면(구버전 서버) token 연문을 body 로 승계한다 — 부분치라
 *     ReportView 의 선택 섹션들이 자연스럽게 빠져 종전 화면과 같아진다.
 *
 * null 반환 = "꽂을 것이 없다". 호출부는 패널을 건드리지 않아야 한다 —
 * 빈 리포트로 덮으면 직전 턴의 리포트까지 사라진다.
 */
export function resolveAnalysisReport(
  pendingReport: SellerReport | null,
  streamedText: string | undefined,
): AnalysisReportView | null {
  if (pendingReport) return pendingReport;
  return streamedText ? { body: streamedText } : null;
}
