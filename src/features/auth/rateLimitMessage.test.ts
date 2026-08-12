import { describe, expect, it } from "vitest";
import { formatRetryAfter } from "./useRateLimit";

// "잠시 후"로 뭉개면 사용자가 계속 눌러보고, 그 시도가 다시 카운터를 올린다(A-1·A-2).
describe("formatRetryAfter", () => {
  it("1분 미만은 초로 보여준다", () => {
    expect(formatRetryAfter(30)).toBe("30초");
  });

  it("60초는 1분으로 접는다", () => {
    expect(formatRetryAfter(60)).toBe("1분");
  });

  // 올림이라 "9분"이라고 안내한 뒤 아직 차단인 상황이 생기지 않는다.
  it("분 단위는 올림한다 — 남은 시간을 실제보다 짧게 말하지 않는다", () => {
    expect(formatRetryAfter(540)).toBe("9분");
    expect(formatRetryAfter(541)).toBe("10분");
  });
});
