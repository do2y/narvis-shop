"use client";

// 찜은 상품 상세·챗봇 카드와 함께 쓰므로 shared/hooks로 승격됨.
// 마이페이지 호출부 호환을 위해 여기서 재export한다.
export { useWishlist } from "@/shared/hooks/useWishlist";

import { useWishlistToggleWithToast } from "@/shared/hooks/useWishlist";

/**
 * 찜 목록에서는 해제만 하므로 토글을 해제 전용으로 감싼다.
 *
 * 여기서 피드백이 특히 필요하다 — 해제하면 카드가 목록에서 사라지는데,
 * 그것만으로는 "내가 지운 것"인지 "화면이 잘못된 것"인지 구분되지 않는다.
 * 되돌리려면 상품을 다시 찾아가야 해서 오조작 비용도 크다.
 */
export function useRemoveWishlistItem(productId: string) {
  const { isPending, toggle } = useWishlistToggleWithToast(productId);
  return {
    // 해제 경로는 seed 가 필요 없다(목록에서 빼기만 한다).
    mutate: () => toggle(),
    isPending,
  };
}
