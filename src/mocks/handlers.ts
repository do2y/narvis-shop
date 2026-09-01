import "server-only";

import { mockChatList } from "./chatScript";
import {
  mockBrand,
  mockCart,
  mockCategories,
  mockPopular,
  mockProductDetail,
  mockRecommended,
  mockReviews,
} from "./fixtures";

/**
 * 목 라우팅 — 경로를 픽스처에 연결한다.
 *
 * 프록시(app/api/[...path]/route.ts)가 `MOCK_API=1` 일 때만 부른다.
 * 여기서 처리하지 않는 경로는 `null` 을 돌려주고, 프록시가 평소대로 백엔드로 보낸다
 * — 목을 켜 두고도 일부만 실서버로 확인할 수 있게 하기 위해서다.
 *
 * 응답은 **봉투로 감싼다**(`{success, data}`) — client.ts 인터셉터가 벗기는 형태라
 * 감싸지 않으면 화면이 `data` 를 못 찾는다.
 */

export interface MockResult {
  status: number;
  body: unknown;
}

function ok(data: unknown): MockResult {
  return { status: 200, body: { success: true, data } };
}

function fail(status: number, code: string, message: string): MockResult {
  return { status, body: { success: false, error: { code, message } } };
}

export function resolveMock(
  method: string,
  pathname: string,
  search: URLSearchParams,
  /**
   * 요청 오리진 — 채팅 세션의 llmSseUrl 을 **절대 URL** 로 만들기 위해서만 쓴다.
   * 상대경로로 두면 판매자 리포트가 깨진다: reportsApi 가 그 값에 new URL() 을 걸어
   * origin 을 취하는데, 상대경로는 파싱되지 않아 REPORT_ENDPOINT_UNRESOLVED 로 떨어진다.
   * SSR 조회처럼 오리진을 모르는 호출부는 생략한다(채팅은 브라우저에서만 시작한다).
   */
  origin = "",
): MockResult | null {
  const path = pathname.replace(/\/+$/, "");
  const num = (key: string, fallback: number) => {
    const raw = Number(search.get(key));
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
  };

  // --- 상품 ---
  if (method === "GET" && path === "/api/products/popular") {
    return ok(mockPopular(num("size", 12)));
  }
  if (method === "GET" && path === "/api/products/recommended") {
    return ok(mockRecommended());
  }
  if (method === "GET" && path === "/api/products/recent") {
    return ok(mockPopular(4));
  }
  if (method === "GET" && path === "/api/categories") {
    return ok(mockCategories());
  }

  const reviewMatch = path.match(/^\/api\/products\/([^/]+)\/reviews$/);
  if (method === "GET" && reviewMatch) {
    return ok(mockReviews(Number(search.get("page") ?? 0) || 0));
  }

  const detailMatch = path.match(/^\/api\/products\/([^/]+)$/);
  if (method === "GET" && detailMatch) {
    return ok(mockProductDetail(detailMatch[1]));
  }

  const brandMatch = path.match(/^\/api\/brands\/([^/]+)$/);
  if (method === "GET" && brandMatch) {
    return ok(mockBrand(brandMatch[1]));
  }

  // --- 장바구니 ---
  // 변경(담기·수량·삭제)은 상태를 들고 있지 않다. 목의 목적이 화면 캡처라
  // 조회 결과만 고정으로 내려주고, 변경은 성공으로 응답해 흐름이 막히지 않게 한다.
  if (method === "GET" && path === "/api/cart") {
    return ok(mockCart());
  }
  if (path === "/api/cart/items" || path.startsWith("/api/cart/items/")) {
    return ok(mockCart());
  }

  // --- 채팅 ---
  // 세션 발급 응답의 llmSseUrl 로 목 SSE 라우트를 내려준다.
  // streamChat 은 이 값을 그대로 POST 하므로 클라이언트 코드는 손대지 않는다.
  // 상대경로인 이유: 배포 도메인을 목이 알 수 없고, 같은 오리진이라 CORS 도 필요 없다.
  // 티켓 재발급·세션 승계도 같은 세션을 돌려준다 — 목은 만료를 흉내 내지 않는다
  const isSessionIssue =
    path === "/api/chat/sessions" ||
    path === "/api/chat/seller/sessions" ||
    path === "/api/chat/tickets" ||
    /^\/api\/chat\/sessions\/[^/]+\/claim$/.test(path);
  if (method === "POST" && isSessionIssue) {
    return ok({
      sessionId: "mock-session-0001",
      ttlSeconds: 600,
      streamTicket: "mock-ticket",
      ticketTtlSeconds: 60,
      llmSseUrl: `${origin}/api/mock-chat/stream`,
    });
  }
  // CH-5 — products.ready 뒤 화면이 목록을 따로 조회한다(경로 B)
  const chatListMatch = path.match(/^\/api\/chat\/lists\/([^/]+)$/);
  if (method === "GET" && chatListMatch) {
    return ok(mockChatList(chatListMatch[1]));
  }

  // --- 찜 ---
  if (method === "GET" && path === "/api/wishlist") {
    return ok({ items: [] });
  }

  // --- 인증 ---
  // 비로그인(게스트) 상태로 고정한다. 게스트도 탐색·챗봇·장바구니 담기가 되므로
  // 홈·상세·장바구니 캡처에는 로그인이 필요 없다.
  // 로그인 화면이 필요하면 이 분기를 지우지 말고 목 사용자를 내려주도록 바꾼다.
  if (method === "GET" && path === "/api/auth/me") {
    return fail(401, "AUTH_REQUIRED", "로그인이 필요합니다.");
  }

  // --- 수집 ---
  // 배경 작업이라 실패해도 화면에 영향은 없지만, 콘솔이 지저분해지지 않게 200 으로 받는다.
  if (method === "POST" && path.startsWith("/api/events")) {
    return ok({ accepted: true });
  }

  return null;
}
