import { create } from "zustand";
import { persist } from "zustand/middleware";

// 백엔드 role enum과 일치 (USER/SELLER/ADMIN)
export type UserRole = "USER" | "SELLER" | "ADMIN";

// 백엔드 member 객체 계약
export interface AuthUser {
  id: number;
  email: string;
  nickname: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  // RT는 httpOnly 쿠키로 관리 → 클라 상태에 저장하지 않음
  setAuth: (p: { user: AuthUser; accessToken: string }) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (p) => set(p),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearAuth: () => set({ user: null, accessToken: null }),
    }),
    { name: "jarvis-auth" },
  ),
);
