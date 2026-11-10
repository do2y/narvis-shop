import http from "node:http";
import type { Socket } from "node:net";

/**
 * 테스트 전용 백엔드 — 앱의 `/api/**` 를 받는다. 실제 백엔드에는 요청하지 않는다.
 *
 * 경로: 브라우저 → Next(`app/api/[...path]` 로컬 프록시) → API_PROXY_TARGET = 이 서버.
 * (운영에선 nginx 가 /api 를 spring 으로 보내는 자리다. 로컬엔 nginx 가 없어 이 프록시가 대신한다.)
 *
 * ⚠️ Playwright `route()` 로 가로채지 않는 이유: 1.65.0 은 요청 가로채기가 하나라도 켜져 있으면
 * **모든 CORS 사전 요청을 브라우저 안에서 허용 응답으로 직접 처리한다**
 * (playwright-core coreBundle.js `isInterceptedOptionsPreflight`). 그러면 교차 출처 SSE 의
 * 사전 요청이 SSE 서버에 닿지 않아 CORS 검증이 공허해진다 — 하네스 스모크에서 실제로 겪었다.
 *
 * 포트가 고정인 이유: Next 서버는 테스트 전에 한 번 뜨고, 그때 API_PROXY_TARGET 이 정해진다.
 * 테스트마다 같은 포트로 새 서버를 띄워 기록이 섞이지 않게 한다(workers=1 전제).
 *
 * 등록하지 않은 경로는 404(E2E_UNHANDLED)로 끝내고 `unhandled` 에 기록한다.
 */

export const API_PORT = Number(process.env.E2E_API_PORT ?? 4010);
export const API_TARGET = `http://127.0.0.1:${API_PORT}`;

export interface ApiCall {
  method: string;
  path: string;
  body: unknown;
}

export interface ApiResponse {
  status: number;
  json: unknown;
}

/** 응답을 돌려줄 때까지 기다릴 수 있다 — 시나리오가 "조회를 붙잡아 두기"에 쓴다 */
type Handler = (call: ApiCall) => ApiResponse | Promise<ApiResponse>;

interface Registration {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

export interface ApiMock {
  /** 같은 경로를 다시 등록하면 나중 것이 이긴다 — 시나리오별 덮어쓰기용 */
  on(method: string, pattern: RegExp, handler: Handler): void;
  /** 처리된 호출 전체(도착 순서) */
  readonly calls: ApiCall[];
  /** 등록되지 않아 404 로 끝낸 호출 */
  readonly unhandled: ApiCall[];
  close(): Promise<void>;
}

export const ok = (data: unknown): ApiResponse => ({
  status: 200,
  json: { success: true, data },
});

export const fail = (status: number, code: string): ApiResponse => ({
  status,
  json: { success: false, error: { code, message: code } },
});

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(raw);
      }
    });
    req.on("error", reject);
  });
}

export async function startApiMock(): Promise<ApiMock> {
  const registrations: Registration[] = [];
  const calls: ApiCall[] = [];
  const unhandled: ApiCall[] = [];
  const sockets = new Set<Socket>();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", API_TARGET);
    const call: ApiCall = {
      method: req.method ?? "GET",
      path: url.pathname,
      body: await readBody(req),
    };
    const match = [...registrations]
      .reverse()
      .find((r) => r.method === call.method && r.pattern.test(call.path));
    let response: ApiResponse;
    if (match) {
      calls.push(call);
      response = await match.handler(call);
    } else {
      unhandled.push(call);
      response = fail(404, "E2E_UNHANDLED");
    }
    res
      .writeHead(response.status, { "Content-Type": "application/json" })
      .end(JSON.stringify(response.json));
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(API_PORT, "127.0.0.1", resolve);
  });

  return {
    on(method, pattern, handler) {
      registrations.push({ method, pattern, handler });
    },
    calls,
    unhandled,
    close() {
      for (const socket of sockets) socket.destroy();
      return new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}

/** 구매자 게스트 기본값 — 각 시나리오가 필요한 경로만 덮어쓴다 */
export function useGuestShoppingDefaults(
  api: ApiMock,
  { llmSseUrl }: { llmSseUrl: string },
): void {
  // 게스트: refresh·me 모두 401(AUTH_REQUIRED). 복원 경로는 리다이렉트하지 않는다
  api.on("POST", /^\/api\/auth\/refresh$/, () => fail(401, "AUTH_REQUIRED"));
  api.on("GET", /^\/api\/auth\/me$/, () => fail(401, "AUTH_REQUIRED"));

  // 인기상품은 비워 둔다 — 패널이 인기상품으로 채워지면 추천 카드 단언과 섞인다
  api.on("GET", /^\/api\/products\/popular$/, () => ok({ items: [] }));

  // 헤더 장바구니 배지(게스트도 조회한다) — Cart 계약(shared/types/cart.ts)의 빈 장바구니
  api.on("GET", /^\/api\/cart$/, () =>
    ok({ items: [], totalOriginal: 0, totalSale: 0, discount: 0 }),
  );

  // 수집(배경 작업) — 화면과 무관하므로 받기만 한다
  api.on("POST", /^\/api\/events/, () => ok({ accepted: true }));

  // CH-1 세션 발급 · CH-1b 티켓 재발급 — llmSseUrl 로 테스트 SSE 서버를 내려준다
  const session = {
    sessionId: "e2e-session-1",
    ttlSeconds: 600,
    streamTicket: "e2e-ticket-1",
    ticketTtlSeconds: 60,
    llmSseUrl,
  };
  api.on("POST", /^\/api\/chat\/sessions$/, () => ok(session));
  api.on("POST", /^\/api\/chat\/tickets$/, () => ok(session));
}

/**
 * 목록 id 에서 상품 id 를 결정적으로 만든다 — 계약상 productId 는 **숫자 문자열**이다
 * (서버 64비트 id, src/shared/types/product.ts). 상세 라우트는 숫자가 아니면 조회 없이 404 다.
 * 같은 테스트의 서로 다른 목록끼리 겹치지 않아야 한다(카드 키·상세 캐시 시딩이 productId 기준).
 *
 * 형식: FNV-1a 32비트 해시(10진) + 두 자리 순번. 최대 429496729599(12자리) — int64·JS 안전 정수 범위 안.
 * ⚠️ 고유성은 보장되지 않는다: 두 목록 id 의 해시가 같으면 충돌한다(목록당 카드 99개 이하일 때 그 경우뿐).
 * 2026-11-10 기준 픽스처 목록 id 5개는 해시가 모두 달라 충돌이 없음을 계산으로 확인했다 —
 * 목록 id 를 추가하면 다시 확인할 것. 2^53 을 넘는 실제 규모의 id 는 이 픽스처로 다루지 않는다.
 */
function productIdFor(listId: string, index: number): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < listId.length; i++) {
    hash ^= listId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash}${String(index + 1).padStart(2, "0")}`;
}

/** CH-5 응답 — ChatListResponse 계약 필드만 쓴다 */
export function chatList(listId: string, names: string[]) {
  return {
    listId,
    recommendationRequestId: `e2e-req-${listId}`,
    listType: "PICK_ONE",
    itemsDropped: 0,
    items: names.map((name, i) => ({
      productId: productIdFor(listId, i),
      name,
      brandName: "E2E 브랜드",
      price: 59000 + i * 1000,
      originalPrice: 69000 + i * 1000,
      // 같은 출처 정적 파일 — 외부 이미지 호스트에 요청하지 않는다
      imageUrl: "/logo-mark.png",
      rating: 4.5,
      reviewCount: 10 + i,
      reason: null,
    })),
  };
}
