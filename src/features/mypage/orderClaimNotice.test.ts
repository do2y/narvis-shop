import { describe, expect, it } from "vitest";
import {
  buildClaimedNotice,
  countClaimedItems,
  resolveHeaderStatus,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "./types";

// 상태만 의미 있는 테스트라 나머지 필드는 고정값으로 채운다
function items(...statuses: OrderStatus[]): OrderItem[] {
  return statuses.map((status, i) => ({
    orderItemId: String(i + 1),
    productId: `p${i + 1}`,
    productName: `상품 ${i + 1}`,
    imageUrl: "",
    optionName: null,
    quantity: 1,
    price: 10000,
    status,
  }));
}

describe("countClaimedItems", () => {
  it("취소·반품·신청중을 종류별로 나눠 센다", () => {
    expect(
      countClaimedItems(
        items("ORDERED", "CANCELLED", "RETURNED", "CLAIM_IN_PROGRESS"),
      ),
    ).toEqual({ cancelled: 1, returned: 1, inProgress: 1, total: 3 });
  });

  it("빠진 상품이 없으면 전부 0", () => {
    expect(countClaimedItems(items("ORDERED", "DELIVERED"))).toEqual({
      cancelled: 0,
      returned: 0,
      inProgress: 0,
      total: 0,
    });
  });
});

// representativeStatus 와 항목 상태가 어긋나는 상황을 만들기 위한 최소 주문
function order(representativeStatus: OrderStatus, ...statuses: OrderStatus[]) {
  return {
    orderId: "1",
    orderNo: "ORD-20260806-1",
    orderedAt: "2026-08-06T00:00:00",
    representativeStatus,
    totalAmount: 10000 * statuses.length,
    items: items(...statuses),
  } satisfies Order;
}

describe("resolveHeaderStatus", () => {
  // 전량 취소가 "처리 완료"로 뜨던 문제 — 틀린 말은 아니나 취소를 알 수 없다
  it("항목이 모두 같은 상태면 대표 상태 대신 그 상태를 쓴다", () => {
    expect(resolveHeaderStatus(order("COMPLETED", "CANCELLED", "CANCELLED"))).toBe(
      "CANCELLED",
    );
  });

  it("항목 상태가 갈리면 대표 상태를 그대로 쓴다", () => {
    expect(resolveHeaderStatus(order("ORDERED", "ORDERED", "CANCELLED"))).toBe(
      "ORDERED",
    );
  });
});

describe("buildClaimedNotice", () => {
  it("취소만 있으면 '취소되었습니다'로 적는다", () => {
    expect(buildClaimedNotice(items("ORDERED", "ORDERED", "CANCELLED"))).toBe(
      "상품 3개 중 1개가 취소되었습니다",
    );
  });

  it("반품만 있으면 '반품되었습니다'로 적는다", () => {
    expect(buildClaimedNotice(items("CONFIRMED", "RETURNED"))).toBe(
      "상품 2개 중 1개가 반품되었습니다",
    );
  });

  it("취소와 반품이 섞이면 둘을 함께 적는다", () => {
    expect(buildClaimedNotice(items("ORDERED", "CANCELLED", "RETURNED"))).toBe(
      "상품 3개 중 2개가 취소·반품되었습니다",
    );
  });

  it("아직 처리 중인 것만 있으면 완료로 단정하지 않는다", () => {
    expect(buildClaimedNotice(items("ORDERED", "CLAIM_IN_PROGRESS"))).toBe(
      "상품 2개 중 1개가 취소·반품 신청 중입니다",
    );
  });

  // 안내할 "나머지"가 없으면 문장이 성립하지 않는다 — 대표 배지가 이미 답한다
  it("빠진 상품이 없으면 안내하지 않는다", () => {
    expect(buildClaimedNotice(items("ORDERED", "DELIVERED"))).toBeNull();
  });

  it("전량 취소면 안내하지 않는다", () => {
    expect(buildClaimedNotice(items("CANCELLED", "CANCELLED"))).toBeNull();
  });
});
