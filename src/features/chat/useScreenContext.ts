"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ChatScreenContext, ChatResult } from "@/shared/types/chat";

function currentColumns(): number {
  if (typeof window === "undefined") return 1;
  if (window.matchMedia("(min-width: 1280px)").matches) return 3;
  if (window.matchMedia("(min-width: 640px)").matches) return 2;
  return 2;
}

const MAX_PRODUCTS = 20;

export function screenProductsFromResults(results: ChatResult[]) {
  return results
    .flatMap((result) => (result.kind === "products" ? result.groups : []))
    .flatMap((group) => group.items)
    .filter((item) => !item.recommendationContext)
    .slice(0, MAX_PRODUCTS)
    .map((item) => ({ productId: item.productId, name: item.name }));
}

export function hasVisibleProductPanel(results: ChatResult[]) {
  return results.some(
    (result) => result.kind === "products" && result.groups.length > 0,
  );
}

export function buildBuyerScreenContext(
  results: ChatResult[],
  columns: number,
): ChatScreenContext | undefined {
  if (!hasVisibleProductPanel(results)) return undefined;

  const products = screenProductsFromResults(results);
  return products.length
    ? { pageType: "chat", products, columns }
    : { pageType: "chat", columns };
}

export function useScreenContext(results: ChatResult[]) {
  const resultsRef = useRef(results);
  useEffect(() => {
    resultsRef.current = results;
  });

  return useCallback(
    (): ChatScreenContext | undefined =>
      buildBuyerScreenContext(resultsRef.current, currentColumns()),
    [],
  );
}
