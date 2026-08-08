import { describe, expect, it } from "vitest";
import { applyWishlistToggle } from "./useWishlist";
import type { WishlistProduct } from "@/shared/types/wishlist";

const seed = {
  name: "테스트 상품",
  brandName: "브랜드",
  price: 19900,
  originalPrice: 29900,
  imageUrl: "https://example.com/a.jpg",
  rating: 4.5,
  reviewCount: 12,
  purchaseState: "AVAILABLE" as const,
};

const item = (productId: string): WishlistProduct => ({ productId, ...seed });

describe("applyWishlistToggle", () => {
  describe("찜 추가", () => {
    it("목록 맨 앞에 넣는다 — 찜 목록이 최신순이라 재조회와 순서가 어긋나지 않는다", () => {
      const result = applyWishlistToggle([item("old")], "new", false, seed);
      expect(result?.map((p) => p.productId)).toEqual(["new", "old"]);
    });

    it("이미 있는 상품은 중복으로 넣지 않는다 (연타·중복 이벤트)", () => {
      const old = [item("a")];
      expect(applyWishlistToggle(old, "a", false, seed)).toBe(old);
    });

    it("목록 캐시가 없으면 만들지 않는다 — 빈 배열은 '찜이 이것뿐'으로 오인된다", () => {
      expect(applyWishlistToggle(undefined, "a", false, seed)).toBeUndefined();
    });

    it("seed 가 없으면 건드리지 않는다 — 서버 재조회에 맡긴다", () => {
      const old = [item("a")];
      expect(applyWishlistToggle(old, "b", false)).toBe(old);
    });
  });

  describe("찜 해제", () => {
    it("목록에서 제거한다", () => {
      const result = applyWishlistToggle([item("a"), item("b")], "a", true);
      expect(result?.map((p) => p.productId)).toEqual(["b"]);
    });

    it("목록 캐시가 없으면 undefined 를 유지한다", () => {
      expect(applyWishlistToggle(undefined, "a", true)).toBeUndefined();
    });

    it("seed 는 해제 경로에서 무시된다", () => {
      const result = applyWishlistToggle([item("a")], "a", true, seed);
      expect(result).toEqual([]);
    });
  });

  it("원본 배열을 변형하지 않는다 (React Query 캐시 불변성)", () => {
    const old = [item("a")];
    applyWishlistToggle(old, "b", false, seed);
    applyWishlistToggle(old, "a", true);
    expect(old.map((p) => p.productId)).toEqual(["a"]);
  });
});
