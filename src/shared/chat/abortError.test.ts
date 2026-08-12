import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/client";
import { StreamStartError } from "./streamChat";
import { isAbortError } from "./useChat";

/**
 * 중단 판정 — 사용자가 스스로 끊은 스트림을 오류로 표시하지 않기 위한 분기.
 *
 * "새 대화"와 화면 이탈이 진행 중인 스트림을 abort 하는데, 그 예외가 일반 실패와
 * 같은 자리로 떨어지면 방금 떠나온 대화에 "응답을 받지 못했어요"가 남는다.
 *
 * 이름으로 판정하는 이유를 고정한다: fetch 중단은 DOMException("AbortError"),
 * axios 경로는 CanceledError 로 오고 환경에 따라 instanceof 가 어긋난다.
 */
describe("isAbortError", () => {
  it("fetch 중단(DOMException AbortError)을 잡는다", () => {
    const err = new DOMException("aborted", "AbortError");
    expect(isAbortError(err)).toBe(true);
  });

  it("이름만 맞아도 잡는다 — 환경마다 생성자가 달라 instanceof 로는 새 나간다", () => {
    expect(isAbortError({ name: "AbortError" })).toBe(true);
  });

  it("axios 취소(CanceledError)도 같은 중단으로 본다", () => {
    expect(isAbortError({ name: "CanceledError" })).toBe(true);
  });

  it("진짜 실패는 중단으로 오인하지 않는다", () => {
    expect(isAbortError(new StreamStartError(504, "UPSTREAM_TIMEOUT"))).toBe(
      false,
    );
    expect(
      isAbortError(new ApiError({ code: "SESSION_NOT_FOUND", message: "" }, 404)),
    ).toBe(false);
    expect(isAbortError(new Error("network"))).toBe(false);
  });

  it("null·원시값에도 안전하다", () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
  });
});
