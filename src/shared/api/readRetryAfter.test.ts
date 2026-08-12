import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { readRetryAfter } from "./client";

// 실제 AxiosHeaders 로 만든다 — 평범한 객체로 테스트하면 이 함수의 진짜 함정
// (대소문자 보존)을 못 잡는다. 실제로 소문자 대괄호 접근으로 짜뒀다가 여기서 걸렸다.
function errorWith(headers: Record<string, string>): AxiosError {
  const error = new AxiosError("rate limited");
  error.response = {
    status: 429,
    statusText: "Too Many Requests",
    headers: AxiosHeaders.from(headers),
    config: { headers: new AxiosHeaders() },
    data: undefined,
  };
  return error;
}

describe("readRetryAfter", () => {
  // 서버는 표준 표기(Retry-After)로 보낸다. AxiosHeaders 가 원래 대소문자를
  // 보존하므로 headers["retry-after"] 로 읽으면 undefined 가 나온다 —
  // 타입 에러 없이 카운트다운이 영영 안 뜨는 조용한 실패다.
  it("표준 대소문자(Retry-After)를 읽는다", () => {
    expect(readRetryAfter(errorWith({ "Retry-After": "540" }))).toBe(540);
  });

  it("소문자 표기도 읽는다", () => {
    expect(readRetryAfter(errorWith({ "retry-after": "540" }))).toBe(540);
  });

  it("헤더가 없으면 undefined — 차단 없이 문구만 띄우는 폴백으로 간다", () => {
    expect(readRetryAfter(errorWith({}))).toBeUndefined();
  });

  // RFC 7231 은 HTTP-date 도 허용한다. 백엔드는 초로 보내지만 그게 오면
  // Number() 가 NaN 이라 그대로 두면 화면에 NaN 초가 뜬다.
  it("HTTP-date 형식이면 undefined 로 접는다", () => {
    expect(
      readRetryAfter(errorWith({ "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" })),
    ).toBeUndefined();
  });

  it("0 이하는 undefined — 차단할 시간이 없다", () => {
    expect(readRetryAfter(errorWith({ "Retry-After": "0" }))).toBeUndefined();
    expect(readRetryAfter(errorWith({ "Retry-After": "-5" }))).toBeUndefined();
  });

  // 초 단위 소수는 올림한다 — 내림하면 안내한 시간이 지나도 서버가 아직 막는다.
  it("소수는 올림한다", () => {
    expect(readRetryAfter(errorWith({ "Retry-After": "1.2" }))).toBe(2);
  });

  it("응답 자체가 없으면(네트워크 오류) undefined", () => {
    expect(readRetryAfter(new AxiosError("network"))).toBeUndefined();
  });
});
