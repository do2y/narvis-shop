import axios from "axios";
import { api } from "@/shared/api/client";
import type { AuthUser } from "@/shared/stores/authStore";

// 현재 로그인 사용자 (A-5). 라우팅 가드의 로그인 여부·역할 판정 소스.
// localStorage의 user는 사용자가 편집 가능하므로 role을 신뢰하지 않고 여기서 덮어쓴다.
// 401 처리(AUTH_REQUIRED → 로그인 / AUTH_TOKEN_EXPIRED → refresh)는 client.ts 인터셉터가 담당.
export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>("/api/auth/me");
  return data;
}

// 로그아웃: body 없음, RT 쿠키로 대상 식별. 서버에서 RT 삭제 + 쿠키 만료(Max-Age=0).
// 멱등 — 쿠키가 없어도 항상 성공.
//
// 명세상 "Bearer가 아니라 RT 쿠키 기준"(AT 만료 상태에서도 로그아웃 가능해야 함)이라
// api 인스턴스를 쓰지 않는다. api를 쓰면 요청 인터셉터가 만료된 AT를 붙이고,
// 백엔드가 401을 주면 refresh → 실패 시 /login 리다이렉트를 타서 로그아웃이 로그인으로 끝난다.
// refresh 호출부(client.ts)도 같은 이유로 raw axios를 쓴다.
//
// 헤더 등 여러 위치에서 호출되므로 shared/api에 둔다(로그인/가입은 auth 페이지 전용).
export async function logout(): Promise<void> {
  await axios.post(
    `${import.meta.env.VITE_API_BASE_URL}/api/auth/logout`,
    null,
    { withCredentials: true },
  );
}
