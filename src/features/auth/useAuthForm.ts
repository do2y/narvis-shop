"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { track } from "@/shared/analytics/track";
import { ApiError } from "@/shared/api/client";
import { useAuthStore } from "@/shared/stores/authStore";
import {
  login,
  signup,
  type AuthResponse,
  type LoginRequest,
  type SignupRequest,
} from "./api";

// returnUrl은 앱 내부 경로만 허용 (오픈 리다이렉트 방지)
function safeReturnUrl(raw: string | null): string {
  if (!raw) return "/";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

// 로그인 후 목적지. 판매자는 쇼핑몰 라우트에서 격리되므로(가드 BlockSeller),
// returnUrl이 있어도 /seller 밖이면 무시하고 대시보드로 보낸다 — 안 그러면
// 그 경로로 갔다가 가드에 걸려 다시 /seller로 튕겨 깜빡인다.
function postLoginDest(role: AuthResponse["member"]["role"], returnUrl: string) {
  if (role === "SELLER") {
    return returnUrl.startsWith("/seller") ? returnUrl : "/seller";
  }
  return returnUrl;
}

// 로그인·회원가입이 같은 성공 처리를 쓰되, 수집 이벤트에서는 구분해야 해서 인자로 받는다.
function useAuthSuccess(method: "login" | "signup") {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return (res: AuthResponse) => {
    // returnUrl은 제출 시점에만 필요하다. useSearchParams를 쓰면 이 훅을 부르는
    // 폼 전체가 Suspense 경계에 묶여 SSR에서 로그인 화면이 통째로 비워진다.
    // 이 콜백은 클라이언트에서만 실행되므로 window에서 직접 읽는다.
    const params = new URLSearchParams(window.location.search);
    // 응답 member → authStore user. RT는 쿠키라 저장 안 함.
    setAuth({ user: res.member, accessToken: res.accessToken });
    // 8종 화이트리스트에 signup이 없어 가입(자동 로그인)도 login으로 보내고
    // 구분은 properties.method로 남긴다. 개인정보는 싣지 않는다(명세).
    track("login", { properties: { method, role: res.member.role } });
    const returnUrl = safeReturnUrl(params.get("returnUrl"));
    // 로그인 화면이 히스토리에 남으면 뒤로가기로 되돌아오므로 replace (원본과 동일).
    router.replace(postLoginDest(res.member.role, returnUrl));
  };
}

// 로그인 실패는 계정 존재 여부를 노출하지 않도록 통합 메시지로 처리 (features.md).
// 백엔드는 이메일 없음/비번 불일치를 AUTH_LOGIN_FAILED 하나로 통일해 내려줌.
function toLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "AUTH_LOGIN_FAILED") {
    return error.message || "이메일 또는 비밀번호가 올바르지 않습니다";
  }
  return "로그인에 실패했습니다. 잠시 후 다시 시도해주세요";
}

// 회원가입 실패는 백엔드 에러 code로 분기. 서버 메시지가 있으면 우선 사용.
// VALIDATION_ERROR는 사유가 error.fields[]에 담기므로 displayMessage(=fields[0] 우선)로 읽는다.
// 같은 규칙을 Zod가 먼저 잡으므로 실제로는 프론트 검증 우회·규칙 불일치 시의 2차 방어선.
function toSignupErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // RESOURCE_CONFLICT는 같은 이메일로 동시에 가입 요청이 들어와 DB UNIQUE 제약에서
    // 진 쪽이다(A-1). 명세가 MEMBER_EMAIL_DUPLICATE와 동일하게 안내하라고 정했다.
    if (
      error.code === "MEMBER_EMAIL_DUPLICATE" ||
      error.code === "RESOURCE_CONFLICT"
    ) {
      return "이미 가입된 이메일입니다";
    }
    if (error.displayMessage) return error.displayMessage;
  }
  return "회원가입에 실패했습니다. 잠시 후 다시 시도해주세요";
}

export function useLogin() {
  const onSuccess = useAuthSuccess("login");
  const mutation = useMutation({
    mutationFn: (body: LoginRequest) => login(body),
    onSuccess,
  });
  return {
    ...mutation,
    errorMessage: mutation.error ? toLoginErrorMessage(mutation.error) : null,
  };
}

export function useSignup() {
  const onSuccess = useAuthSuccess("signup");
  const mutation = useMutation({
    mutationFn: (body: SignupRequest) => signup(body),
    onSuccess,
  });
  return {
    ...mutation,
    errorMessage: mutation.error ? toSignupErrorMessage(mutation.error) : null,
  };
}
