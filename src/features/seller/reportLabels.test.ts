import { describe, expect, it } from "vitest";
import { NO_REPORT_MESSAGE, formatPeriod, formatReportDate } from "./reportLabels";

/**
 * 보고서 표시 어휘. 회귀 방지 대상은 두 가지다.
 *  1. 날짜 포맷이 타임존을 다시 건드리지 않을 것 — 값은 이미 KST 로 옮겨져 있다.
 *  2. noReportReason 문구가 계약 판정표와 일치할 것.
 */

describe("formatReportDate", () => {
  it("KST 오프셋 문자열의 앞부분만 취한다", () => {
    // Date 로 파싱하면 실행 환경 타임존이 끼어들어 하루가 밀릴 수 있다
    expect(formatReportDate("2026-08-11T15:00:00+09:00")).toBe("2026. 8. 11.");
  });

  it("자정 직후에도 날짜가 밀리지 않는다", () => {
    expect(formatReportDate("2026-08-12T00:00:00+09:00")).toBe("2026. 8. 12.");
  });

  it("파싱할 수 없으면 원문을 돌려준다", () => {
    expect(formatReportDate("알 수 없음")).toBe("알 수 없음");
  });
});

describe("formatPeriod", () => {
  it("연도를 빼고 월/일만 남긴다", () => {
    expect(formatPeriod("2026-08-04", "2026-08-10")).toBe("8/4 – 8/10");
  });

  it("앞자리 0을 지운다", () => {
    expect(formatPeriod("2026-01-01", "2026-01-09")).toBe("1/1 – 1/9");
  });
});

describe("NO_REPORT_MESSAGE", () => {
  it("계약 판정표 5종을 모두 갖는다", () => {
    expect(Object.keys(NO_REPORT_MESSAGE).sort()).toEqual([
      "inactive",
      "no_baseline",
      "no_trigger",
      "not_registered",
      "pending_first_run",
    ]);
  });

  it("pending_first_run 은 오류가 아니라 정상 대기로 안내한다", () => {
    // 신규 판매자가 반드시 한 번 겪는 상태다 — 실패처럼 읽히면 안 된다
    expect(NO_REPORT_MESSAGE.pending_first_run).toBe(
      "첫 분석은 내일 새벽에 시작됩니다",
    );
  });
});
