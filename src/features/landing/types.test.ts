import { describe, expect, it } from "vitest";
import { parseTab } from "./types";

/**
 * `?tab=` 해석 규칙.
 *
 * 이 함수는 서버(app/page.tsx의 searchParams)와 클라이언트(주소창 구독)
 * **양쪽에서 호출된다.** 둘이 다른 값을 내면 hydration이 어긋나 첫 프레임에
 * 화면이 바뀌므로, 입력 형태별 결과를 고정해 둔다.
 */
describe("parseTab", () => {
  it("seller만 판매자 탭이다", () => {
    expect(parseTab("seller")).toBe("seller");
  });

  it("buyer는 소비자 탭이다", () => {
    expect(parseTab("buyer")).toBe("buyer");
  });

  it("값이 없으면 소비자 탭 — 기본 진입 대상이다", () => {
    expect(parseTab(null)).toBe("buyer");
    expect(parseTab(undefined)).toBe("buyer");
    expect(parseTab("")).toBe("buyer");
  });

  it("모르는 값은 소비자 탭으로 떨어뜨린다 — 링크가 깨져도 화면은 나와야 한다", () => {
    expect(parseTab("xyz")).toBe("buyer");
    expect(parseTab("SELLER")).toBe("buyer"); // 대소문자를 관대하게 받지 않는다
    expect(parseTab("seller ")).toBe("buyer");
  });
});
