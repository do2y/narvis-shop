import { describe, expect, it } from "vitest";
import { buildSummaryStats } from "./summaryStats";
import type { PreferenceEdge, PreferencePredicate } from "./types";

function edge(
  predicate: PreferencePredicate,
  label: string,
  type: PreferenceEdge["object"]["type"] = "attribute",
): PreferenceEdge {
  return {
    edgeId: `${predicate}:${label}`,
    predicate,
    object: { nodeId: `${type}:${label}`, type, label },
    editable: predicate !== "purchased",
    challenged: false,
  };
}

describe("buildSummaryStats", () => {
  it("빈 그래프에서도 5가지 관계 자리를 모두 반환한다", () => {
    // 신규 회원(edges: [])은 오류가 아니라 정상 상태다
    const stats = buildSummaryStats([]);

    expect(stats.total).toBe(0);
    expect(stats.counts).toHaveLength(5);
    expect(stats.counts.every((c) => c.count === 0)).toBe(true);
    // 1등이 없다 — 0개짜리를 "가장 강한 취향"으로 부르면 거짓말이 된다
    expect(stats.strongest).toBeNull();
    expect(stats.recent).toEqual([]);
    expect(stats.topType).toBeNull();
  });

  it("가장 많은 관계를 찾는다", () => {
    const stats = buildSummaryStats([
      edge("prefers", "무선"),
      edge("prefers", "경량"),
      edge("likes", "베이지"),
    ]);

    expect(stats.total).toBe(3);
    expect(stats.strongest?.predicate).toBe("prefers");
    expect(stats.strongest?.count).toBe(2);
  });

  it("'요즘 관심'은 interestedIn 앞쪽에서만 가져온다", () => {
    /*
      서버가 그룹 안을 **최근 확인 시각 내림차순**으로 정렬해 준다(계약).
      그래서 앞쪽 = 더 최근이고, 날짜 필드 없이도 "요즘"을 말할 수 있다.
      클라이언트가 재정렬하지 않는 것이 이 계산의 전제다.
    */
    const stats = buildSummaryStats([
      edge("prefers", "무선"),
      edge("interestedIn", "러닝화"),
      edge("interestedIn", "캠핑용품"),
    ]);

    expect(stats.recent).toEqual(["러닝화", "캠핑용품"]);
  });

  it("interestedIn 이 비면 다른 관계로 대신 채우지 않는다", () => {
    // 채우면 "최근"이 아닌 것을 최근이라고 말하게 된다
    const stats = buildSummaryStats([
      edge("prefers", "무선"),
      edge("likes", "베이지"),
    ]);

    expect(stats.recent).toEqual([]);
  });

  it("'요즘 관심'은 4개까지만 보여준다", () => {
    const stats = buildSummaryStats(
      Array.from({ length: 9 }, (_, i) => edge("interestedIn", `관심${i}`)),
    );

    expect(stats.recent).toHaveLength(4);
    expect(stats.recent[0]).toBe("관심0"); // 서버 순서 보존
  });

  it("가장 많이 나온 대상 종류를 센다", () => {
    const stats = buildSummaryStats([
      edge("prefers", "소니", "brand"),
      edge("likes", "애플", "brand"),
      edge("prefers", "무선", "attribute"),
    ]);

    expect(stats.topType).toEqual({ label: "브랜드", count: 2 });
  });
});
