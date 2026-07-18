import { api } from "./client";

// 로그아웃: body 없음, RT 쿠키로 대상 식별(withCredentials는 client 기본값).
// 서버에서 RT 삭제 + 쿠키 만료(Max-Age=0). 멱등 — 쿠키가 없어도 항상 성공.
// 헤더 등 여러 위치에서 호출되므로 shared/api에 둔다(로그인/가입은 auth 페이지 전용).
export async function logout(): Promise<void> {
  await api.post("/api/auth/logout");
}
