import type { SellerReportChart } from "@/shared/types/chat";
import type { SellerAnalysis, SellerMetric } from "../types";

/** 판매 지표 값 표시 — 단위별 포맷 */
export function formatMetric(
  value: number,
  // 리포트 차트(SellerReportChart)는 RATING 이 더 있어 유니온에 함께 싣는다
  unit:
    | SellerMetric["unit"]
    | SellerAnalysis["unit"]
    | SellerReportChart["unit"],
): string {
  switch (unit) {
    case "KRW":
      return `${value.toLocaleString("ko-KR")}원`;
    case "PERCENT":
      return `${value}%`;
    case "RATING":
      // 평점은 소수 1자리 고정 — 4 와 4.0 이 섞이면 열이 흔들린다
      return `${value.toFixed(1)}점`;
    default:
      return value.toLocaleString("ko-KR");
  }
}
