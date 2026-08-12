import { api } from "@/shared/api/client";
import type { ChatListResponse, ProductGroup } from "@/shared/types/chat";

/** BUY_ALL 묶음은 제안형 문구를 유지하고, 일반 추천은 label 이 있으면 그 자체를 제목으로 쓴다. */
function groupTitle(
  data: ChatListResponse,
): Pick<ProductGroup, "title" | "titleKind"> {
  if (data.listType === "BUY_ALL") {
    return {
      title: data.label ? `이렇게 사면 어때요 · ${data.label}` : "이렇게 사면 어때요",
      titleKind: "default",
    };
  }
  if (data.label) {
    return { title: data.label, titleKind: "label" };
  }
  return {
    title: "조건에 맞는 상품을 골라봤어요",
    titleKind: "default",
  };
}

/**
 * CH-5 추천 목록 조회 — GET /api/chat/lists/{listId}.
 * CH-2 SSE 의 products.ready{listId} 수신 후 호출한다(경로 B — SSE 는 카드를 싣지 않음).
 * BE 가 카드 완결 필드를 최신값으로 부착하므로 상세 캐시 시딩에 그대로 쓸 수 있다.
 * 순서는 응답 순서 유지. reason null → ""(카드 렌더러가 빈 값이면 이유 영역 미표시).
 * 404 RESOURCE_NOT_FOUND(listId 만료·미존재)는 ApiError 로 전파 — 호출부가 처리.
 *
 * 카드 배열이 아니라 ProductGroup 을 반환한다 — listType·itemsDropped·예산은 개별 카드가
 * 아니라 묶음 단위 정보이고, BUY_ALL 은 합계·예산을 함께 보여줘야 제안이 성립한다.
 *
 * 각 카드에는 추천 출처(listId + recommendationRequestId)를 붙인다 — 담기(C-2) 시
 * 그대로 돌려보내야 추천 전환이 귀속된다. 응답의 listId 를 쓴다(인자로 받은 값이 아니라)
 * — 서버가 정규화했을 수 있고, 저장되는 값은 서버가 인정한 쪽이어야 한다.
 */
export async function fetchChatListGroup(
  listId: string,
): Promise<ProductGroup> {
  const { data } = await api.get<ChatListResponse>(
    `/api/chat/lists/${listId}`,
  );
  const title = groupTitle(data);
  const recommendationContext = {
    recommendationRequestId: data.recommendationRequestId,
    listId: data.listId,
  };
  return {
    ...title,
    items: data.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      brandName: item.brandName,
      price: item.price,
      originalPrice: item.originalPrice,
      imageUrl: item.imageUrl,
      rating: item.rating,
      reviewCount: item.reviewCount,
      reason: item.reason ?? "",
      recommendationContext,
    })),
    recommendation: {
      listType: data.listType,
      itemsDropped: data.itemsDropped,
      totalBudget: data.totalBudget,
      sum: data.sum,
      withinBudget: data.withinBudget,
    },
  };
}
