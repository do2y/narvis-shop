import { api } from "@/shared/api/client";
import type { AuthUser } from "@/shared/stores/authStore";

// 로그인/회원가입 응답 계약 (봉투 언래핑 후) — 백엔드 A-1/A-2 DTO 기준.
// AT는 body로, RT는 httpOnly 쿠키로 옴(응답 body에 없음). user는 `member` 키.
export interface AuthResponse {
  accessToken: string;
  member: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
  guestId?: string; // 게스트 승계용 UUID (장바구니 병합·이벤트 이관, 있을 때만 전송)
}

export interface SignupRequest {
  email: string;
  password: string;
  nickname: string;
  gender: "MALE" | "FEMALE";
  birthDate: string; // YYYY-MM-DD
  agreeTerms: boolean;
  agreePrivacy: boolean;
  guestId?: string; // 게스트 승계용 UUID (있을 때만 전송)
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
