import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClaim, fetchClaims } from "./api";
import type { CreateClaimRequest } from "./types";

// 취소·반품·교환 신청 내역 — 서버 원본, 처리 상태가 바뀔 수 있어 staleTime 0.
export function useClaims() {
  return useQuery({
    queryKey: ["claims"],
    queryFn: fetchClaims,
    staleTime: 0,
  });
}

// 반품·교환 신청 뮤테이션 — 성공 시 내역 무효화로 재동기화.
// 자동 재시도 없음(중복 접수 방지, CLAUDE.md 규칙).
export function useCreateClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClaimRequest) => createClaim(body),
    retry: false,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["claims"] }),
  });
}
