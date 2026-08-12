import { describe, expect, it } from "vitest";
import {
  buildSellerScreenContext,
  type SellerScreenState,
} from "./useSellerScreenContext";

function state(overrides: Partial<SellerScreenState> = {}): SellerScreenState {
  return {
    tab: "orders",
    orderTab: "ALL",
    orderPage: 0,
    productTab: "ALL",
    productSort: "latest",
    productPage: 0,
    products: [],
    ...overrides,
  };
}

describe("buildSellerScreenContext", () => {
  it("주문 탭이면 pageType 이 seller_orders 다", () => {
    const screen = buildSellerScreenContext(state({ tab: "orders" }));
    expect(screen.pageType).toBe("seller_orders");
  });

  it("상품 탭이면 pageType 이 seller_products 다", () => {
    const screen = buildSellerScreenContext(state({ tab: "products" }));
    expect(screen.pageType).toBe("seller_products");
  });

  // 계약: filters 값은 enum 코드가 아니라 화면에 보이는 한글 표시값이다.
  // 코드값(ORDERED)을 보내면 프롬프트에서 뜻이 전달되지 않는다.
  it("주문 필터를 한글 표시값으로 싣는다", () => {
    const screen = buildSellerScreenContext(
      state({ tab: "orders", orderTab: "ORDERED" }),
    );
    expect(screen.filters).toEqual({ status: "신규주문", page: "1" });
  });

  it("상품 필터에 정렬까지 싣는다", () => {
    const screen = buildSellerScreenContext(
      state({ tab: "products", productTab: "SOLD_OUT", productSort: "stock" }),
    );
    expect(screen.filters).toEqual({
      status: "품절",
      sort: "재고순",
      page: "1",
    });
  });

  // 0-base 로 관리하지만 사용자가 보는 건 1페이지다 — 그대로 보내면 한 칸 어긋난다.
  it("page 는 화면 표시 기준(1-base)으로 나간다", () => {
    const screen = buildSellerScreenContext(
      state({ tab: "orders", orderPage: 2 }),
    );
    expect(screen.filters?.page).toBe("3");
  });

  // "1번 상품 가격 내려줘"의 근거라 상품 탭에서만 의미가 있다.
  it("상품 탭에서는 화면에 그려진 줄을 순서대로 싣는다", () => {
    const screen = buildSellerScreenContext(
      state({
        tab: "products",
        products: [
          { productId: "3", name: "여행용 파우치" },
          { productId: "7", name: "멀티 어댑터" },
        ],
      }),
    );
    expect(screen.products).toEqual([
      { productId: "3", name: "여행용 파우치" },
      { productId: "7", name: "멀티 어댑터" },
    ]);
  });

  it("주문 탭에서는 products 를 싣지 않는다", () => {
    const screen = buildSellerScreenContext(
      state({ tab: "orders", products: [{ productId: "3", name: "파우치" }] }),
    );
    expect(screen.products).toBeUndefined();
  });

  it("상품이 없으면 products 키 자체를 넣지 않는다", () => {
    const screen = buildSellerScreenContext(state({ tab: "products" }));
    expect(screen.products).toBeUndefined();
  });

  it("계약 상한 20건을 넘으면 화면 순서대로 자른다", () => {
    const products = Array.from({ length: 25 }, (_, i) => ({
      productId: String(i + 1),
      name: `상품 ${i + 1}`,
    }));
    const screen = buildSellerScreenContext(state({ tab: "products", products }));
    expect(screen.products).toHaveLength(20);
    expect(screen.products?.[0].productId).toBe("1");
  });
});
