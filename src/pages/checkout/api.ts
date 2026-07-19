import { api } from "@/shared/api/client";
import type {
  CreateOrderRequest,
  CreateOrderResponse,
} from "./types";

// 주문 생성 + 모의 결제 (O-1) — 로그인 필요(게스트 불가).
// 결제 성공·실패 모두 200이고 status로 구분되므로, 실패를 예외로 다루지 않는다.
// 금액은 서버가 스냅샷 가격으로 재계산하므로 body에 넣지 않는다.
export async function createOrder(
  body: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  const { data } = await api.post<CreateOrderResponse>("/api/orders", body);
  return data;
}

// 결제 실패 주문 재결제 (O-2) — 주문은 그대로 두고 결제만 다시 시도한다.
// 새 주문을 만들면 실패 주문이 쌓이므로, 결제만 실패한 경우 이 경로를 쓴다.
// PENDING/PAYMENT_FAILED 주문만 가능하고, 성공·실패 모두 200이라 status로 구분한다.
export async function retryPayment(
  orderId: number,
  paymentMethod: string,
): Promise<CreateOrderResponse> {
  const { data } = await api.post<CreateOrderResponse>(
    `/api/orders/${orderId}/retry-payment`,
    { paymentMethod },
  );
  return data;
}
