import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/shared/stores/authStore";

// 백엔드 공통 응답 봉투. 모든 응답이 이 형태로 감싸여 옴.
// 성공: { success: true, data }  /  실패: { success: false, error: { code, message } }
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorBody;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

// 언래핑된 에러. 컴포넌트/훅은 err.code로 분기, err.message는 표시용.
// AxiosError 대신 이걸 throw하므로 호출부는 봉투 구조를 몰라도 됨.
export class ApiError extends Error {
  code: string;
  status?: number;
  constructor(body: ApiErrorBody, status?: number) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.status = status;
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  // RT는 httpOnly 쿠키(Path=/api/auth)로 오가므로 자격증명 동봉 필요
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string> | null = null;

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// 봉투 언래핑: 성공 응답에서 data를 꺼내 그대로 반환한다.
// success:false인데 HTTP 200으로 올 수도 있어(백엔드 정책) 여기서 방어적으로 throw.
api.interceptors.response.use(
  (res) => {
    const body = res.data as ApiEnvelope<unknown> | undefined;
    if (body && typeof body === "object" && "success" in body) {
      if (body.success) {
        res.data = body.data;
        return res;
      }
      throw new ApiError(
        body.error ?? { code: "UNKNOWN", message: "요청을 처리하지 못했습니다." },
        res.status,
      );
    }
    // 봉투가 아닌 응답(204 등)은 그대로 통과
    return res;
  },
  async (error: unknown) => {
    // 응답 인터셉터에서 throw한 ApiError는 그대로 전파
    if (error instanceof ApiError) return Promise.reject(error);

    const axiosError = error as AxiosError<ApiEnvelope<unknown>>;
    const original = axiosError.config as RetriableConfig | undefined;
    const status = axiosError.response?.status;

    if (status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        // refresh는 body 없이 RT 쿠키로 식별 → withCredentials로 쿠키 동봉
        refreshing ??= axios
          .post<ApiEnvelope<{ accessToken: string }>>(
            `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh`,
            null,
            { withCredentials: true },
          )
          .then((r) => {
            const token = r.data.data?.accessToken;
            if (!token) throw new Error("no accessToken in refresh response");
            useAuthStore.getState().setAccessToken(token);
            return token;
          })
          .finally(() => {
            refreshing = null;
          });

        const token = await refreshing;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearAuth();
        const returnUrl = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.href = `/login?returnUrl=${returnUrl}`;
        // refresh 실패 후속 처리 중단
        return new Promise(() => {});
      }
    }

    // 그 외 에러도 가능하면 ApiError로 정규화(봉투가 실려 있으면)
    const body = axiosError.response?.data;
    if (body && typeof body === "object" && "error" in body && body.error) {
      return Promise.reject(new ApiError(body.error, status));
    }
    return Promise.reject(axiosError);
  },
);
