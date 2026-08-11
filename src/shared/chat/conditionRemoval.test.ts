import { describe, expect, it } from "vitest";
import type { ConditionChip } from "@/shared/types/chat";
import { removeChip } from "./conditionRemoval";

/**
 * 조건 칩 낙관적 제거 — 계약 CH-2 §conditions (값당 분리 2026-08-10, jarvis-ai#434·#566).
 *
 * 회귀 방지 대상은 "칩을 특정하는 키가 field 가 아니라 (field, value) 쌍"이라는 것.
 * field 로 돌아가면 카테고리 칩 하나를 눌렀을 때 카테고리 전부가 사라진다 —
 * 서버는 value 를 받아 하나만 지우므로 화면과 서버가 어긋난 채 다음 턴까지 간다.
 */

/** 값당 분리 후의 전형적인 턴 — 같은 field 칩이 여러 개 */
const MULTI: ConditionChip[] = [
  { field: "category", label: "카테고리 · 여행용품", value: "여행용품" },
  { field: "category", label: "카테고리 · 어댑터", value: "어댑터" },
  { field: "category", label: "카테고리 · 의류", value: "의류" },
  { field: "priceMax", label: "5만원 이하", value: 50000 },
];

describe("removeChip — 값당 제거", () => {
  it("누른 칩 하나만 걷어낸다 — 같은 field 의 나머지는 남는다", () => {
    const next = removeChip(MULTI, "category", "어댑터");
    expect(next.map((c) => c.value)).toEqual(["여행용품", "의류", 50000]);
  });

  it("같은 축을 연달아 지워도 남은 값이 정확하다", () => {
    let next = removeChip(MULTI, "category", "여행용품");
    next = removeChip(next, "category", "의류");
    expect(next.map((c) => c.value)).toEqual(["어댑터", 50000]);
  });

  it("다른 축 칩은 건드리지 않는다", () => {
    const next = removeChip(MULTI, "category", "여행용품");
    expect(next.some((c) => c.field === "priceMax")).toBe(true);
  });
});

describe("removeChip — 단일 값 축", () => {
  // priceMax 등은 축에 칩이 하나뿐이라, 서버가 value 를 무시하고 축 전체를
  // 지워도 결과가 같다. 종전 동작과 어긋나지 않는지 고정한다.
  it("숫자 value 도 정확히 대조해 지운다", () => {
    const next = removeChip(MULTI, "priceMax", 50000);
    expect(next.some((c) => c.field === "priceMax")).toBe(false);
    expect(next).toHaveLength(3);
  });

  it("칩이 하나뿐인 축을 지우면 축이 사라진다 — 종전과 동일", () => {
    const single: ConditionChip[] = [
      { field: "category", label: "카테고리 · 의류", value: "의류" },
    ];
    expect(removeChip(single, "category", "의류")).toEqual([]);
  });
});

describe("removeChip — 어긋난 입력", () => {
  it("field 는 같고 value 가 다르면 지우지 않는다", () => {
    // 이 대조가 느슨해지면(예: field 만 비교) 값당 제거가 통째로 깨진다
    expect(removeChip(MULTI, "category", "없는값")).toHaveLength(MULTI.length);
  });

  it("value 는 같고 field 가 다르면 지우지 않는다", () => {
    const chips: ConditionChip[] = [
      { field: "category", label: "카테고리 · 삼성", value: "삼성" },
      { field: "brand", label: "삼성", value: "삼성" },
    ];
    const next = removeChip(chips, "brand", "삼성");
    expect(next).toEqual([chips[0]]);
  });

  it("타입이 다르면 지우지 않는다 — 숫자 50000 과 문자열 \"50000\"", () => {
    const next = removeChip(MULTI, "priceMax", "50000");
    expect(next).toHaveLength(MULTI.length);
  });

  it("빈 목록은 그대로 빈 목록", () => {
    expect(removeChip([], "category", "의류")).toEqual([]);
  });

  it("원본을 변형하지 않는다", () => {
    removeChip(MULTI, "category", "어댑터");
    expect(MULTI).toHaveLength(4);
  });
});

describe("칩 React key — (field, value) 쌍", () => {
  // ConditionChips.tsx 의 key 규칙과 같은 근거를 고정한다. field 단독으로
  // 돌아가면 리컨실리에이션이 어긋나 엉뚱한 칩이 사라져 보인다.
  it("값당 분리된 칩들의 키가 서로 겹치지 않는다", () => {
    const keys = MULTI.map((c) => `${c.field}:${c.value}`);
    expect(new Set(keys).size).toBe(MULTI.length);
  });

  it("field 만으로는 키가 겹친다 — 이래서 value 가 필요하다", () => {
    const keys = MULTI.map((c) => c.field);
    expect(new Set(keys).size).toBeLessThan(MULTI.length);
  });
});
