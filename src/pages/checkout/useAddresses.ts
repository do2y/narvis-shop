import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { createAddress, fetchAddresses } from "./addressApi";
import { useAuthStore } from "@/shared/stores/authStore";

// 배송지 — 로그인 필요. 게스트로 호출하면 401이라 enabled로 막는다.
// 자주 바뀌지 않지만 추가 직후 반영돼야 하므로 staleTime 0.
export function useAddresses() {
  const userId = useAuthStore((s) => s.user?.id ?? null);

  return useQuery({
    queryKey: ["addresses", userId],
    queryFn: fetchAddresses,
    enabled: userId !== null,
    staleTime: 0,
  });
}

function toAddressErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.displayMessage) {
    return error.displayMessage;
  }
  return "배송지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.";
}

export function useCreateAddress() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createAddress,
    retry: false,
    // 기본 배송지 지정 시 다른 항목의 isDefault도 서버에서 바뀌므로 목록 전체를 갱신
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });

  return {
    ...mutation,
    errorMessage: mutation.error ? toAddressErrorMessage(mutation.error) : null,
  };
}
