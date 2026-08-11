import { describe, expect, it } from "vitest";
import {
  buildBuyerScreenContext,
  hasVisibleProductPanel,
  screenProductsFromResults,
} from "./useScreenContext";
import type { ChatResult } from "@/shared/types/chat";

function makeCard(productId: string, name: string, recommendation = false) {
  return {
    productId,
    name,
    brandName: "Brand",
    price: 1000,
    originalPrice: 1000,
    imageUrl: "/test.png",
    rating: 4.5,
    reviewCount: 10,
    reason: "",
    ...(recommendation
      ? {
          recommendationContext: {
            recommendationRequestId: "req-1",
            listId: "list-1",
          },
        }
      : {}),
  };
}

describe("screenProductsFromResults", () => {
  it("excludes recommendation cards from products", () => {
    const results: ChatResult[] = [
      {
        kind: "products",
        groups: [
          { title: "Popular", items: [makeCard("1", "Popular Item")] },
          {
            title: "Recommended",
            items: [makeCard("2", "Recommended Item", true)],
          },
        ],
      },
    ];

    expect(screenProductsFromResults(results)).toEqual([
      { productId: "1", name: "Popular Item" },
    ]);
  });

  it("keeps the visible panel order and caps unknown products at 20 items", () => {
    const results: ChatResult[] = [
      {
        kind: "products",
        groups: [
          {
            title: "Mixed",
            items: Array.from({ length: 25 }, (_, index) =>
              makeCard(String(index + 1), `Item ${index + 1}`),
            ),
          },
        ],
      },
    ];

    expect(screenProductsFromResults(results)).toHaveLength(20);
    expect(screenProductsFromResults(results)[0]).toEqual({
      productId: "1",
      name: "Item 1",
    });
    expect(screenProductsFromResults(results)[19]).toEqual({
      productId: "20",
      name: "Item 20",
    });
  });
});

describe("buildBuyerScreenContext", () => {
  it("returns pageType and columns when only recommendation cards are visible", () => {
    const results: ChatResult[] = [
      {
        kind: "products",
        groups: [
          {
            title: "Recommended",
            items: [makeCard("2", "Recommended Item", true)],
          },
        ],
      },
    ];

    expect(hasVisibleProductPanel(results)).toBe(true);
    expect(buildBuyerScreenContext(results, 3)).toEqual({
      pageType: "chat",
      columns: 3,
    });
  });

  it("includes products when the panel contains server-unknown items", () => {
    const results: ChatResult[] = [
      {
        kind: "products",
        groups: [
          { title: "Popular", items: [makeCard("1", "Popular Item")] },
          {
            title: "Recommended",
            items: [makeCard("2", "Recommended Item", true)],
          },
        ],
      },
    ];

    expect(buildBuyerScreenContext(results, 2)).toEqual({
      pageType: "chat",
      columns: 2,
      products: [{ productId: "1", name: "Popular Item" }],
    });
  });

  it("returns undefined when no product panel is visible", () => {
    expect(buildBuyerScreenContext([], 2)).toBeUndefined();
  });
});
