import type { ProductOption } from "../types";

/**
 * 옵션 선택 판정 (2026-08-09 옵션별 재고).
 *
 * 컴포넌트에서 떼어낸 이유: 이 판정이 틀리면 "살 수 있는데 못 담는"·"품절인데
 * 담기는" 두 방향으로 조용히 어긋나는데, 화면으로는 재고가 그런 조합이 될 때까지
 * 재현되지 않는다. 순수 함수로 두어 조합을 직접 만들어 검증한다.
 */
export function resolveOptionSelection({
  options,
  pickedId,
  productStock,
}: {
  options: ProductOption[];
  /** 사용자가 고른 optionId. 아직 안 골랐으면 null */
  pickedId: string | null;
  /** 옵션 없는 상품의 재고. 상세 도착 전에는 undefined(재고 미상) */
  productStock?: number;
}): {
  selected: ProductOption | null;
  soldOut: boolean;
  /** 수량 상한. null 이면 제한 없음(재고 미상) */
  stockLimit: number | null;
} {
  // 미선택이면 첫 옵션을 기본값으로 본다 — 표시값과 항상 일치시킨다.
  // 품절 옵션은 건너뛴다: 첫 옵션이 품절이면 화면을 열자마자 담기가 막힌 채
  // 시작해, 살 수 있는 색이 있는데도 없는 것처럼 보인다.
  const firstAvailable =
    options.find((o) => o.purchaseState === "AVAILABLE") ?? options[0] ?? null;
  const selected =
    options.find((o) => o.optionId === pickedId) ?? firstAvailable;

  const soldOut = selected?.purchaseState === "SOLD_OUT";

  // 옵션이 있으면 그 옵션 재고, 없으면 상품 재고.
  // 상품 stockQuantity 는 구매 가능한 옵션 재고의 "합계"라 옵션 상한으로 쓸 수 없다.
  const stockLimit = selected ? selected.stockQuantity : (productStock ?? null);

  return { selected, soldOut, stockLimit };
}

/** 표시·전파용 수량. 재고가 줄어도 상한으로 접는다(1 이상은 항상 허용) */
export function clampQuantity(qty: number, stockLimit: number | null): number {
  if (stockLimit == null) return qty;
  return Math.min(qty, Math.max(1, stockLimit));
}
