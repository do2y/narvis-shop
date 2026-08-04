"use client";

import { useEffect, useRef } from "react";
import { loadChat, saveChat } from "./chatPersistence";
import { useChatStore } from "./store";

/**
 * 대화를 탭에 살려 둔다 — 새로고침·탭 복구(Ctrl+Shift+T)로 돌아온다.
 * 채팅 화면에서 1회 호출한다.
 *
 * 복원은 마운트 시 한 번만 한다. 이후에는 스토어가 정본이고 저장만 따라간다.
 */
export function useChatPersistence(): void {
  // 복원 전에 저장이 돌면 빈 스토어가 저장된 대화를 덮어쓴다 — 순서를 강제한다.
  const restored = useRef(false);

  useEffect(() => {
    const saved = loadChat();
    if (saved?.messages.length) {
      const s = useChatStore.getState();
      s.setMessages(saved.messages);
      s.setResults(saved.results);
      if (saved.sessionId) s.setSessionId(saved.sessionId);
      // 승계 실패 미해결 상태로 새로고침된 경우 배너를 되살린다 — 안 그러면
      // 전송만 막히고(allowCreate=false) 이유를 알 길이 없다.
      if (saved.claimFailedSessionId) {
        s.setClaimFailure({
          sessionId: saved.claimFailedSessionId,
          retrying: false,
        });
      }
    }
    restored.current = true;
  }, []);

  useEffect(() => {
    // 스트리밍 중에도 매 토큰마다 쓰면 과도하므로, 구독에서 값이 바뀔 때만 저장한다.
    // (토큰 누적은 messages 를 갈아끼우므로 결국 스트림 도중에도 갱신된다 —
    //  탭이 갑자기 닫혀도 그때까지 받은 답변이 남는 게 낫다.)
    return useChatStore.subscribe((state) => {
      if (!restored.current) return;
      saveChat({
        messages: state.messages,
        sessionId: state.sessionId,
        results: state.results,
        // 스토어가 정본이므로 함께 써 준다 — 빠뜨리면 다음 저장이 재시도 대상을
        // 지워 새로고침 후 배너만 남고 "다시 시도"가 동작하지 않는다.
        claimFailedSessionId: state.claimFailure?.sessionId ?? null,
      });
    });
  }, []);
}
