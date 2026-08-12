"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// 백엔드 role enum과 일치 (USER/SELLER/ADMIN)
export type UserRole = "USER" | "SELLER" | "ADMIN";

// 백엔드 member 객체 계약
export interface AuthUser {
  // 응답 id 는 문자열이다(2026-08-06 공통 규약) — A-1·A-2·A-5 모두 "1" 처럼 내려온다.
  // number 로 두면 쿼리 키에 섞일 때 "1" 과 1 이 다른 키가 되어 캐시가 갈린다.
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  /**
   * 부팅 시 세션 복원(refresh → me)이 끝났는지. false인 동안 라우트 가드는
   * 판정을 보류한다 — 아니면 새로고침 때마다 로그인 화면이 한 번 번쩍인다.
   */
  isRestoring: boolean;
  // AT·RT 모두 httpOnly 쿠키로 관리 → 클라 상태에 토큰을 두지 않는다.
  // 브라우저가 자동 첨부하므로 FE는 토큰 값을 볼 일도, 보관할 일도 없다.
  setAuth: (p: { user: AuthUser }) => void;
  setUser: (user: AuthUser) => void;
  finishRestore: () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isRestoring: true,
      setAuth: (p) => set(p),
      setUser: (user) => set({ user }),
      finishRestore: () => set({ isRestoring: false }),
      clearAuth: () => set({ user: null }),
    }),
    {
      // 서비스명이 Narvis 로 바뀐 뒤에도 이 키는 jarvis- 로 둔다(2026-08-07).
      // 바꾸면 기존 사용자의 localStorage 항목을 못 찾아 전원 로그아웃된다.
      // 사용자에게 보이지 않는 내부 식별자라 통일할 이득도 없다.
      name: "jarvis-auth",
      // 토큰은 저장하지 않는다 — AT·RT 모두 httpOnly 쿠키라 JS가 볼 수 없다.
      //
      // user만 남기는 건 헤더 닉네임 등의 초기 깜빡임을 줄이기 위한 캐시일 뿐이며,
      // 신뢰 경계가 아니다 — 권한 판정은 부팅 시 /api/auth/me 응답으로 덮어쓴다.
      // (localStorage는 사용자가 편집 가능하므로 role을 그대로 믿으면 안 된다.
      //  물론 최종 방어선은 백엔드이고, 가드는 UX 차원의 1차 필터다.)
      partialize: (s) => ({ user: s.user }),
      // partialize는 앞으로의 저장만 막는다. 과거 버전에서 AT를 저장한 브라우저가
      // 남아 있으므로 version을 올려 기존 항목을 마이그레이션(=토큰 폐기)한다.
      //
      // v3: id 를 number → string 으로 정정(2026-08-06 공통 규약). 이미 숫자로 저장된
      // 브라우저가 남아 있어 그대로 두면 추천 쿼리 키가 1 과 "1" 로 갈린다.
      // 로그아웃시키지 않고 문자열로 접어서 살린다 — 어차피 role 은 me 로 덮어쓴다.
      version: 3,
      migrate: (persisted) => {
        const user = (persisted as { user?: AuthUser }).user ?? null;
        return {
          user: user ? { ...user, id: String(user.id) } : null,
        };
      },
    },
  ),
);

/**
 * 인증이 필요한 요청을 보내도 되는 시점인지.
 * 인증 필요 쿼리의 `enabled`는 반드시 이걸 쓸 것.
 *
 * AT가 httpOnly 쿠키로 바뀌면서 FE는 토큰 보유 여부를 직접 볼 수 없다.
 * 그래서 "복원 완료 + user 존재"로 판정한다.
 *
 * `isRestoring=false` 조건이 핵심이다 — persist된 user는 사용자가 편집 가능해
 * 그 자체로는 신뢰할 수 없지만, 복원이 끝난 뒤의 user는 항상
 * `/api/auth/refresh` → `/api/auth/me` 를 통과한 서버 응답으로 덮어써진 값이다
 * (실패 시 useRestoreSession이 clearAuth로 null을 만든다).
 * 즉 이 셀렉터가 true인 시점의 user는 서버가 인정한 신원이다.
 *
 * 반대로 `isRestoring` 중에 true를 주면 안 된다 — 쿠키가 아직 갱신되기 전이라
 * 만료된 AT로 요청이 나가 불필요한 401 → refresh 폭주를 부른다.
 */
export const selectIsAuthReady = (s: AuthState) =>
  !s.isRestoring && s.user !== null;
