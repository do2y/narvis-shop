"use client";

import { useQuery } from "@tanstack/react-query";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import {
  fetchCategories,
  fetchPopularProducts,
  fetchRecommendedProducts,
} from "./api";

const THIRTY_MIN = 30 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

// 카테고리는 정적 데이터 → staleTime 30분 (CLAUDE.md React Query 규칙)
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: THIRTY_MIN,
  });
}

// 인기상품은 BE Redis 캐시(3분)와 낡음이 합산 → 5분 (CLAUDE.md React Query 규칙)
// size 미지정 시 백엔드 기본값(12). queryFn을 직접 넘기면 React Query context가
// 첫 인자로 들어가므로 명시적으로 호출한다.
export function usePopularProducts(size?: number) {
  return useQuery({
    queryKey: ["products", "popular", size ?? null],
    queryFn: () => fetchPopularProducts(size),
    staleTime: FIVE_MIN,
  });
}

// 개인화 추천 — 로그인 상태에서만 호출한다. 봉투째 반환한다(source·상관키가 필요).
// 게스트로 호출하면 401 → 인터셉터가 홈에서 로그인 화면으로 튕겨버리므로 enabled 필수.
// 사용자별 결과라 키에 userId를 넣어 계정 전환 시 이전 추천이 노출되지 않게 한다.
//
// enabled에 isAuthReady를 쓰는 이유: userId만 보면 새로고침 직후 user는 복원됐지만
// AT는 아직 없는 구간에 요청이 나가 401 → 홈에서 로그인으로 튕긴다.
// (AT를 메모리로 옮기면서 "user 있음 = AT 있음" 전제가 깨졌다)
export function useRecommendedProducts() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthReady = useAuthStore(selectIsAuthReady);

  return useQuery({
    queryKey: ["products", "recommended", userId],
    queryFn: fetchRecommendedProducts,
    enabled: isAuthReady,
    // BE가 P-5를 10분 캐시하므로 FE 5분이면 AI 복구·행동 반영이 최대 15분 안에 도달
    staleTime: FIVE_MIN,
  });
}
