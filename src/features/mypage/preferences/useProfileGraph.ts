"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import { fetchProfileGraph } from "./api";
import type { PersonalizationState, ProfileGraph } from "./types";

/**
 * 취향 프로필 쿼리 키 — 이 화면의 유일한 서버 상태.
 *
 * 하위 키로 쪼개지 않는다. M-11 응답 하나가 요약 문단·트리·개인화 스위치·
 * graphVersion을 전부 담고 있어, 쪼개면 같은 응답을 여러 키에 복제하게 된다.
 */
export const PROFILE_GRAPH_KEY = ["profile", "graph"] as const;

/**
 * M-11 조회.
 *
 * staleTime 0 — 서버가 원본이고 버전 충돌(409)이 있는 데이터다. 캐시를 오래
 * 붙들면 화면은 옛 내용인데 graphVersion만 최신인 어긋난 상태가 생긴다.
 *
 * 로그인 필수 — 복원 완료 전에 보내면 AT 없이 나가 401로 튕긴다.
 * SELLER·ADMIN 계정은 서버가 403을 낸다(USER 역할 전용).
 */
export function useProfileGraph() {
  const isAuthReady = useAuthStore(selectIsAuthReady);

  return useQuery({
    queryKey: PROFILE_GRAPH_KEY,
    queryFn: fetchProfileGraph,
    staleTime: 0,
    enabled: isAuthReady,
    // 409는 뮤테이션 훅이 재조회로 직접 처리한다. 조회 자체의 재시도는
    // 기본값(3회)이면 오류 화면이 느리게 뜨므로 1회로 줄인다.
    retry: 1,
  });
}

/**
 * graphVersion 보관·갱신 — **이 화면에서 가장 위험한 축**.
 *
 * 모든 성공 응답에 graphVersion이 들어 있고, 갱신을 빠뜨리면 다음 요청이
 * 전부 409가 된다. 그래서 별도 state로 복제하지 않고 **React Query 캐시
 * 한 곳에서만** 읽고 쓴다. useState로 들고 다니면 갱신 지점이 4곳
 * (수정·삭제·초기화·개인화)으로 흩어져 하나만 빠뜨려도 화면이 죽는다.
 *
 * 캐시가 비어 있으면(첫 조회 전) 뮤테이션을 보낼 수 없다 — 호출부가
 * graphVersion 없이는 If-Match를 만들 수 없으므로 null을 반환해 막는다.
 */
export function useGraphVersion(): string | null {
  const queryClient = useQueryClient();
  const cached = queryClient.getQueryData<ProfileGraph>(PROFILE_GRAPH_KEY);
  return cached?.graphVersion ?? null;
}

/**
 * 캐시의 graphVersion만 갱신한다 — 뮤테이션 성공 핸들러에서 호출.
 *
 * 캐시가 없으면 아무것도 하지 않는다. 없는데 만들어 넣으면 edges가 빈
 * 반쪽짜리 그래프가 캐시에 들어가 화면이 "취향 없음"으로 뒤집힌다.
 */
export function useGraphCacheWriter() {
  const queryClient = useQueryClient();

  return {
    /** 성공 응답의 graphVersion을 보관값에 반영 */
    setVersion(graphVersion: string) {
      queryClient.setQueryData<ProfileGraph>(PROFILE_GRAPH_KEY, (prev) =>
        prev ? { ...prev, graphVersion } : prev,
      );
    },

    /** 개인화 스위치 응답 반영 — 낙관적 갱신 없이 서버 값을 그대로 쓴다 */
    setPersonalization(
      graphVersion: string,
      personalization: PersonalizationState,
    ) {
      queryClient.setQueryData<ProfileGraph>(PROFILE_GRAPH_KEY, (prev) =>
        prev ? { ...prev, graphVersion, personalization } : prev,
      );
    },

    /**
     * M-11 재조회 — 409 후 화면을 최신으로 되돌릴 때.
     *
     * 409 응답에 최신 버전이 동봉돼 오지만(error.detail.graphVersion) 그걸
     * 갈아끼우지 않는 이유: 버전만 바꾸면 화면은 여전히 옛 내용이라,
     * 사용자가 보는 정보가 틀린 채로 다음 요청이 나간다.
     */
    async refetch(): Promise<ProfileGraph | undefined> {
      await queryClient.invalidateQueries({ queryKey: PROFILE_GRAPH_KEY });
      return queryClient.getQueryData<ProfileGraph>(PROFILE_GRAPH_KEY);
    },
  };
}
