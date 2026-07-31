"use client";

import { ApiError } from "@/shared/api/client";
import { takeChatAfterLogin } from "./chatHandoff";
import { claimSession, clearCachedSession } from "./sessionCoordinator";
import { useChatStore } from "./store";
import type { ChatChannel } from "@/shared/types/chat";

/**
 * 로그인·가입 직후의 게스트 채팅 세션 승계(CH-7)와 대화 복원.
 *
 * 채팅 화면에서 로그인했을 때만 부른다 — 계약 원칙상 서버는 "어디서 로그인했는지"를
 * 추측하지 않고, FE 가 이 API 를 부르는 것으로 의도를 표현한다. 상세페이지나 장바구니에서
 * 로그인한 사람이 20분 전 다른 탭의 게스트 대화를 붙여달라고 했을 리는 없다.
 *
 * 두 가지를 잇는다:
 * - 서버 맥락 — CH-7 이 sessionId 를 유지한 채 주인만 회원으로 바꾼다(AI 가 이전 대화를 기억)
 * - 화면 말풍선 — 로그인하러 떠나며 맡겨 둔 대화를 되찾아 스토어에 되돌린다
 *
 * 승계에 실패해도 로그인 자체는 이미 성공해 있다 — 장바구니 병합·귀속 기록·쿠키 반납은
 * 로그인(A-1·A-2)이 끝낸 상태고, 여기서 실패하면 대화 맥락만 못 잇는다. 그래서 던지지 않는다.
 */
export async function claimChatSessionAfterLogin(
  channel: ChatChannel = "SHOPPING",
): Promise<void> {
  // 맡겨 둔 대화를 되찾는다(읽는 즉시 지워진다). 스토어는 라우팅으로 이미 비었으므로
  // 승계 대상 sessionId 도 여기서 나온다.
  const handoff = takeChatAfterLogin();
  if (!handoff) return;

  const { messages, sessionId } = handoff;

  if (!sessionId) {
    // 대화는 있는데 세션이 없다 — 발급 전에 로그인한 경우. 말풍선만 되돌리고
    // 다음 전송에서 회원 신원으로 새로 발급받는다.
    if (messages.length) useChatStore.getState().setMessages(messages);
    return;
  }

  try {
    const session = await claimSession(channel, sessionId);
    // 승계 성공 — 같은 sessionId 에 회원 티켓이 실려 온다. 대화가 그대로 이어진다.
    useChatStore.getState().setSessionId(session.sessionId);
    if (messages.length) useChatStore.getState().setMessages(messages);
  } catch (err) {
    // 409 SESSION_ACTIVE 는 "스트리밍 종료 후 1회 재시도" 권장이지만, 로그인 직후엔
    // 스트림이 돌고 있을 여지가 거의 없고 여기서 기다리면 화면 전환이 늦어진다.
    // 나머지(403·404·409 CLAIM_CONFLICT·503)는 전부 "새 세션으로 가라"는 뜻이다.
    //
    // 어느 쪽이든 낡은 세션을 캐시에 남기면 안 된다 — 승계 못 한 게스트 세션을 계속
    // 물고 있으면 구 게스트 티켓으로 스트림을 열다 AI 가 403 으로 막는다.
    if (err instanceof ApiError) {
      clearCachedSession(channel);
      useChatStore.getState().setSessionId(null);
    }
    // 말풍선은 되돌린다 — 서버 맥락은 끊겼어도 사용자가 하던 얘기는 보여야
    // "로그인했더니 대화가 사라졌다"가 되지 않는다.
    if (messages.length) useChatStore.getState().setMessages(messages);
  }
}
