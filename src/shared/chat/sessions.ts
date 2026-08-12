import { api } from "@/shared/api/client";
import type { ChatChannel, ChatSession } from "@/shared/types/chat";

/**
 * 챗 스트림 진입 티켓 발급.
 * SSE 연결 전에 로그인 AT 를 단명 streamTicket 으로 교환한다(신원·brandId 는 서버가 도출).
 * 이 요청은 Spring REST(공통 api 인스턴스: AT 자동 첨부 + 401 refresh)로 나간다.
 * SSE 요청과 달리 fetch 스트리밍이 아니므로 axios 를 쓴다.
 */

/**
 * 판매자 챗 세션·티켓 발급 — POST /api/chat/seller/sessions.
 * 입구 자체가 SELLER 전용(body 없음). brandId 는 JWT→DB 로 서버가 도출해 티켓 claim 에 박는다.
 * 실패: 401(미인증) / 403(SELLER 아님) / 404 SELLER_BRAND_NOT_FOUND(연결 브랜드 없음) → ApiError 로 전파.
 */
export async function openSellerSession(): Promise<ChatSession> {
  const res = await api.post<ChatSession>("/api/chat/seller/sessions");
  return res.data;
}

/**
 * 구매자 챗 세션·티켓 발급 — POST /api/chat/sessions.
 * 유효한 channel 은 SHOPPING 뿐이다(2026-08-11 CS 폐기). 생략 시 SHOPPING 이며
 * SELLER 는 이 입구로 발급할 수 없다 — brandId 를 서버가 도출해야 해서 CH-6 이 유일한 입구다.
 * 게스트는 guest_id 쿠키로 식별(AT 없어도 됨).
 */
export async function openChatSession(
  channel: Exclude<ChatChannel, "SELLER"> = "SHOPPING",
): Promise<ChatSession> {
  const res = await api.post<ChatSession>("/api/chat/sessions", { channel });
  return res.data;
}

/**
 * 스트림 티켓 재발급(CH-1b) — POST /api/chat/tickets.
 * 기존 세션을 유지한 채 새 SSE 연결용 티켓만 발급한다(대화 맥락 단절 없음).
 * 셀러·구매자 공용 — 세션에 보관된 brandId/channel 로 같은 스코프 티켓을 유지한다.
 * 매 메시지 전(또는 티켓 만료 401 시) 호출.
 *
 * 실패:
 * - 404 SESSION_NOT_FOUND — 만료·미존재 sessionId → 호출부는 세션 발급(CH-6/CH-1)으로 폴백.
 * - 403 SESSION_FORBIDDEN — 요청 신원 ≠ 세션 소유자(sessionId 만 알아도 남의 티켓 못 받음).
 */
export async function reissueTicket(sessionId: string): Promise<ChatSession> {
  const res = await api.post<ChatSession>("/api/chat/tickets", { sessionId });
  return res.data;
}

/**
 * 채팅 세션 승계(CH-7) — POST /api/chat/sessions/{sessionId}/claim.
 * 채팅 화면에서 로그인·가입한 직후 게스트 접속을 회원으로 넘긴다. sessionId 는 유지되므로
 * 대화 맥락이 끊기지 않는다. 승계하지 않으면 게스트 세션은 TTL 10분으로 소멸한다.
 *
 * body 없음 — sessionId 는 path, 회원 신원은 AT 에서 서버가 취한다.
 * guest_id 쿠키도 보내지 않는다(로그인 시점에 이미 반납됐다) — 소유권은 서버가 귀속 기록으로 본다.
 *
 * 응답은 CH-1 과 같은 스키마이고 회원 신원의 새 티켓이 실려 온다. 승계 후 구 게스트 티켓은
 * AI 가 403 으로 막으므로 반드시 이 응답의 티켓으로 교체해야 한다.
 *
 * 실패: 403 SESSION_FORBIDDEN(남의 게스트 세션·이미 회원 소유) / 404 SESSION_NOT_FOUND(만료)
 * / 409 SESSION_ACTIVE(스트리밍 중) / 409 SESSION_CLAIM_CONFLICT(회원이 이미 그 채널 세션 보유)
 * / 503 SESSION_CLAIM_UNAVAILABLE(AI 미응답).
 */
export async function claimChatSession(
  sessionId: string,
): Promise<ChatSession> {
  const res = await api.post<ChatSession>(
    `/api/chat/sessions/${sessionId}/claim`,
  );
  return res.data;
}
