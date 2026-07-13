import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addAddress,
  fetchAddresses,
  removeAddress,
  setDefaultAddress,
  updateAddress,
} from "./api";
import type { AddressInput } from "./types";

// 배송지 목록 — 서버 원본. 추가/수정/삭제로 자주 바뀌어 staleTime 0.
export function useAddresses() {
  return useQuery({
    queryKey: ["addresses"],
    queryFn: fetchAddresses,
    staleTime: 0,
  });
}

// 배송지 변경 뮤테이션 — 성공 시 목록 무효화로 재동기화. 자동 재시도 없음.
export function useAddressMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["addresses"] });

  const add = useMutation({
    mutationFn: (input: AddressInput) => addAddress(input),
    retry: false,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (args: { addressId: string; input: AddressInput }) =>
      updateAddress(args.addressId, args.input),
    retry: false,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (addressId: string) => removeAddress(addressId),
    retry: false,
    onSuccess: invalidate,
  });

  const setDefault = useMutation({
    mutationFn: (addressId: string) => setDefaultAddress(addressId),
    retry: false,
    onSuccess: invalidate,
  });

  return { add, update, remove, setDefault };
}
