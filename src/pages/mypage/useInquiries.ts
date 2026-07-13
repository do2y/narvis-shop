import { useQuery } from "@tanstack/react-query";
import { fetchInquiries } from "./api";

// 문의 내역 — 서버 원본, 답변 상태가 바뀔 수 있어 staleTime 0.
export function useInquiries() {
  return useQuery({
    queryKey: ["inquiries"],
    queryFn: fetchInquiries,
    staleTime: 0,
  });
}
