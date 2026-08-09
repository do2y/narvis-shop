import { describe, expect, it } from "vitest";
import { clampQuantity, resolveOptionSelection } from "./optionSelection";
import type { ProductOption } from "../types";

function opt(
  optionId: string,
  stockQuantity: number,
  purchaseState: "AVAILABLE" | "SOLD_OUT" = stockQuantity > 0
    ? "AVAILABLE"
    : "SOLD_OUT",
): ProductOption {
  return { optionId, name: optionId, extraPrice: 0, stockQuantity, purchaseState };
}

describe("resolveOptionSelection", () => {
  it("첫 옵션이 품절이면 살 수 있는 옵션을 기본 선택한다", () => {
    // 건너뛰지 않으면 화면을 열자마자 담기가 막힌 채 시작한다.
    const { selected, soldOut } = resolveOptionSelection({
      options: [opt("a", 0), opt("b", 5)],
      pickedId: null,
    });
    expect(selected?.optionId).toBe("b");
    expect(soldOut).toBe(false);
  });

  it("사용자가 고른 옵션이 기본값보다 우선한다", () => {
    const { selected } = resolveOptionSelection({
      options: [opt("a", 5), opt("b", 3)],
      pickedId: "b",
    });
    expect(selected?.optionId).toBe("b");
  });

  it("전 옵션 품절이면 품절로 판정한다", () => {
    // 상품 purchaseState 로는 거르지 못하는 경우가 있어 옵션 기준 판정이 필요하다.
    const { selected, soldOut, stockLimit } = resolveOptionSelection({
      options: [opt("a", 0), opt("b", 0)],
      pickedId: null,
    });
    expect(selected?.optionId).toBe("a");
    expect(soldOut).toBe(true);
    expect(stockLimit).toBe(0);
  });

  it("고른 뒤 그 옵션만 품절되면 품절로 판정한다", () => {
    const { soldOut } = resolveOptionSelection({
      options: [opt("a", 5), opt("b", 0)],
      pickedId: "b",
    });
    expect(soldOut).toBe(true);
  });

  it("수량 상한은 상품 합계가 아니라 선택된 옵션 재고를 쓴다", () => {
    // 합계(8)로 막으면 3개짜리 옵션에 8개까지 담기고 서버가 거절한다.
    const { stockLimit } = resolveOptionSelection({
      options: [opt("a", 3), opt("b", 5)],
      pickedId: "a",
      productStock: 8,
    });
    expect(stockLimit).toBe(3);
  });

  it("옵션 없는 상품은 상품 재고를 상한으로 쓴다", () => {
    const { selected, soldOut, stockLimit } = resolveOptionSelection({
      options: [],
      pickedId: null,
      productStock: 7,
    });
    expect(selected).toBeNull();
    expect(soldOut).toBe(false);
    expect(stockLimit).toBe(7);
  });

  it("재고 미상(상세 도착 전)이면 상한이 없다", () => {
    const { stockLimit } = resolveOptionSelection({
      options: [],
      pickedId: null,
    });
    expect(stockLimit).toBeNull();
  });
});

describe("clampQuantity", () => {
  it("상한을 넘으면 접는다", () => {
    expect(clampQuantity(10, 3)).toBe(3);
  });

  it("재고가 0이어도 최소 1은 유지한다", () => {
    // 0으로 접으면 수량 표시가 0이 되어 화면이 깨진 것처럼 보인다.
    expect(clampQuantity(5, 0)).toBe(1);
  });

  it("상한이 없으면 그대로 둔다", () => {
    expect(clampQuantity(9, null)).toBe(9);
  });
});
