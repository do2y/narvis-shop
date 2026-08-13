import type { NoReportReason, SellerReportTriggerType } from "@/shared/types/chat";

/**
 * 보고서 화면 공용 표시 어휘 — 목록·상세가 같은 말을 써야 한다.
 * (AnalysisReport 안의 SEVERITY·ANALYSIS_LABEL 은 리포트 본문 전용이라 그대로 둔다.)
 */

/** 보고서가 만들어진 계기 — R-1·R-2 공용 4종 */
export const TRIGGER_LABEL: Record<SellerReportTriggerType, string> = {
  scheduled_daily: "일간 분석",
  scheduled_weekly: "주간 분석",
  event: "이상 감지",
  manual: "수동 요청",
};

/**
 * 목록이 비었을 때의 안내 — 계약 R-1 판정표의 문구를 **그대로** 쓴다.
 *
 * null(판정 불가)은 여기 없다. "판정 보류 ≠ 이상 없음"이 계약의 불변 규약이라
 * 사유를 지어내지 않고 호출부가 일반 빈 상태로 처리한다.
 */
export const NO_REPORT_MESSAGE: Record<NoReportReason, string> = {
  not_registered: "아직 분석 대상으로 등록되지 않았습니다",
  inactive: "장기 미접속으로 분석이 중지되었습니다",
  no_trigger: "최근 데이터에서 특이 신호가 없었습니다",
  no_baseline: "비교할 이전 기간 데이터가 아직 부족합니다",
  pending_first_run: "첫 분석은 내일 새벽에 시작됩니다",
};

/**
 * "2026-08-11T15:00:00+09:00" → "2026. 8. 11."
 *
 * 앞 10자만 취한다 — 값은 이미 KST 로 옮겨져 있고(reportsApi), 여기서 Date 로 파싱하면
 * 실행 환경 타임존이 한 번 더 끼어든다.
 */
export function formatReportDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.`;
}

/** "2026-08-04" + "2026-08-10" → "8/4 – 8/10" (분석 기간 배지용) */
export function formatPeriod(from: string, to: string): string {
  const short = (d: string) => {
    const m = d.match(/^\d{4}-(\d{2})-(\d{2})$/);
    return m ? `${Number(m[1])}/${Number(m[2])}` : d;
  };
  return `${short(from)} – ${short(to)}`;
}
