import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
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
    setAuth(res);
    navigate(safeReturnUrl(params.get("returnUrl")), { replace: true });
  };
}

// 로그인 실패는 계정 존재 여부를 노출하지 않도록 통합 메시지로 처리 (features.md)
function toErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 401) return "이메일 또는 비밀번호가 올바르지 않습니다";
    if (error.response?.status === 409) return "이미 사용 중인 이메일입니다";
  }
  return fallback;
}

export function useLogin() {
  const onSuccess = useAuthSuccess();
  const mutation = useMutation({
    mutationFn: (body: LoginRequest) => login(body),
    onSuccess,
  });
  return {
    ...mutation,
    errorMessage: mutation.error
      ? toErrorMessage(mutation.error, "로그인에 실패했습니다. 잠시 후 다시 시도해주세요")
      : null,
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
    errorMessage: mutation.error
      ? toErrorMessage(mutation.error, "회원가입에 실패했습니다. 잠시 후 다시 시도해주세요")
      : null,
  };
}
