import { describe, expect, it } from "vitest";
import { utcToKst, utcToKstNullable } from "./kstTime";

/**
 * R-1/R-2 는 UTC "Z" 로 시각을 주는데 화면(formatGeneratedAt)은 문자열 앞부분을
 * 잘라 쓸 뿐 변환을 하지 않는다 — S-4 가 KST 로 주기 때문이다.
 *
 * 그래서 이 변환이 빠지면 화면이 조용히 9시간 어긋난다. 회귀 방지 대상:
 *  1. 9시간을 더한다
 *  2. 날짜 경계를 넘긴다 (UTC 15:00 이후는 KST 로 다음 날)
 *  3. 파싱 불가능한 값에 화면을 죽이지 않는다
 */

describe("utcToKst", () => {
  it("UTC 에 9시간을 더한다 — 명세 R-1 샘플값", () => {
    // 06:00Z 를 그대로 넘기면 화면에 "06:00" 으로 찍힌다. 실제 KST 는 15:00.
    expect(utcToKst("2026-08-11T06:00:00Z")).toBe("2026-08-11T15:00:00+09:00");
  });

  it("UTC 15:00 이후는 날짜가 하루 넘어간다", () => {
    expect(utcToKst("2026-08-11T15:00:00Z")).toBe("2026-08-12T00:00:00+09:00");
    expect(utcToKst("2026-08-11T23:59:00Z")).toBe("2026-08-12T08:59:00+09:00");
  });

  it("월·연 경계를 넘긴다", () => {
    expect(utcToKst("2026-08-31T15:00:00Z")).toBe("2026-09-01T00:00:00+09:00");
    expect(utcToKst("2026-12-31T15:00:00Z")).toBe("2027-01-01T00:00:00+09:00");
  });

  it("결과가 formatGeneratedAt 의 자르기와 맞물린다", () => {
    // 화면은 /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/ 로 앞부분만 취한다.
    const m = utcToKst("2026-08-11T06:00:00Z").match(
      /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/,
    );
    expect(m && `${m[1]} ${m[2]}`).toBe("2026-08-11 15:00");
  });

  it("파싱할 수 없는 값은 그대로 돌려준다 — 표시가 깨져도 화면은 살린다", () => {
    expect(utcToKst("")).toBe("");
    expect(utcToKst("알 수 없음")).toBe("알 수 없음");
  });
});

describe("utcToKstNullable", () => {
  it("null 은 통과시킨다 — readAt 미읽음이 정상값이다", () => {
    expect(utcToKstNullable(null)).toBeNull();
  });

  it("값이 있으면 변환한다", () => {
    expect(utcToKstNullable("2026-08-11T06:00:00Z")).toBe(
      "2026-08-11T15:00:00+09:00",
    );
  });
});
