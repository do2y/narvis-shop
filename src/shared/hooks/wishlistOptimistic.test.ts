import { describe, expect, it } from "vitest";
import {
  applyWishlistToggle,
  toWishlistMessage,
  wishlistSuccessMessage,
} from "./useWishlist";
import { ApiError } from "@/shared/api/client";
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

describe("wishlistSuccessMessage", () => {
  // 인자는 '요청 당시' 상태다 — 완료 시점 서버 상태로 판정하면 재조회가 먼저
  // 끝났을 때 반대 문구가 나간다.
  it("찜이 아니었으면 담았다고 알린다", () => {
    expect(wishlistSuccessMessage(false)).toBe("찜에 담았어요.");
  });

  it("이미 찜이었으면 해제했다고 알린다", () => {
    expect(wishlistSuccessMessage(true)).toBe("찜을 해제했어요.");
  });
});

describe("toWishlistMessage", () => {
  const apiError = (code: string, message = "서버 문구") =>
    new ApiError({ code, message }, 400);

  it("이미 찜한 상품(409)은 문구를 내지 않는다 — 원하는 상태에 이미 도달했다", () => {
    expect(toWishlistMessage(apiError("WISHLIST_DUPLICATE"))).toBeNull();
  });

  it("이미 해제된 상품(404)도 문구를 내지 않는다", () => {
    expect(toWishlistMessage(apiError("WISHLIST_NOT_FOUND"))).toBeNull();
  });

  it("없는 상품은 그 사유를 알린다 — 위 404 와 뭉치면 진짜 실패를 놓친다", () => {
    expect(toWishlistMessage(apiError("PRODUCT_NOT_FOUND"))).toBe(
      "상품을 찾을 수 없어요.",
    );
  });

  it("그 외 ApiError 는 서버 문구를 그대로 쓴다", () => {
    expect(toWishlistMessage(apiError("SOMETHING_ELSE", "권한이 없어요."))).toBe(
      "권한이 없어요.",
    );
  });

  it("네트워크 오류 등 알 수 없는 실패는 재시도를 권한다", () => {
    expect(toWishlistMessage(new Error("network"))).toBe(
      "잠시 후 다시 시도해주세요.",
    );
  });
});
