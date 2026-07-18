import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
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

function useAuthSuccess() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  return (res: AuthResponse) => {
    // 응답 member → authStore user. RT는 쿠키라 저장 안 함.
    setAuth({ user: res.member, accessToken: res.accessToken });
    navigate(safeReturnUrl(params.get("returnUrl")), { replace: true });
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
function toSignupErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "MEMBER_EMAIL_DUPLICATE") {
      return error.message || "이미 가입된 이메일입니다";
    }
    if (error.message) return error.message;
  }
  return "회원가입에 실패했습니다. 잠시 후 다시 시도해주세요";
}

export function useLogin() {
  const onSuccess = useAuthSuccess();
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
  const onSuccess = useAuthSuccess();
  const mutation = useMutation({
    mutationFn: (body: SignupRequest) => signup(body),
    onSuccess,
  });
  return {
    ...mutation,
    errorMessage: mutation.error ? toSignupErrorMessage(mutation.error) : null,
  };
}
