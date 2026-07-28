import { api } from "./client";
import type {
  Address,
  AddressInput,
  AddressPatch,
} from "@/shared/types/address";

export async function fetchAddresses(): Promise<Address[]> {
  const { data } = await api.get<{ addresses: Address[] }>("/api/addresses");
  return data.addresses;
}

export async function createAddress(body: AddressInput): Promise<Address> {
  const { data } = await api.post<Address>("/api/addresses", body);
  return data;
}

export async function updateAddress(
  addressId: number,
  body: AddressPatch,
): Promise<Address> {
  const { data } = await api.patch<Address>(
    `/api/addresses/${addressId}`,
    body,
  );
  return data;
}

// 삭제 규칙(서버): 유일한 배송지는 400 ADDRESS_LAST_UNDELETABLE로 거부되고,
// 기본 배송지를 지우면 가장 오래된 주소가 자동으로 기본 승격된다.
export async function deleteAddress(addressId: number): Promise<void> {
  await api.delete(`/api/addresses/${addressId}`);
}
