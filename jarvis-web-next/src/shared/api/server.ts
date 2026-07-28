import "server-only";
import { cache } from "react";

// 봉투 타입을 client.ts에서 가져오지 않고 여기에 다시 적는다.
// client.ts는 클라이언트 전용 모듈(axios 인스턴스·authStore·window 참조)이라
// 타입만 import해도 모듈 그래프가 이어져 'server-only'가 클라이언트 번들로 샌다.
// 구조는 백엔드 공통 응답 계약이라 양쪽이 같아야 한다 — 계약이 바뀌면 둘 다 고칠 것.
interface ApiErrorBody {
  code: string;
  message: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorBody;
}

/**
 * 서버 컴포넌트 전용 데이터 조회.
 *
 * `shared/api/client.ts`(axios)를 서버에서 쓰지 않는 이유:
 *  - 요청 인터셉터가 authStore(메모리 AT)를 읽는다 — 서버엔 그 상태가 없다
 *  - 응답 인터셉터가 401에서 `window.location`으로 리다이렉트한다 — 서버엔 window가 없다
 *  - axios 인스턴스는 모듈 싱글턴이라 요청 간에 공유된다
 *
 * 그래서 여기서는 인증 없이 공개 API만 부른다(상품·브랜드·홈).
 * 인증이 필요한 화면은 지금처럼 클라이언트에서 조회한다(계획서 비목표).
 *
 * `server-only`: 이 모듈이 클라이언트 번들에 섞이면 빌드가 실패하도록 강제한다.
 */

// 서버에서 백엔드로 나가는 주소. 브라우저용(NEXT_PUBLIC_*)과 분리한다 —
// 컨테이너 안에서는 백엔드가 다른 호스트일 수 있다.
const BASE =
  process.env.API_PROXY_TARGET ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

/** 서버 조회 실패. 호출부가 status로 분기한다(404 → notFound 등). */
export class ServerFetchError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ServerFetchError";
    this.status = status;
    this.code = code;
  }
}

interface ServerFetchOptions {
  /** 초 단위 재검증 주기. 생략 시 캐시하지 않는다(요청마다 조회). */
  revalidate?: number;
}

/**
 * 공개 API GET. 백엔드 공통 봉투({success, data, error})를 벗겨 data를 반환한다.
 * 봉투 규약은 client.ts의 응답 인터셉터와 동일하게 맞춘다.
 */
export async function serverGet<T>(
  path: string,
  options: ServerFetchOptions = {},
): Promise<T> {
  const { revalidate } = options;

  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
    // revalidate가 없으면 매 요청 조회(재고·가격이 실시간이어야 하는 화면 대비).
    ...(revalidate === undefined
      ? { cache: "no-store" as const }
      : { next: { revalidate } }),
  });

  // 봉투가 실려 오면 에러도 그 안에 있다 — code를 살려 호출부가 분기할 수 있게 한다.
  let body: ApiEnvelope<T> | undefined;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    body = undefined;
  }

  if (!res.ok) {
    const error: ApiErrorBody | undefined = body?.error;
    throw new ServerFetchError(
      error?.message ?? `request failed: ${res.status}`,
      res.status,
      error?.code,
    );
  }

  // success:false가 HTTP 200으로 오는 경우도 방어한다(client.ts와 동일 정책).
  if (body && typeof body === "object" && "success" in body) {
    if (!body.success) {
      throw new ServerFetchError(
        body.error?.message ?? "요청을 처리하지 못했습니다.",
        res.status,
        body.error?.code,
      );
    }
    return body.data as T;
  }

  return body as T;
}

/**
 * 요청 단위 중복 제거 래퍼.
 *
 * `generateMetadata`와 `page`가 같은 데이터를 각각 부르면 요청당 API가 2번 나간다.
 * React `cache()`는 같은 렌더 패스 안에서 동일 인자 호출을 1회로 합친다.
 * (네이티브 fetch의 자동 dedupe도 있지만, revalidate 옵션이 다르면 별개 항목이 되므로
 *  호출부가 같은 함수를 쓰도록 여기서 한 번 더 묶는다.)
 */
export function cachedGet<A extends unknown[], T>(
  fn: (...args: A) => Promise<T>,
): (...args: A) => Promise<T> {
  return cache(fn);
}
