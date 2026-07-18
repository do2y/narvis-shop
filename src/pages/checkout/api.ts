import { api } from "@/shared/api/client";
import type { CreateOrderRequest, CreateOrderResponse } from "./types";

// 주문 생성 + 모의 결제 (O-1) — 로그인 필요(게스트 불가).
// 결제 성공·실패 모두 200이고 status로 구분되므로, 실패를 예외로 다루지 않는다.
// 금액은 서버가 스냅샷 가격으로 재계산하므로 body에 넣지 않는다.
export async function createOrder(
  body: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  const { data } = await api.post<CreateOrderResponse>("/api/orders", body);
  return data;
}
