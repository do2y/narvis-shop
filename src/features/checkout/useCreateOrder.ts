"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { withJosa } from "@/shared/utils/josa";
import { createOrder, retryPayment } from "./api";

// 상품명 나열 — 많으면 앞 2개만 쓰고 나머지는 개수로 접는다(문구가 길어지면 안 읽힌다).
function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} 외 ${names.length - 2}개`;
}

/**
 * 주문 불가 항목 안내(O-1 400 detail.unavailableItems, 2026-08-05).
 *
 * 품절과 판매중지는 사용자가 할 일이 다르다 — 품절은 기다리면 되고 판매중지는 빼야 한다.
 * 그래서 섞여 오면 뭉뚱그리지 않고 사유별로 나눠 말한다.
 * detail이 없는 경우(구버전 응답·파싱 실패)는 종전 문구로 물러난다.
 */
function toUnavailableMessage(
  items: { name: string; reason: "SOLD_OUT" | "HIDDEN" }[] | undefined,
): string {
  if (!items?.length)
    return "구매할 수 없는 상품이 포함되어 있어요. 장바구니에서 확인해주세요.";

  const soldOut = items.filter((i) => i.reason === "SOLD_OUT").map((i) => i.name);
  const hidden = items.filter((i) => i.reason === "HIDDEN").map((i) => i.name);

  const parts: string[] = [];
  if (soldOut.length)
    parts.push(`${withJosa(joinNames(soldOut), "은")} 품절됐어요.`);
  if (hidden.length)
    parts.push(`${withJosa(joinNames(hidden), "은")} 판매가 중지됐어요.`);

  return `${parts.join(" ")} 장바구니에서 빼고 다시 시도해주세요.`;
}

// 주문 실패 메시지 — 결제 실패(PAYMENT_FAILED)는 200이라 여기 오지 않는다.
// 여기 오는 건 요청이 거부된 경우(검증·권한·품절 등).
function toOrderErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "CART_OPTION_INVALID")
      return "선택한 옵션을 찾을 수 없어요. 상품을 다시 선택해주세요.";
    // 옵션 있는 상품인데 optionId 없이 주문한 경우. 상세에서 다시 골라야 한다.
    if (error.code === "CART_OPTION_REQUIRED")
      return "옵션을 선택하지 않은 상품이 있어요. 상품 페이지에서 옵션을 골라주세요.";
    // 담아둔 뒤 못 사게 된 상품이 섞인 경우(O-1). 2026-08-05 재고 선검증이 붙으면서
    // 품절도 여기로 온다 — 그전까지는 200 PAYMENT_FAILED로 갈라져 이 코드가
    // "판매 중지"만 뜻했다. 이제 사유가 둘이라 detail.unavailableItems로 구분한다.
    if (error.code === "ORDER_PRODUCT_UNAVAILABLE")
      return toUnavailableMessage(error.unavailableItems);
    if (error.code === "AUTH_FORBIDDEN")
      return "이 주문을 처리할 권한이 없어요.";

    // 404 3종 — 원인마다 사용자가 할 일이 달라 뭉뚱그리지 않는다(O-1).
    // 장바구니에서 넘어온 주문은 그 사이 항목이 지워졌을 수 있다(다른 탭·만료).
    if (error.code === "CART_ITEM_NOT_FOUND")
      return "장바구니에서 사라진 상품이 있어요. 장바구니를 다시 확인해주세요.";
    // 결제 화면을 열어둔 사이 다른 탭에서 배송지를 지운 경우.
    if (error.code === "ADDRESS_NOT_FOUND")
      return "선택한 배송지가 삭제됐어요. 다른 배송지를 선택해주세요.";
    // 바로 구매 경로에서 상품 자체가 내려간 경우.
    if (error.code === "PRODUCT_NOT_FOUND")
      return "판매가 종료된 상품이 있어요. 상품을 다시 확인해주세요.";
    // 신원은 있으나 회원 행이 없는 경우 — 재로그인이 필요하다.
    if (error.code === "MEMBER_NOT_FOUND")
      return "계정 정보를 찾을 수 없어요. 다시 로그인해주세요.";
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
