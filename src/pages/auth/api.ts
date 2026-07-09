import { api } from "@/shared/api/client";
import type { AuthUser } from "@/shared/stores/authStore";

// 로그인/회원가입 응답 계약 — 백엔드 스펙 확정 전까지 mocks/handlers.ts의 목과 1:1.
// 변경 시 목과 함께 갱신할 것.
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  nickname: string;
  gender: "M" | "F";
  birthDate: string; // YYYY-MM-DD
}

export async function login(body: LoginRequest): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/login", body);
  return data;
}

export async function signup(body: SignupRequest): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/signup", body);
  return data;
}
