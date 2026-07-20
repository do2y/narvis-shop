import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { createReview } from "./api";
import type { CreateReviewRequest } from "./types";

// 등록 거부 사유를 사용자 문구로. 자격 판정은 서버 몫이라 FE는 코드만 보고 안내한다.
function toReviewErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // 상태 위반(배송 전 등) — 서버 메시지가 사유를 정확히 담고 있어 우선 사용
    if (error.code === "REVIEW_NOT_ALLOWED")
      return error.message || "지금은 후기를 작성할 수 없는 상품이에요.";
    if (error.code === "REVIEW_ALREADY_EXISTS")
      return "이미 후기를 작성한 상품이에요. 후기는 수정할 수 없어요.";
    // 타인 아이템도 404로 통일되므로 존재 여부를 드러내지 않는 문구를 쓴다
    if (error.code === "ORDER_ITEM_NOT_FOUND")
      return "주문 상품을 찾을 수 없어요.";
    // 2000자 초과 등 검증 실패는 필드 사유가 더 구체적
    if (error.displayMessage) return error.displayMessage;
  }
  return "후기 등록에 실패했어요. 잠시 후 다시 시도해주세요.";
}

// 후기 작성 — CLAUDE.md: 자동 재시도 금지(중복 등록 방지). 실패 시 화면에서 재시도.
// 성공 시 주문/상품 리뷰 캐시 무효화(작성 여부·평점 반영). 복귀 이동은 호출부에서.
export function useCreateReview() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body: CreateReviewRequest) => createReview(body),
    retry: false,
    // productId는 요청에 없으므로 응답에서 받아 해당 상품 캐시를 무효화한다.
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products", data.productId] });
    },
  });

  return {
    ...mutation,
    errorMessage: mutation.error
      ? toReviewErrorMessage(mutation.error)
      : null,
  };
}
