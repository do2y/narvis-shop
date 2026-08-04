import { api } from "@/shared/api/client";
import type { AuthUser } from "@/shared/stores/authStore";

// 로그인/회원가입 응답 계약 (봉투 언래핑 후) — 백엔드 A-1/A-2 DTO 기준.
// AT·RT 모두 httpOnly 쿠키로 옴(응답 body에 토큰 없음). user는 `member` 키.
export interface AuthResponse {
  member: AuthUser;
}

// 게스트 승계(장바구니 병합·행동이벤트 백필)는 body가 아니라 guest_id 쿠키로 처리된다.
// guest_id는 HttpOnly라 FE가 읽을 수 없고, 서버가 요청 쿠키에서 직접 취한다
// (E-1과 동일 원칙: 신원은 서버 주입, body의 신원 주장은 무시).
// FE는 client.ts의 withCredentials로 쿠키가 실리는 것만 보장하면 된다.
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  nickname: string;
  gender: "MALE" | "FEMALE";
  birthDate: string; // YYYY-MM-DD
  agreeTerms: boolean;
  agreePrivacy: boolean;
}

// 인터셉터가 봉투를 벗겨 data(=AuthResponse)를 res.data로 넣어줌
export async function login(body: LoginRequest): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/login", body);
  return data;
}

export async function signup(body: SignupRequest): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/signup", body);
  return data;
}
