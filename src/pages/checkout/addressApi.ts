import { api } from "@/shared/api/client";
import type { Address, AddressInput } from "./types";

// 배송지 목록 (M-8a) — 로그인 필요.
export async function fetchAddresses(): Promise<Address[]> {
  const { data } = await api.get<{ addresses: Address[] }>("/api/addresses");
  return data.addresses;
}

// 배송지 추가 (M-8b) — 로그인 필요.
// isDefault: true로 추가하면 기존 기본 배송지는 서버가 같은 트랜잭션에서 해제한다.
// 응답은 { addressId }만 — 목록은 호출부에서 재조회해 갱신한다.
export async function createAddress(
  body: AddressInput & { isDefault?: boolean },
): Promise<{ addressId: number }> {
  const { data } = await api.post<{ addressId: number }>(
    "/api/addresses",
    body,
  );
  return data;
}
