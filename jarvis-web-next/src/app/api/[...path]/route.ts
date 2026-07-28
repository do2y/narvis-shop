import type { NextRequest } from "next/server";

/**
 * /api/* 백엔드 프록시 — dev·prod 공용.
 *
 * rewrites()를 쓰지 않는 이유: Route Handler는 파일시스템 라우트라 rewrites보다 먼저
 * 매칭된다. "dev만 Route Handler + prod는 rewrites" 조합은 성립하지 않으므로
 * (prod에서도 이 파일이 /api/*를 가로챈다) 아예 전 환경 공용 프록시로 둔다.
 *
 * dev에서만 Set-Cookie를 재작성한다 — 백엔드 RT 쿠키는 `Secure; SameSite=Strict`로
 * 내려오는데 로컬은 http라 브라우저가 Secure 쿠키를 저장하지 않는다. 그러면
 * /api/auth/refresh가 항상 401(AUTH_REQUIRED) → 인터셉터가 /login으로 튕겨
 * 로그인 자체가 불가능해진다. (원본 vite.config.ts의 proxyRes 훅과 동일 목적)
 */

// 프록시 응답은 절대 캐시되면 안 된다.
export const dynamic = "force-dynamic";

// 서버에서 백엔드로 나갈 주소. 브라우저용 NEXT_PUBLIC_*과 분리한다 —
// 컨테이너 안에서는 백엔드가 다른 호스트일 수 있다(5단계에서 네트워크 구성 확인).
const TARGET =
  process.env.API_PROXY_TARGET ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

const isDev = process.env.NODE_ENV === "development";

// 홉 단위 헤더 — 프록시가 그대로 전달하면 안 된다(RFC 7230).
// content-length는 스트림 전달 시 실제 길이와 어긋날 수 있어 fetch가 다시 계산하게 둔다.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "host",
]);

function filterHeaders(source: Headers): Headers {
  const out = new Headers();
  source.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out.set(key, value);
  });
  return out;
}

/**
 * dev 한정 쿠키 완화 — Secure 제거, SameSite=Lax.
 * 프록시 덕에 브라우저 기준 same-origin이라 이 완화는 로컬에서만 유효하고 안전하다.
 */
function relaxCookieForDev(cookie: string): string {
  return cookie
    .replace(/;\s*Secure/gi, "")
    .replace(/;\s*SameSite=\w+/gi, "; SameSite=Lax");
}

async function handler(req: NextRequest): Promise<Response> {
  // /api/... 경로를 그대로 백엔드에 넘긴다(쿼리스트링 포함).
  const url = new URL(req.url);
  const upstreamUrl = `${TARGET}${url.pathname}${url.search}`;

  // GET/HEAD는 body가 없다. 그 외는 요청 스트림을 그대로 흘려보낸다 —
  // 스트림을 넘길 때 Node fetch는 duplex: 'half'가 필수다(없으면 런타임 에러).
  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers: filterHeaders(req.headers),
    body: hasBody ? req.body : undefined,
    ...(hasBody ? { duplex: "half" } : {}),
    redirect: "manual",
    // 백엔드 응답을 캐시하지 않는다.
    cache: "no-store",
  } as RequestInit & { duplex?: "half" });

  const headers = filterHeaders(upstream.headers);

  // Set-Cookie는 한 응답에 여러 개가 올 수 있다(AT 갱신 + RT 재발급 동시).
  // headers.get()은 콤마로 합쳐버려 쿠키 값이 깨지므로 getSetCookie()로 개별 처리한다.
  headers.delete("set-cookie");
  const cookies = upstream.headers.getSetCookie();
  for (const cookie of cookies) {
    headers.append("set-cookie", isDev ? relaxCookieForDev(cookie) : cookie);
  }

  // body를 버퍼링하지 않고 그대로 흘린다(스트리밍 응답 대비).
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
  handler as OPTIONS,
};
