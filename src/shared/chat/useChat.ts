import { useCallback, useEffect, useRef } from "react";
import { track } from "@/shared/analytics/track";
import { streamChat } from "@/shared/chat/streamChat";
import { useAuthStore } from "@/shared/stores/authStore";
import type {
  ChatAction,
  ChatChannel,
  ChatRequest,
  ChatScreenContext,
  SellerPanel,
} from "@/shared/types/chat";
import { useChatStore } from "./store";

function newId(): string {
  return crypto.randomUUID();
}

// 게스트 식별자 — 세션 동안 유지(대화 맥락용). 로그인 사용자는 userId 사용
function getGuestId(): string {
  const KEY = "jarvis-guest-id";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

interface UseChatOptions {
  channel: ChatChannel;
  brandId?: number; // SELLER 채널 전용
  /** 채널별 액션 후처리(장바구니 invalidate 등). 안내 문구 표시는 공통 처리. */
  onAction?: (action: ChatAction) => void;
  /**
   * 스트림 종료 시 우측 패널 조치(판매자 전용). done.panel 을 그대로 전달한다.
   * replace(패널 교체) / keep(유지) / refresh(목록 재조회). error 로 끝나면 호출되지 않는다.
   */
  onDone?: (panel: SellerPanel | undefined) => void;
  /**
   * 전송 시점의 화면 맥락을 반환하는 함수(사이드 채팅 전용).
   * 값이 아닌 함수로 받는 이유: 사용자가 목록을 이동하며 대화하므로
   * 훅 초기화 시점이 아니라 매 전송 시점의 화면을 실어야 한다.
   */
  getScreenContext?: () => ChatScreenContext | undefined;
}

export function useChat({
  channel,
  brandId,
  onAction,
  onDone,
  getScreenContext,
}: UseChatOptions) {
  const user = useAuthStore((s) => s.user);
  const {
    isStreaming,
    addMessage,
    appendToLastAssistant,
    failLastAssistant,
    setResults,
    addResult,
    settleDraft,
    setConditions,
    setSessionId,
    setThreadId,
    setStreaming,
    setLane,
    setProgress,
    reset,
  } = useChatStore();

  // 진행 중 요청 취소용
  const abortRef = useRef<AbortController | null>(null);

  // 콜백들은 매 렌더 갱신되도록 ref로 보관(send의 deps를 안정적으로 유지)
  const onActionRef = useRef(onAction);
  const onDoneRef = useRef(onDone);
  const getScreenContextRef = useRef(getScreenContext);
  useEffect(() => {
    onActionRef.current = onAction;
    onDoneRef.current = onDone;
    getScreenContextRef.current = getScreenContext;
  });

  /**
   * 스트림 실행 공통부 — 일반 발화(send)와 승인(confirm)이 공유한다.
   * userText 가 있으면 사용자 말풍선을 추가하고(발화), confirm 은 말풍선 없이 실행만 한다.
   */
  const run = useCallback(
    async (
      buildReq: (base: {
        sessionId: string;
        threadId: string;
      }) => ChatRequest,
      userText: string | null,
    ) => {
      if (useChatStore.getState().isStreaming) return;

      if (userText !== null) {
        addMessage({ id: newId(), role: "user", text: userText });
      }
      // 스트리밍으로 채워질 빈 assistant 메시지 선 추가
      addMessage({ id: newId(), role: "assistant", text: "" });
      setStreaming(true);
      setLane(null);
      setProgress(null);

      // 한 응답 안에서 여러 결과 이벤트가 올 수 있다. 첫 결과가 도착할 때
      // 이전 턴의 결과를 비우고, 그 뒤부터는 누적한다.
      let replacedResults = false;
      const pushResult: typeof addResult = (result) => {
        if (!replacedResults) {
          replacedResults = true;
          setResults([result]);
          return;
        }
        addResult(result);
      };

      const state = useChatStore.getState();
      const req = buildReq({
        sessionId: state.sessionId ?? "",
        threadId: state.threadId ?? "",
      });

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          req,
          (e) => {
            switch (e.type) {
              case "meta":
                // 첫 프레임 — 레인으로 즉시 레이아웃·로딩 준비
                setLane(e.data.lane);
                break;
              case "progress":
                // 분석 진행 상태(최종 답변 아님)
                setProgress(e.data.text);
                break;
              case "token":
                setProgress(null); // 실제 답변이 시작되면 진행 표시 제거
                appendToLastAssistant(e.data.text);
                break;
              case "conditions":
                setConditions(e.data.items);
                break;
              case "products":
                pushResult({ kind: "products", groups: e.data.groups });
                break;
              case "draft":
                pushResult({ kind: "draft", draft: e.data });
                break;
              case "action": {
                // CART_ADDED·PRODUCT_UPDATED 등 — 안내 문구를 대화에 덧붙임
                const action = e.data;
                appendToLastAssistant(`\n\n${action.message}`);
                // 수정 결과면 해당 draft 카드를 확정 상태로 잠금
                if (
                  action.type === "PRODUCT_UPDATED" ||
                  action.type === "PRODUCT_UPDATE_FAILED"
                ) {
                  const pending = useChatStore
                    .getState()
                    .results.find(
                      (r) =>
                        r.kind === "draft" &&
                        !r.settled &&
                        r.draft.productId === action.productId,
                    );
                  if (pending?.kind === "draft") {
                    settleDraft(pending.draft.draftId, action);
                  }
                }
                if (action.type === "CART_ADDED") {
                  track("add_to_cart", {
                    properties: { source: "chat", cartItemId: action.cartItemId },
                  });
                }
                onActionRef.current?.(action);
                break;
              }
              case "done":
                setProgress(null);
                onDoneRef.current?.(e.data.panel);
                break;
              case "error":
                failLastAssistant(e.data.message);
                break;
            }
          },
          controller.signal,
        );
      } catch {
        // 자동 재시도 금지 — 해당 말풍선에 에러 표시, 재시도 버튼 제공
        failLastAssistant("응답을 받지 못했어요. 다시 시도해 주세요.");
      } finally {
        setStreaming(false);
        setProgress(null);
        abortRef.current = null;
      }
    },
    [
      addMessage,
      appendToLastAssistant,
      failLastAssistant,
      setConditions,
      setResults,
      addResult,
      settleDraft,
      setStreaming,
      setLane,
      setProgress,
    ],
  );

  const send = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      // 이 앱의 상품 검색은 챗봇이다. 단 "[조건 제거]"·"[수정 확인]" 같은 제어 메시지는
      // 사용자의 검색 의도가 아니므로 제외한다. 검색어 자체는 개인정보가 섞일 수 있어
      // 보내지 않고 채널·길이만 싣는다(명세: properties에 개인정보 금지).
      if (!trimmed.startsWith("[")) {
        track("search", {
          properties: { channel, queryLength: trimmed.length },
        });
      }

      // 전송 시점의 화면을 싣는다(사이드 채팅에서 목록을 옮겨다니며 대화하므로)
      const screen = getScreenContextRef.current?.();

      return run(
        ({ sessionId, threadId }) => ({
          sessionId,
          threadId,
          channel,
          message: trimmed,
          ...(brandId !== undefined ? { brandId } : {}),
          ...(screen ? { screen } : {}),
          ...(user ? { userId: user.id } : { guestId: getGuestId() }),
        }),
        trimmed,
      );
    },
    [channel, brandId, user, run],
  );

  // draft 승인 — 발화가 아니라 최상위 action/draftId 로 확정한다(발화≠동의, 계약 v2).
  const confirm = useCallback(
    (draftId: string) => {
      return run(
        ({ sessionId, threadId }) => ({
          sessionId,
          threadId,
          channel,
          action: "confirm",
          draftId,
          ...(brandId !== undefined ? { brandId } : {}),
          ...(user ? { userId: user.id } : { guestId: getGuestId() }),
        }),
        null, // 승인은 사용자 말풍선을 남기지 않는다
      );
    },
    [channel, brandId, user, run],
  );

  // 실패한 응답 재시도 — 에러난 (user, assistant) 쌍을 제거하고 같은 메시지로 다시 전송
  const retry = useCallback(() => {
    const userText = useChatStore.getState().dropLastExchange();
    if (userText) send(userText);
  }, [send]);

  // 조건 칩 제거 = 후속 메시지로 전달 (별도 API 없음, CLAUDE.md)
  const removeCondition = useCallback(
    (name: string) => {
      send(`[조건 제거] ${name}`);
    },
    [send],
  );

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    reset();
    setSessionId(newId());
    setThreadId(newId());
  }, [reset, setSessionId, setThreadId]);

  return {
    send,
    confirm,
    retry,
    removeCondition,
    startNewChat,
    isStreaming,
  };
}
