import { api } from "./client";
import type { Cart, RecommendationContext } from "@/shared/types/cart";

// 장바구니 조회 (C-1) — 게스트도 가능(guest_id 쿠키). client의 withCredentials로 쿠키 동봉.
// 헤더 뱃지가 여러 페이지에서 이 데이터를 쓰므로 shared에 둔다(장바구니 페이지 전용 아님).
export async function fetchCart(): Promise<Cart> {
  const { data } = await api.get<Cart>("/api/cart");
  return data;
}

// 담기 (C-2) — 동일 상품+옵션이 이미 있으면 서버가 수량을 합산한다.
// 응답 quantity는 합산 결과라 요청 수량과 다를 수 있다.
// 상품 상세·챗봇 카드·찜 목록이 함께 쓰므로 shared에 둔다.
export async function addCartItem(body: {
  // 두 ID 모두 문자열이다 — 64비트라 number 로 만들면 끝자리가 조용히 바뀐다.
  // 여기는 담기 요청 본문이라 틀어진 값이 그대로 서버로 나가고,
  // optionId 는 CART_OPTION_INVALID 로 거부된다(b72f0e9).
  productId: string;
  optionId?: string | null;
  quantity: number;
  // 추천 카드에서 담을 때만 싣는다(C-2). 서버가 담기 시점의 출처를 저장해
  // 주문 시 order_item 스냅샷으로 복사하므로, 이게 빠지면 추천 전환이 집계에서 사라진다.
  // 지면·순위는 서버가 listId로 조회해 붙이므로 FE는 이 2개만 보낸다.
  recommendationContext?: RecommendationContext;
}): Promise<{ cartItemId: string; quantity: number }> {
  const { productId, optionId, quantity, recommendationContext } = body;
  const { data } = await api.post<{ cartItemId: string; quantity: number }>(
    "/api/cart/items",
    {
      productId,
      quantity,
      ...(optionId != null ? { optionId } : {}),
      ...(recommendationContext ? { recommendationContext } : {}),
    },
  );
  return data;
}
