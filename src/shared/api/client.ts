import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/shared/stores/authStore";

// 백엔드 공통 응답 봉투. 모든 응답이 이 형태로 감싸여 옴.
// 성공: { success: true, data }  /  실패: { success: false, error: { code, message } }
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorBody;
}

// 검증 실패(VALIDATION_ERROR) 시 필드별 사유. 공통 message보다 구체적이라 표시에 우선 쓴다.
export interface ApiFieldError {
  field: string;
  message: string;
}

// 코드별 부가 정보. 코드마다 형태가 달라(재고 수량 / 옵션 목록 등) 여기서는 좁히지 않고,
// 읽는 쪽이 코드를 확인한 뒤 좁혀 쓴다.
// 예: CART_STOCK_INSUFFICIENT → { availableStock } / CART_OPTION_REQUIRED → { options }
export type ApiErrorDetail = Record<string, unknown>;

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: ApiFieldError[];
  detail?: ApiErrorDetail;
}

// 언래핑된 에러. 컴포넌트/훅은 err.code로 분기, err.message는 표시용.
// AxiosError 대신 이걸 throw하므로 호출부는 봉투 구조를 몰라도 됨.
export class ApiError extends Error {
  code: string;
  status?: number;
  fields?: ApiFieldError[];
  detail?: ApiErrorDetail;
  constructor(body: ApiErrorBody, status?: number) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.status = status;
    this.fields = body.fields;
    this.detail = body.detail;
  }

  // 검증 실패면 필드 사유("수량은 99 이하여야 합니다.")를, 없으면 공통 message를 반환
  get displayMessage(): string {
    return this.fields?.[0]?.message ?? this.message;
  }

  /**
   * 남은 재고 — CART_STOCK_INSUFFICIENT에 동반되는 detail.availableStock (C-2·C-3, 2026-07-22).
   * detail은 코드마다 형태가 달라 여기서 숫자만 좁혀 꺼낸다. 없으면 undefined.
   */
  get availableStock(): number | undefined {
    const value = this.detail?.availableStock;
    return typeof value === "number" ? value : undefined;
  }

  /**
   * 선택 가능한 옵션 — CART_OPTION_REQUIRED에 동반되는 detail.options (C-2·I-2).
   * 명세는 "FE가 이걸로 바로 옵션 선택을 띄우라"고 한다 — 문구만 보여주면
   * 사용자가 어떤 옵션이 있는지 알 수 없어 상세로 되돌아가야 한다.
   *
   * 타입을 features/product에서 가져오면 shared → features 역방향 의존이 되므로
   * 필요한 모양만 여기서 좁힌다(구조가 같아 그대로 쓰인다).
   */
  get options(): { optionId: number; name: string; extraPrice: number }[] | undefined {
    const value = this.detail?.options;
    if (!Array.isArray(value)) return undefined;
    const parsed = value.filter(
      (o): o is { optionId: number; name: string; extraPrice: number } =>
        typeof o === "object" &&
        o !== null &&
        typeof (o as { optionId?: unknown }).optionId === "number" &&
        typeof (o as { name?: unknown }).name === "string",
    );
    return parsed.length ? parsed : undefined;
  }

  /**
   * 주문할 수 없는 항목 — ORDER_PRODUCT_UNAVAILABLE에 동반되는
   * detail.unavailableItems (O-1, 2026-08-05).
   *
   * 서버가 주문 생성 전에 재고를 선검증하고 불량 항목을 fail-fast가 아니라 전량 수집해
   * 내려준다. 이게 없으면 "장바구니에서 확인해주세요"밖에 안내할 수 없다.
   *
   * reason은 목록·상세의 purchaseState와 같은 어휘다 — 주문 화면과 장바구니가
   * 다른 말을 하지 않게 서버가 한 곳(PurchaseState)에서 판정한다.
   */
  get unavailableItems():
    | { productId: string; name: string; reason: "SOLD_OUT" | "HIDDEN" }[]
    | undefined {
    const value = this.detail?.unavailableItems;
    if (!Array.isArray(value)) return undefined;
    const parsed = value.filter(
      (i): i is { productId: string; name: string; reason: "SOLD_OUT" | "HIDDEN" } =>
        typeof i === "object" &&
        i !== null &&
        typeof (i as { name?: unknown }).name === "string" &&
        ((i as { reason?: unknown }).reason === "SOLD_OUT" ||
          (i as { reason?: unknown }).reason === "HIDDEN"),
    );
    return parsed.length ? parsed : undefined;
  }
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  // AT(Path=/)·RT(Path=/api/auth) 모두 httpOnly 쿠키로 오가므로 자격증명 동봉 필요.
  // 브라우저가 자동 첨부하므로 Authorization 헤더를 다는 요청 인터셉터는 없다.
  withCredentials: true,
});

let refreshing: Promise<void> | null = null;

// 동시 401이 여러 건일 때 리다이렉트가 중복 실행되는 것을 막는다.
// (refresh 프라미스를 공유해도 각 요청이 개별적으로 실패 경로를 타므로 필요)
let redirecting = false;

// 인증 복구 불가 → 로컬 상태 정리 후 로그인으로. 복귀를 위해 현재 경로를 returnUrl로 넘긴다.
function redirectToLogin() {
  if (redirecting) return;
  redirecting = true;
  useAuthStore.getState().clearAuth();
  // 이미 로그인 화면이면 returnUrl을 덮어써 원래 목적지를 잃지 않도록 이동하지 않는다.
  if (window.location.pathname === "/login") return;
  const returnUrl = encodeURIComponent(
    window.location.pathname + window.location.search,
  );
  window.location.href = `/login?returnUrl=${returnUrl}`;
}

// axios 요청 config에 커스텀 옵션을 추가한다. 모듈 확장을 써야 get/post에
// 그대로 넘길 때 타입이 통과한다.
declare module "axios" {
  export interface AxiosRequestConfig {
    /**
     * 401을 호출부가 직접 처리하겠다는 표시. 인터셉터의 로그인 리다이렉트를 건너뛴다.
     * 부팅 복원처럼 "401이 곧 비로그인 판정"인 경로에서 쓴다 — 리다이렉트가 먼저 일어나면
     * 호출부의 catch가 잡기도 전에 화면이 로그인으로 넘어간다.
     */
    skipAuthRedirect?: boolean;
  }
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/** 요청 단위로 401 자동 리다이렉트를 끄는 옵션 (axios config에 그대로 전달) */
export const NO_AUTH_REDIRECT: { skipAuthRedirect: true } = {
  skipAuthRedirect: true,
};

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
    const code = axiosError.response?.data?.error?.code;

    // 401 2종 규약(2026-07-18 확정): AUTH_TOKEN_EXPIRED만 refresh 재시도 대상.
    // AUTH_REQUIRED(RT 없음/만료)는 재발급 여지가 없으므로 바로 로그인 유도.
    if (status === 401 && code === "AUTH_REQUIRED") {
      // 호출부가 직접 처리하겠다고 표시한 요청은 리다이렉트하지 않고 에러를 넘긴다
      if (original?.skipAuthRedirect) {
        return Promise.reject(
          new ApiError(
            axiosError.response?.data?.error ?? {
              code: "AUTH_REQUIRED",
              message: "로그인이 필요합니다.",
            },
            status,
          ),
        );
      }
      redirectToLogin();
      return new Promise(() => {});
    }

    if (status === 401 && code === "AUTH_TOKEN_EXPIRED" && original && !original._retry) {
      original._retry = true;
      try {
        // refresh는 body 없이 RT 쿠키로 식별 → withCredentials로 쿠키 동봉.
        // 새 AT는 응답 body가 아니라 Set-Cookie로 내려오므로 FE가 토큰을 다룰 일이 없다.
        // 재시도 요청에도 브라우저가 갱신된 쿠키를 자동으로 실어 보낸다.
        refreshing ??= axios
          .post(
            `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api/auth/refresh`,
            null,
            { withCredentials: true },
          )
          .then(() => undefined)
          .finally(() => {
            refreshing = null;
          });

        await refreshing;
        return api(original);
      } catch {
        // refresh도 401(AUTH_REQUIRED) → 재발급 여지 없음, 로그인 유도
        redirectToLogin();
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
