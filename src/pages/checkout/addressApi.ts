import { api } from "@/shared/api/client";
import type { Address, AddressInput } from "./types";

// 배송지 목록 (M-8a) — 로그인 필요.
export async function fetchAddresses(): Promise<Address[]> {
  const { data } = await api.get<{ addresses: Address[] }>("/api/addresses");
  return data.addresses;
}

// 배송지 추가 (M-8b) — 로그인 필요.
// isDefault: true로 추가하면 기존 기본 배송지는 서버가 같은 트랜잭션에서 해제한다.
// 명세는 { addressId }만 반환하지만 실제 응답은 전체 객체 — addressId만 쓰면 양쪽 호환.
export async function createAddress(
  body: AddressInput & { isDefault?: boolean },
): Promise<{ addressId: number }> {
  const { data } = await api.post<{ addressId: number }>(
    "/api/addresses",
    body,
  );
  return data;
}
