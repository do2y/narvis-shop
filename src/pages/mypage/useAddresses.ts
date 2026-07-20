import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAddress,
  deleteAddress,
  fetchAddresses,
  updateAddress,
} from "@/shared/api/address";
import { ApiError } from "@/shared/api/client";
import type { AddressInput, AddressPatch } from "@/shared/types/address";

// 배송지 목록 — 서버 원본. 추가/수정/삭제로 자주 바뀌어 staleTime 0.
export function useAddresses() {
  return useQuery({
    queryKey: ["addresses", "mypage"],
    queryFn: fetchAddresses,
    staleTime: 0,
  });
}

// 배송지 변경 실패 메시지 — 서버가 사유를 구체적으로 주므로 그대로 노출하고,
// 삭제 제약(유일한 배송지)만 따로 문구를 맞춘다.
function toAddressErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "ADDRESS_LAST_UNDELETABLE")
      return "배송지가 1개일 때는 삭제할 수 없어요.";
    if (error.code === "ADDRESS_NOT_FOUND")
      return "이미 삭제된 배송지예요.";
    if (error.displayMessage) return error.displayMessage;
  }
  return "배송지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.";
}

// 배송지 변경 뮤테이션 — 성공 시 목록 무효화로 재동기화. 자동 재시도 없음.
// 접두 ["addresses"]로 무효화해 checkout(["addresses","checkout",userId])까지 함께 갱신한다.
// 마이페이지에서 배송지를 고치면 주문서에도 즉시 반영돼야 하므로 의도된 동작.
export function useAddressMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["addresses"] });

  const add = useMutation({
    mutationFn: (input: AddressInput) => createAddress(input),
    retry: false,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (args: { addressId: number; input: AddressPatch }) =>
      updateAddress(args.addressId, args.input),
    retry: false,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (addressId: number) => deleteAddress(addressId),
    retry: false,
    onSuccess: invalidate,
  });

  // 기본 배송지 지정은 별도 API가 없다 — 수정 API에 isDefault만 부분 전송한다.
  // 기존 기본은 서버가 같은 트랜잭션에서 해제.
  const setDefault = useMutation({
    mutationFn: (addressId: number) =>
      updateAddress(addressId, { isDefault: true }),
    retry: false,
    onSuccess: invalidate,
  });

  const errorMessage = [add, update, remove, setDefault].find((m) => m.error)
    ?.error;

  return {
    add,
    update,
    remove,
    setDefault,
    errorMessage: errorMessage ? toAddressErrorMessage(errorMessage) : null,
  };
}
