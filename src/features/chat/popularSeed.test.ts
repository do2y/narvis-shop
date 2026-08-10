import { describe, expect, it } from "vitest";
import { shouldSeedPopular } from "./popularSeed";

describe("shouldSeedPopular", () => {
  it("첫 진입(결과·스트림 없음)에는 인기상품을 채운다", () => {
    expect(
      shouldSeedPopular({
        hasResults: false,
        isStreaming: false,
        popularCount: 8,
      }),
    ).toBe(true);
  });

  it("스트리밍 중에는 채우지 않는다 — 결과 대기 스켈레톤을 덮으면 안 된다", () => {
    expect(
      shouldSeedPopular({
        hasResults: false,
        isStreaming: true,
        popularCount: 8,
      }),
    ).toBe(false);
  });

  it("추천 결과가 있으면 채우지 않는다", () => {
    expect(
      shouldSeedPopular({
        hasResults: true,
        isStreaming: false,
        popularCount: 8,
      }),
    ).toBe(false);
  });

  it("인기상품 응답이 아직 없으면 채우지 않는다", () => {
    expect(
      shouldSeedPopular({
        hasResults: false,
        isStreaming: false,
        popularCount: 0,
      }),
    ).toBe(false);
  });

  /**
   * 이번에 고친 경로 — 홈에서 "안녕"을 입력해 /chat?q=안녕 으로 진입한 흐름.
   * 마운트 직후 전송이 시작되므로 인기상품 응답은 스트리밍 중에 도착하고,
   * 그 턴은 추천이 없어 결과도 비어 있다. 스트림 종료 시점에 다시 판정해야
   * 우측이 빈 채로 남지 않는다.
   */
  it("?q= 진입 후 추천 없는 턴이 끝나면 인기상품을 채운다", () => {
    // 1) 마운트 직후: 전송 시작, 인기상품 아직 미도착 → 채우지 않음
    expect(
      shouldSeedPopular({
        hasResults: false,
        isStreaming: true,
        popularCount: 0,
      }),
    ).toBe(false);

    // 2) 스트리밍 중 인기상품 도착 → 여전히 채우지 않음(스켈레톤 보호)
    expect(
      shouldSeedPopular({
        hasResults: false,
        isStreaming: true,
        popularCount: 8,
      }),
    ).toBe(false);

    // 3) 스트림 종료, 추천 결과 없음 → 이 시점에 채운다
    expect(
      shouldSeedPopular({
        hasResults: false,
        isStreaming: false,
        popularCount: 8,
      }),
    ).toBe(true);
  });

  it("추천이 온 턴은 종료 후에도 그 결과를 유지한다", () => {
    expect(
      shouldSeedPopular({
        hasResults: true,
        isStreaming: false,
        popularCount: 8,
      }),
    ).toBe(false);
  });
});
