/**
 * 상품을 지금 살 수 있는지, 못 산다면 왜 못 사는지 (C-1·M-4·M-7·P-2·P-6, 2026-08-05).
 *
 * 구 purchasable(boolean)은 품절과 숨김을 하나로 뭉개서, 같은 false가 화면마다 다른
 * 문구로 나갔다(찜은 "판매 중지", 브랜드 목록은 "품절"). 둘은 사용자가 할 일이 다르다 —
 * 품절은 기다리면 되고 숨김은 다른 걸 찾아야 한다.
 *
 * 서버가 status·재고에서 파생해 내리므로 FE가 다시 판정하지 않는다.
 * 숨김이 품절보다 우선한다(둘 다여도 HIDDEN).
 */
export type PurchaseState = "AVAILABLE" | "SOLD_OUT" | "HIDDEN";

/**
 * 살 수 있는지. 값이 없으면(구버전 응답·필드 미제공) 막지 않는다 —
 * 서버가 담기·주문에서 최종 판정하므로, 모르는 값 때문에 살 수 있는 상품을 막는 쪽이 나쁘다.
 */
export function isPurchasable(state?: PurchaseState | null): boolean {
  return state !== "SOLD_OUT" && state !== "HIDDEN";
}

/**
 * 구매 불가 사유 라벨. 살 수 있으면 null.
 * 화면마다 다른 말이 나가지 않게 문구를 여기 한 곳에 둔다.
 */
export function unavailableLabel(state?: PurchaseState | null): string | null {
  if (state === "SOLD_OUT") return "품절";
  if (state === "HIDDEN") return "판매 종료";
  return null;
}

// 상세 캐시 시딩용 카드 계약 — ['products', id] 캐시 값의 형태.
// 챗봇·찜·최근 본·홈 카드가 이 형태로 시딩하고, 상세 페이지가 상세 응답 도착 전
// 렌더에 그대로 사용한다. 필드가 하나라도 빠지면 상세 렌더가 깨지므로
// 시딩은 반드시 useGoToProduct(shared/hooks)를 거쳐 이 타입으로 강제한다.
export interface SeededProductCard {
  // 문자열이다. 서버 productId가 64비트라 number로 두면 JSON.parse 시점에
  // 끝자리가 조용히 바뀐다(optionId에서 같은 일을 겪음, b72f0e9).
  // number로 되돌리지 말 것 — 경고 없이 값만 틀어진다.
  productId: string;
  name: string;
  brandName: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  rating: number;
  reviewCount: number;
}
