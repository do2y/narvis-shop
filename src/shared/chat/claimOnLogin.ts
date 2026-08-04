"use client";

import { loadChat, saveChat } from "./chatPersistence";
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
  // 저장된 대화에서 승계 대상 sessionId 를 얻는다. 화면 복원은 채팅 페이지가
  // 마운트 시점에 따로 하므로(useRestoreChat) 여기선 세션만 갈아끼운다.
  const saved = loadChat();
  if (!saved?.sessionId) return; // 대화가 없거나 세션 발급 전이면 승계할 것도 없다

  try {
    const session = await claimSession(channel, saved.sessionId);
    // 승계 성공 — 같은 sessionId 에 회원 티켓이 실려 온다. 대화가 그대로 이어진다.
    useChatStore.getState().setSessionId(session.sessionId);
    saveChat({ ...saved, sessionId: session.sessionId });
  } catch {
    // 409 SESSION_ACTIVE 는 "스트리밍 종료 후 1회 재시도" 권장이지만, 로그인 직후엔
    // 스트림이 돌고 있을 여지가 거의 없고 여기서 기다리면 화면 전환이 늦어진다.
    // 나머지(403·404·409 CLAIM_CONFLICT·503)는 전부 "새 세션으로 가라"는 뜻이다.
    //
    // 어느 쪽이든 낡은 세션을 캐시에 남기면 안 된다 — 승계 못 한 게스트 세션을 계속
    // 물고 있으면 구 게스트 티켓으로 스트림을 열다 AI 가 403 으로 막는다.
    // 말풍선은 그대로 남는다(저장소를 지우지 않는다) — 서버 맥락은 끊겼어도
    // 사용자가 하던 얘기는 보여야 "로그인했더니 대화가 사라졌다"가 되지 않는다.
    //
    // 다만 sessionId 만 비우고 끝내면 다음 전송이 조용히 새 세션을 만들어
    // "화면엔 대화가 있는데 AI 는 기억 못 하는" 어긋남이 생긴다. 그래서 실패를
    // 스토어에 남겨 배너로 알리고, 재시도/새 대화를 사용자가 고르게 한다.
    //
    // 에러 종류로 거르지 않는다 — ApiError(서버가 코드로 거절)뿐 아니라 네트워크
    // 단절·타임아웃처럼 응답 자체가 없는 실패도 "승계 못 함"은 똑같다. 좁게 잡으면
    // 그 경우 배너 없이 조용히 넘어가 버린다(실제로 그렇게 새던 것을 잡았다).
    clearCachedSession(channel);
    const store = useChatStore.getState();
    store.setSessionId(null);
    store.setClaimFailure({ sessionId: saved.sessionId, retrying: false });
    // 재시도 대상을 저장소에도 남긴다 — 로그인 직후 /chat 으로 이동하는 사이
    // 새로고침이 끼면 스토어(메모리)가 날아가 배너와 재시도가 사라진다.
    saveChat({
      ...saved,
      sessionId: null,
      claimFailedSessionId: saved.sessionId,
    });
  }
}

/**
 * 승계 재시도 — 배너의 "다시 시도". 성공하면 배너가 사라지고 대화가 이어진다.
 *
 * 실패해도 배너를 유지한다(사용자가 원하는 만큼 다시 누를 수 있다) — 서버가 잠시
 * 불안정한 경우(503)엔 재시도가 유효하고, 영구 실패(404 만료)라도 "새 대화"를
 * 고르는 건 사용자 몫이지 우리가 대신 정할 일이 아니다.
 *
 * @returns 승계 성공 여부
 */
export async function retryClaimChatSession(
  channel: ChatChannel = "SHOPPING",
): Promise<boolean> {
  const store = useChatStore.getState();
  const failure = store.claimFailure;
  // 이미 재시도 중이면 중복 요청하지 않는다(버튼 연타 방어)
  if (!failure || failure.retrying) return false;

  store.setClaimRetrying(true);
  try {
    const session = await claimSession(channel, failure.sessionId);
    // 성공 — 배너를 걷고 세션을 되살린다. 저장소의 재시도 대상도 함께 비운다.
    const saved = loadChat();
    store.setSessionId(session.sessionId);
    store.setClaimFailure(null);
    if (saved) {
      saveChat({
        ...saved,
        sessionId: session.sessionId,
        claimFailedSessionId: null,
      });
    }
    return true;
  } catch {
    // 배너 유지 — retrying 만 내려 버튼을 다시 누를 수 있게 한다
    store.setClaimRetrying(false);
    return false;
  }
}

/**
 * 승계를 포기하고 그대로 진행 — 배너의 "기억 없이 계속".
 *
 * 대화 말풍선은 남기고 서버 맥락만 포기한다. 배너를 걷으면 다음 전송에서
 * ensureSession 의 발급 차단(allowCreate)이 풀려 새 세션이 만들어진다.
 * 원래 막으려던 건 "조용히" 그렇게 되는 것이지, 사용자가 알고 고르는 건 막을 일이 아니다.
 *
 * 저장소의 재시도 대상도 비운다 — 안 그러면 새로고침에 배너가 되살아나
 * 방금 내린 결정이 없던 일이 된다.
 */
export function dismissClaimFailure(): void {
  const store = useChatStore.getState();
  if (!store.claimFailure) return;
  store.setClaimFailure(null);
  const saved = loadChat();
  if (saved) saveChat({ ...saved, claimFailedSessionId: null });
}
