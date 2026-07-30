import { api } from "@/shared/api/client";
import type { ChatListResponse, ProductCard } from "@/shared/types/chat";

/**
 * CH-5 추천 목록 조회 — GET /api/chat/lists/{listId}.
 * CH-2 SSE 의 products.ready{listId} 수신 후 호출한다(경로 B — SSE 는 카드를 싣지 않음).
 * BE 가 카드 완결 필드를 최신값으로 부착하므로 상세 캐시 시딩에 그대로 쓸 수 있다.
 * 순서는 응답 순서 유지. reason null → ""(카드 렌더러가 빈 값이면 이유 영역 미표시).
 * 404 RESOURCE_NOT_FOUND(listId 만료·미존재)는 ApiError 로 전파 — 호출부가 처리.
 *
 * 각 카드에 추천 출처(listId + recommendationRequestId)를 붙여 내보낸다 — 담기(C-2) 시
 * 그대로 돌려보내야 추천 전환이 귀속된다. 응답의 listId 를 쓴다(인자로 받은 값이 아니라)
 * — 서버가 정규화했을 수 있고, 저장되는 값은 서버가 인정한 쪽이어야 한다.
 */
export async function fetchChatListCards(
  listId: string,
): Promise<ProductCard[]> {
  const { data } = await api.get<ChatListResponse>(
    `/api/chat/lists/${listId}`,
  );
  const recommendationContext = {
    recommendationRequestId: data.recommendationRequestId,
    listId: data.listId,
  };
  return data.items.map((item) => ({
    productId: item.productId,
    name: item.name,
    brandName: item.brandName,
    price: item.price,
    originalPrice: item.originalPrice,
    imageUrl: item.imageUrl,
    rating: item.rating,
    reviewCount: item.reviewCount,
    reason: item.reason ?? "",
    purchasable: item.purchasable,
    recommendationContext,
  }));
}
