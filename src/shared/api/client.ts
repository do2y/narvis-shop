import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getSessionKey } from "@/shared/analytics/sessionKey";
import { refreshAccessToken } from "@/shared/auth/refresh";
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

/**
 * 주문 불가 항목 한 줄 — O-1 ORDER_PRODUCT_UNAVAILABLE의 detail.unavailableItems.
 *
 * optionId·optionName은 2026-08-09 옵션별 재고 전환으로 추가됐다.
 * 옵션 없는 상품과 HIDDEN 사유는 둘 다 null이므로 표기는 조건부여야 한다(명세).
 */
export interface UnavailableItem {
  productId: string;
  name: string;
  reason: "SOLD_OUT" | "HIDDEN";
  optionId: string | null;
  optionName: string | null;
}

// 언래핑된 에러. 컴포넌트/훅은 err.code로 분기, err.message는 표시용.
// AxiosError 대신 이걸 throw하므로 호출부는 봉투 구조를 몰라도 됨.
export class ApiError extends Error {
  code: string;
  status?: number;
  fields?: ApiFieldError[];
  detail?: ApiErrorDetail;
  /**
   * 429 RATE_LIMITED에 동반되는 Retry-After 헤더값(초) — A-1·A-2, 2026-08-04.
   *
   * 본문이 아니라 헤더로 오므로 봉투를 벗기는 자리에서 같이 실어준다.
   * 계정 잠금이 아니라 일시 차단이라, 이 초만큼 지나면 자동으로 풀린다.
   */
  retryAfterSeconds?: number;
  constructor(body: ApiErrorBody, status?: number, retryAfterSeconds?: number) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.status = status;
    this.fields = body.fields;
    this.detail = body.detail;
    this.retryAfterSeconds = retryAfterSeconds;
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
  get options(): { optionId: string; name: string; extraPrice: number }[] | undefined {
    const value = this.detail?.options;
    if (!Array.isArray(value)) return undefined;
    const parsed = value.filter(
      (o): o is { optionId: string; name: string; extraPrice: number } =>
        typeof o === "object" &&
        o !== null &&
        // optionId 는 문자열이다(2026-08-06) — 64비트 ID라 number 로 파싱하면
        // 끝자리가 조용히 바뀐다. ProductOption 주석 참조.
        typeof (o as { optionId?: unknown }).optionId === "string" &&
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
   *
   * optionId·optionName은 2026-08-09 옵션별 재고 전환으로 추가됐다. 재고가 옵션마다
   * 따로라 같은 상품의 한 옵션만 품절일 수 있고, 그러면 상품명만으로는 사용자가
   * 어느 줄을 빼야 할지 알 수 없다. 옵션 없는 상품과 HIDDEN 사유는 둘 다 null이다.
   */
  get unavailableItems(): UnavailableItem[] | undefined {
    const value = this.detail?.unavailableItems;
    if (!Array.isArray(value)) return undefined;
    const parsed = value
      .filter(
        (i): i is Record<string, unknown> =>
          typeof i === "object" &&
          i !== null &&
          typeof (i as { name?: unknown }).name === "string" &&
          ((i as { reason?: unknown }).reason === "SOLD_OUT" ||
            (i as { reason?: unknown }).reason === "HIDDEN"),
      )
      // 옵션 두 필드는 명세상 null이 정상값이고, 필드 자체가 없는 구버전 응답도 있다.
      // 문자열이 아닌 건 전부 null로 접어 읽는 쪽이 한 가지만 검사하게 한다.
      .map<UnavailableItem>((i) => ({
        productId: String(i.productId ?? ""),
        name: i.name as string,
        reason: i.reason as "SOLD_OUT" | "HIDDEN",
        optionId: typeof i.optionId === "string" ? i.optionId : null,
        optionName: typeof i.optionName === "string" ? i.optionName : null,
      }));
    return parsed.length ? parsed : undefined;
  }
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  // AT(Path=/)·RT(Path=/api/auth) 모두 httpOnly 쿠키로 오가므로 자격증명 동봉 필요.
  // 브라우저가 자동 첨부하므로 Authorization 헤더를 다는 요청 인터셉터는 없다.
  withCredentials: true,
});

/**
 * 개발 전용 요청 로그 (브라우저 콘솔).
 *
 * 봉투를 벗기고 401 재시도까지 인터셉터가 처리하므로, 화면에서 무슨 호출이 언제
 * 나갔는지는 여기 말고는 볼 곳이 없다. `NODE_ENV`로 막아 프로덕션 번들에는
 * 들어가지 않는다(응답 body가 콘솔에 남는 것도 막는다).
 */
const DEBUG_API = process.env.NODE_ENV === "development";

function logRequest(config: InternalAxiosRequestConfig) {
  if (!DEBUG_API) return config;
  const method = (config.method ?? "get").toUpperCase();
  console.log(
    `%c[api →] ${method} ${config.url ?? ""}`,
    "color:#888",
    config.params ?? "",
  );
  return config;
}

if (DEBUG_API) api.interceptors.request.use(logRequest);

/**
 * 서버가 행동 이벤트를 적재하는 요청에 X-Session-Key 를 싣는다 (E-1).
 *
 * 담기·삭제·수량변경(2026-08-06)과 결제 완료(2026-08-11 이관)는 FE track() 이 아니라
 * BE 가 afterCommit 으로 적재한다. 서버는 이 헤더로만 방문 세션을 알 수 있다 —
 * member_id·guest_id 는 JWT·쿠키에서 뽑지만 sessionKey 는 FE 가 localStorage 로
 * 관리하는 값이라 그렇다.
 *
 * 주문(O-1·O-2)이 대상에 들어온 이유: purchase_complete 의 producer 가 FE → 서버로
 * 바뀌었다(2026-08-11). 헤더가 없으면 결제는 정상 처리되지만 이벤트만 스킵되어
 * 퍼널의 마지막 단이 계속 비고, S-1 aiAttribution.coverage 분자가 0이 된다.
 *
 * 조회(GET)에는 붙이지 않는다. 적재 대상이 상태를 바꾸는 요청뿐이다.
 *
 * 값을 모듈 로드 시점에 캐시하지 않고 **요청 시점에** 읽는 이유: sessionKey 는
 * 30분 무활동이면 재발급되는데, 캐시하면 만료된 옛 키를 계속 보내게 된다.
 */
// startsWith 로 맞추므로 접두사가 경계에서 끊기는지 확인할 것 — "/api/orders" 는
// "/api/orders/1/retry-payment"(O-2)까지 함께 덮는다. 둘 다 적재 지점이라 의도한 것이다.
const SESSION_KEY_PATHS = ["/api/cart/items", "/api/orders"];

/**
 * 이 요청에 X-Session-Key 를 실어야 하나.
 *
 * 인터셉터에서 분리해 둔 이유: 붙는 곳이 곧 "서버가 이벤트를 적재하는 지점"이라
 * 조건이 어긋나면 에러 없이 이벤트만 조용히 빠진다 — 테스트로 고정할 수 있게 한다.
 */
export function shouldAttachSessionKey(url: string, method: string): boolean {
  if (method.toLowerCase() === "get") return false;
  return SESSION_KEY_PATHS.some((path) => url.startsWith(path));
}

function attachSessionKey(config: InternalAxiosRequestConfig) {
  const url = config.url ?? "";
  const method = config.method ?? "get";
  if (!shouldAttachSessionKey(url, method)) return config;

  try {
    config.headers.set("X-Session-Key", getSessionKey().sessionKey);
  } catch {
    // localStorage 차단(사파리 프라이빗 등) — 헤더 없이 보낸다.
    // 명세상 헤더가 없으면 담기는 정상 처리되고 이벤트만 스킵된다.
  }
  return config;
}

api.interceptors.request.use(attachSessionKey);

/**
 * Retry-After 헤더(초)를 읽는다 — 429 RATE_LIMITED 동반(A-1·A-2).
 *
 * RFC 7231은 초(delta-seconds)와 HTTP-date 두 형식을 허용하지만 백엔드는 초로 보낸다.
 * 그래도 날짜가 오면 화면에 NaN이 뜨므로, 숫자로 파싱되지 않으면 undefined로 접는다 —
 * 읽는 쪽이 "안내 문구만 띄우고 차단은 하지 않는" 폴백을 갖고 있다.
 *
 * ⚠️ 대괄호 접근(`headers["retry-after"]`)을 쓰지 말 것 — AxiosHeaders 는 서버가 보낸
 * 원래 대소문자를 그대로 보존해서, 표준 표기인 `Retry-After` 로 오면 소문자 키로는
 * undefined 가 나온다. 그러면 조용히 카운트다운이 영영 안 뜬다(타입 에러도 안 남).
 * `.get()` 이 대소문자를 무시하고 찾아준다.
 */
export function readRetryAfter(error: AxiosError): number | undefined {
  const headers = error.response?.headers;
  // 테스트·목에서 평범한 객체가 올 수 있어 .get 이 없으면 양쪽 표기를 직접 본다.
  const raw =
    typeof headers?.get === "function"
      ? headers.get("retry-after")
      : ((headers as Record<string, unknown> | undefined)?.["retry-after"] ??
        (headers as Record<string, unknown> | undefined)?.["Retry-After"]);
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}

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
    if (DEBUG_API) {
      const method = (res.config.method ?? "get").toUpperCase();
      console.log(
        `%c[api ←] ${res.status} ${method} ${res.config.url ?? ""}`,
        "color:#2a8",
        res.data,
      );
    }
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
    if (error instanceof ApiError) {
      if (DEBUG_API) console.warn(`[api ✕] ${error.code} ${error.message}`);
      return Promise.reject(error);
    }

    const axiosError = error as AxiosError<ApiEnvelope<unknown>>;
    if (DEBUG_API) {
      const method = (axiosError.config?.method ?? "get").toUpperCase();
      console.warn(
        `[api ✕] ${axiosError.response?.status ?? "network"} ${method} ${
          axiosError.config?.url ?? ""
        }`,
        axiosError.response?.data ?? axiosError.message,
      );
    }
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
        // refresh는 공용 single-flight를 쓴다. RT가 1회용 회전이라 analytics 등 다른 경로가
        // 동시에 401을 맞아도 /refresh는 한 번만 나가야 한다.
        await refreshAccessToken();
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
      return Promise.reject(
        new ApiError(body.error, status, readRetryAfter(axiosError)),
      );
    }
    return Promise.reject(axiosError);
  },
);
