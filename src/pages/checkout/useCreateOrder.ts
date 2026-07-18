import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { createOrder } from "./api";

// 주문 실패 메시지 — 결제 실패(PAYMENT_FAILED)는 200이라 여기 오지 않는다.
// 여기 오는 건 요청이 거부된 경우(검증·권한·품절 등).
function toOrderErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "CART_OPTION_INVALID")
      return "선택한 옵션을 찾을 수 없어요. 상품을 다시 선택해주세요.";
    if (error.code === "AUTH_FORBIDDEN")
      return "이 주문을 처리할 권한이 없어요.";
    // 검증 실패는 필드 사유가 더 구체적(품절·수량 등)
    if (error.displayMessage) return error.displayMessage;
  }
  return "주문에 실패했어요. 잠시 후 다시 시도해주세요.";
}

// 주문 생성 + 모의 결제.
// 자동 재시도 금지 — 중복 주문·중복 결제를 막기 위해 실패 시 사용자가 다시 누르게 한다.
export function useCreateOrder() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createOrder,
    retry: false,
    onSuccess: (result) => {
      // 결제 성공 시에만 장바구니 경유분이 차감되므로 그때만 재동기화(헤더 뱃지 포함)
      if (result.status === "PAID") {
        queryClient.invalidateQueries({ queryKey: ["cart"] });
      }
    },
  });

  return {
    ...mutation,
    errorMessage: mutation.error ? toOrderErrorMessage(mutation.error) : null,
  };
}
