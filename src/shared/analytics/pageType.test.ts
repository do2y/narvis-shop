import { describe, expect, it } from "vitest";
import { toPageType } from "./pageType";

/**
 * 라우트 → pageType 판정.
 *
 * 이 함수는 틀려도 에러가 안 난다 — 집계 숫자만 조용히 뒤바뀐다.
 * 2026-08-12 루트를 랜딩에 내주면서 홈이 /home 으로 옮겨갔고, 그때
 * "/" 판정을 그대로 뒀다면 랜딩이 home 으로 잡히고 쇼핑몰 홈은 아무것도
 * 발화하지 않는 상태가 됐을 것이다. 그 회귀를 여기서 막는다.
 */
describe("toPageType", () => {
  it("쇼핑몰 홈은 /home 이다", () => {
    expect(toPageType("/home")).toBe("home");
  });

  // 루트는 랜딩이다. PageType 은 E-1 계약 어휘 14종이라 landing 항목이 없고,
  // 임의로 만들면 서버 화이트리스트 밖 값이라 그 건만 드롭된다 → 발화하지 않는다.
  it("루트(랜딩)는 발화하지 않는다 — 계약 어휘에 landing 이 없다", () => {
    expect(toPageType("/")).toBeNull();
  });

  it("판매자 4종은 구체적인 경로부터 걸린다", () => {
    expect(toPageType("/seller/chat")).toBe("seller_chat");
    expect(toPageType("/seller/orders")).toBe("seller_orders");
    expect(toPageType("/seller/products")).toBe("seller_products");
    expect(toPageType("/seller")).toBe("seller_dashboard");
  });

  it("구매자 화면을 어휘로 옮긴다", () => {
    expect(toPageType("/products/123")).toBe("product_detail");
    expect(toPageType("/brands/3")).toBe("category");
    expect(toPageType("/cart")).toBe("cart");
    expect(toPageType("/chat")).toBe("chat");
    expect(toPageType("/login")).toBe("auth");
    expect(toPageType("/signup")).toBe("auth");
    expect(toPageType("/mypage/orders")).toBe("my");
    expect(toPageType("/wishlist")).toBe("my");
  });

  // /checkout/complete 가 /checkout 보다 먼저 걸려야 한다 — 순서가 뒤집히면
  // 주문 완료가 전부 checkout 으로 잡혀 퍼널 마지막 단이 사라진다.
  it("주문 완료가 결제보다 먼저 걸린다", () => {
    expect(toPageType("/checkout/complete")).toBe("order_complete");
    expect(toPageType("/checkout")).toBe("checkout");
  });

  it("어휘에 없는 화면은 발화하지 않는다", () => {
    expect(toPageType("/unknown")).toBeNull();
  });
});
