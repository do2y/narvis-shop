import { api } from "./client";
import type { Address, AddressInput, AddressPatch } from "@/shared/types/address";

// 배송지 API (M-8) — 전부 로그인 필요. 결제·마이페이지가 공유한다.

export async function fetchAddresses(): Promise<Address[]> {
  const { data } = await api.get<{ addresses: Address[] }>("/api/addresses");
  return data.addresses;
}

// 응답은 저장된 전체 주소 객체(2026-07-18 확정 — 구 { addressId }만 반환 표기 대체).
// isDefault: true로 보내면 기존 기본은 서버가 같은 트랜잭션에서 해제한다.
export async function createAddress(body: AddressInput): Promise<Address> {
  const { data } = await api.post<Address>("/api/addresses", body);
  return data;
}

// 부분 수정 — 보낸 필드만 바뀐다. { isDefault: true }로 기본 배송지 지정도 겸한다
// (별도 엔드포인트 없음). 기존 기본은 서버가 같은 트랜잭션에서 해제.
export async function updateAddress(
  addressId: number,
  body: AddressPatch,
): Promise<{ addressId: number }> {
  const { data } = await api.patch<{ addressId: number }>(
    `/api/addresses/${addressId}`,
    body,
  );
  return { addressId: data.addressId };
}

// 삭제 규칙(서버): 유일한 배송지는 400 ADDRESS_LAST_UNDELETABLE로 거부되고,
// 기본 배송지를 지우면 가장 오래된 주소가 자동으로 기본 승격된다.
export async function deleteAddress(addressId: number): Promise<void> {
  await api.delete(`/api/addresses/${addressId}`);
}
