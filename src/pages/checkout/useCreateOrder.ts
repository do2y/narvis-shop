import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { createOrder, retryPayment } from "./api";

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

function toRetryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "ORDER_INVALID_TRANSITION")
      return "이미 처리된 주문이라 재결제할 수 없어요.";
    // 타인 주문도 404로 통일해 존재를 숨긴다(IDOR 관례) — 권한 문구를 쓰면
    // 주문이 존재한다는 사실이 드러나므로 "찾을 수 없다"로 안내한다.
    if (error.code === "ORDER_NOT_FOUND") return "주문을 찾을 수 없어요.";
    if (error.code === "AUTH_FORBIDDEN") return "이 주문을 처리할 권한이 없어요.";
    if (error.displayMessage) return error.displayMessage;
  }
  return "재결제에 실패했어요. 잠시 후 다시 시도해주세요.";
}

// 결제 실패 주문 재결제 — 자동 재시도 금지(중복 결제 방지).
// 성공 시 장바구니가 차감되므로 주문 목록과 함께 무효화한다.
export function useRetryPayment() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (args: { orderId: number; paymentMethod: string }) =>
      retryPayment(args.orderId, args.paymentMethod),
    retry: false,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (result.status === "PAID") {
        queryClient.invalidateQueries({ queryKey: ["cart"] });
      }
    },
  });

  return {
    ...mutation,
    errorMessage: mutation.error ? toRetryErrorMessage(mutation.error) : null,
  };
}
