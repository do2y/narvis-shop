"use client";

import { useCallback, useEffect, useRef } from "react";
import { track } from "@/shared/analytics/track";
import { ApiError } from "@/shared/api/client";
import { streamChat, StreamStartError } from "@/shared/chat/streamChat";
import {
  clearCachedSession,
  ensureSession,
  refreshTicket,
  SessionClaimPendingError,
  subscribeOwnershipChange,
  subscribeSession,
} from "@/shared/chat/sessionCoordinator";
import { clearChat } from "@/shared/chat/chatPersistence";
import { getThreadId, newThreadId } from "@/shared/chat/threadId";
import { fetchChatListGroup } from "@/shared/chat/lists";
import { BUYER_PROGRESS_LABEL } from "@/shared/types/chat";
import type {
  ChatAction,
  ChatChannel,
  ChatEvent,
  ChatScreenContext,
  ChatSession,
  ConditionAction,
  ConditionField,
  SellerPanel,
  StreamChatBody,
} from "@/shared/types/chat";
import { useChatStore } from "./store";

function newId(): string {
  return crypto.randomUUID();
}

/**
 * 세션 축출(404) 판정 — 출처가 둘이라 타입도 둘이다.
 * 스트림 fetch 는 StreamStartError(status), 티켓 재발급은 ApiError(code/status).
 */
function isNotFound(err: unknown): boolean {
  if (err instanceof StreamStartError) return err.status === 404;
  if (err instanceof ApiError) {
    return err.status === 404 || err.code === "SESSION_NOT_FOUND";
  }
  return false;
}

/**
 * 스트림 시작 전 거부를 사용자 안내로 옮긴다(계약 CH-2 §실패 응답).
 * 상태별로 재시도가 의미 있는지가 달라 retryable 을 함께 정한다.
 */
function describeStreamStartError(err: StreamStartError): {
  message: string;
  retryable: boolean;
} {
  switch (err.status) {
    case 403:
      // 티켓은 유효하나 scope 불일치(예: 판매자 티켓으로 구매자 스트림).
      // 같은 티켓으로 다시 걸어도 결과가 같다.
      return {
        message: "이 대화를 열 권한이 없어요. 새로고침 후 다시 시도해 주세요.",
        retryable: false,
      };
    case 409:
      // STREAM_IN_PROGRESS — 같은 방에 활성 스트림이 있다.
      // 진행 중인 응답이 끝나야 풀리므로 즉시 재시도는 또 409 다.
      return {
        message: "다른 대화가 진행 중이에요. 잠시 후 다시 시도해 주세요.",
        retryable: false,
      };
    case 429:
      // RATE_LIMITED — 재시도 버튼을 주면 사용자가 눌러 상황을 더 악화시킨다.
      return {
        message: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
        retryable: false,
      };
    case 504:
      // UPSTREAM_TIMEOUT(first-token) — 일시적이라 재시도가 유효하다.
      return {
        message: "응답이 지연되고 있어요. 다시 시도해 주세요.",
        retryable: true,
      };
    default:
      return {
        message: "응답을 받지 못했어요. 다시 시도해 주세요.",
        retryable: true,
      };
  }
}

interface UseChatOptions {
  channel: ChatChannel;
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
  onAction,
  onDone,
  getScreenContext,
}: UseChatOptions) {
  const {
    isStreaming,
    addMessage,
    appendToLastAssistant,
    failLastAssistant,
    setResults,
    addResult,
    settleDraft,
    setConditions,
    setSuggestions,
    setSessionId,
    setStreaming,
    setLane,
    setProgress,
    setAnalysisReport,
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

  // 스트림 진입 티켓 확보 — 티켓 TTL 이 30~60초로 짧아 매 전송 직전에 확보한다.
  // 발급 자체는 코디네이터가 Web Locks 로 탭 간 단일화한다(접속당 CH-1 1회).
  // sessionId 는 항상 발급 응답값을 쓴다(BE·Redis 발급, sliding TTL) — 클라이언트가 만들지 않는다.
  // 승계 실패가 미해결이면 새 세션 발급을 막는다(allowCreate=false) — 조용히 새로
  // 만들면 화면엔 이전 대화가 있는데 AI 는 기억 못 하는 어긋남이 생긴다.
  const acquireTicket = useCallback((): Promise<ChatSession> => {
    const { sessionId, claimFailure } = useChatStore.getState();
    return ensureSession(channel, sessionId, !claimFailure);
  }, [channel]);

  // 다른 탭이 세션을 발급·갱신하면 이 탭의 표시용 sessionId 도 따라간다.
  // (정본은 코디네이터의 localStorage 캐시 — 여기선 스토어를 동기화만 한다.)
  useEffect(() => {
    return subscribeSession(channel, (s) => {
      setSessionId(s.sessionId);
    });
  }, [channel, setSessionId]);

  // 다른 탭에서 로그인하면 이 탭이 들고 있는 게스트 티켓은 그 순간 무효다
  // (AI 가 403 으로 막는다). 캐시를 비워 두면 다음 전송의 ensureSession 이
  // 회원 신원으로 재발급받아 그대로 통과한다 — 사용자는 아무것도 눈치채지 못한다.
  //
  // 전송을 막고 새로고침을 요구하지 않는 이유: 실제로 깨지는 구간은 방송이
  // 도착하기 전 수십 ms 뿐인데, 막아 두면 멀쩡히 이어질 대화까지 중단시킨다.
  useEffect(() => subscribeOwnershipChange(channel), [channel]);

  // 이 탭의 방 id 를 마운트 시 1회 확보한다(sessionStorage 정본).
  useEffect(() => {
    useChatStore.getState().setThreadId(getThreadId(channel));
  }, [channel]);

  /**
   * 스트림 실행 공통부 — 일반 발화(send)와 승인(confirm)이 공유한다.
   * userText 가 있으면 사용자 말풍선을 추가하고(발화), confirm 은 말풍선 없이 실행만 한다.
   * buildBody 는 발급받은 sessionId·threadId 를 받아 SSE body 를 만든다(신원은 티켓에 있음).
   */
  const run = useCallback(
    async (
      buildBody: (base: {
        sessionId: string;
        threadId: string;
      }) => StreamChatBody,
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
      // 이전 리포트는 유지(새 스트림이 analysis+replace로 끝날 때만 교체) — done에서 갱신

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

      // products.ready(경로 B)의 CH-5 조회는 비동기다. 스트림 종료(finally) 전에
      // 완료를 보장하려고 promise 를 모아 두고 스트림 소비 후 함께 기다린다.
      const pendingFetches: Promise<void>[] = [];

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // 1) 티켓 확보(Spring REST) — 코디네이터가 캐시·락으로 탭 간 단일화해 돌려준다.
        //    sessionId 는 서버 발급값을 저장·사용(재발급도 같은 sessionId 를 돌려준다).
        const session = await acquireTicket();
        setSessionId(session.sessionId);

        // threadId(계약 CH-2): 대화 스레드(방) 식별자, 필수.
        // sessionId 는 탭 간 공유되므로 방 구분은 탭별 threadId 가 맡는다(sessionStorage).
        const threadId = getThreadId(channel);
        useChatStore.getState().setThreadId(threadId);

        const body = buildBody({ sessionId: session.sessionId, threadId });

        const onEvent = (e: ChatEvent) => {
          switch (e.type) {
            case "meta":
              // 첫 프레임 — 레인으로 즉시 레이아웃·로딩 준비
              setLane(e.data.lane);
              // 새 분석이 시작되면 이전 리포트를 비운다(스켈레톤부터 다시 시작)
              if (e.data.lane === "analysis") setAnalysisReport(null);
              break;
            case "progress":
              // 진행 상태(최종 답변 아님). 두 스트림의 페이로드가 다르다 —
              // 구매자 {stage, message?} / 판매자 {text}. 쉐이프를 맞추는 건 후속 과제라
              // 지금은 수신부가 분기한다(계약 CH-2 §progress, 2026-08-05 #289).
              //
              // 구매자는 message 가 없으면 stage 로 자체 문구를 매핑한다 —
              // 서버가 빈 값이면 키 자체를 싣지 않기로 계약이 위임한 지점이다.
              setProgress(
                "stage" in e.data
                  ? (e.data.message ??
                      BUYER_PROGRESS_LABEL[e.data.stage] ??
                      null)
                  : e.data.text,
              );
              break;
            case "token":
              setProgress(null); // 실제 답변이 시작되면 진행 표시 제거
              appendToLastAssistant(e.data.text);
              break;
            case "conditions":
              // AI 추출 조건 칩(제거 가능). 새 턴이 오면 이전 칩을 덮어쓴다.
              setConditions(e.data.chips);
              break;
            case "suggestions":
              // 완화·되돌리기 제안 칩. estCount==0 은 방어적으로 제외.
              setSuggestions(e.data.chips.filter((c) => c.estCount > 0));
              break;
            case "products.ready": {
              // 경로 B — 카드는 SSE에 없다. 각 listId 로 CH-5 를 개별 조회해 패널에 넣는다.
              // listIds 는 항상 배열이다(세트형·니즈별 추천이 여러 묶음일 수 있음, 상한 10).
              // 조회 실패(404 등)는 재시도 버튼이 아니라 안내만 — 답변 자체는 정상 종료됐으므로.
              // 서버가 아직 단수 listId 를 보낸다 — 배열 우선, 없으면 길이 1로 승격
              const listIds =
                e.data.listIds ?? (e.data.listId ? [e.data.listId] : []);
              if (!listIds.length) break;

              pendingFetches.push(
                // 병렬 조회하되 결과는 listIds 순서(=I-21 lists 순서)로 한 번에 넣는다.
                // 개별 push 하면 응답이 빨리 온 묶음이 앞서 붙어 순서가 뒤집힌다.
                Promise.all(
                  listIds.map((id) =>
                    fetchChatListGroup(id).catch(() => null),
                  ),
                ).then((groups) => {
                  const usable = groups.filter(
                    (g): g is NonNullable<typeof g> =>
                      // 카드가 0개라도 드롭이 있었다면 넣는다 — "추천이 다 품절됐다"는
                      // 사실 자체가 안내거리다(200 · items:[] · itemsDropped>0, CH-5).
                      g !== null &&
                      Boolean(g.items.length || g.recommendation?.itemsDropped),
                  );
                  if (usable.length) {
                    pushResult({ kind: "products", groups: usable });
                  }

                  // 404 RESOURCE_NOT_FOUND(listId 만료·미존재)가 대표 사유다.
                  // TTL 만료는 재시도해도 계속 404이므로 "다시 시도"를 권하지 않는다.
                  //
                  // 하나도 못 가져왔으면 패널을 건드리지 않는다 — pushResult 를 부르지
                  // 않았으므로 이전 턴의 카드가 그대로 남는다. 명세가 "오류 화면을 띄우지
                  // 말고 가지고 있던 카드를 그대로 보여주라"고 한 지점이다(CH-5).
                  // 답변 자체는 정상 종료됐으므로 말풍선에도 실패로 표시하지 않는다.
                  if (!usable.length) {
                    appendToLastAssistant(
                      "\n\n추천 카드를 새로 불러오지 못해 이전 결과를 그대로 두었어요.",
                    );
                  } else if (usable.length < listIds.length) {
                    // 일부만 실패 — 가져온 묶음은 이미 패널에 넣었고 빠진 게 있다는 사실만 알린다
                    appendToLastAssistant(
                      "\n\n일부 추천 묶음을 불러오지 못했어요.",
                    );
                  }
                }),
              );
              break;
            }
            case "draft":
              pushResult({ kind: "draft", draft: e.data });
              break;
            case "action": {
              // 장바구니 담기·삭제·수량변경, 찜 추가·해제, 판매자 수정 결과(계약 CH-2 §action).
              // message 는 AI 가 조립한 사용자 노출 안전 문구다 — 그대로 붙이고
              // 문구를 하드코딩하거나 파싱하지 않는다. 분기는 type·reason 으로만.
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
              // 행동 이벤트는 CART_ADDED 하나만 쏜다. 나머지 9종에 대응하는 eventType 이
              // E-1 화이트리스트 12종에 없기 때문이다 — 삭제·수량변경·찜에 해당하는
              // 이름이 아예 정의돼 있지 않다. 없는 이름을 지어 보내면 서버가 드롭하고
              // 경고 로그만 쌓이므로(analytics/types.ts) 빠뜨린 게 아니라 안 보내는 것이다.
              // E-1 에 이름이 추가되면 그때 여기에 붙인다.
              if (action.type === "CART_ADDED") {
                // AI 가 대화 중 담은 경로 — 명세 필수 키(quantity·price)를 채우지 못한다.
                // CART_ADDED 페이로드가 cartItemId·message 뿐이라 FE 가 수량·단가를 모르고,
                // 어느 추천 목록에서 왔는지도 알 수 없어 recommendation 도 못 싣는다.
                // 서버가 _incomplete 를 붙여 저장한다(E-1 원칙: 버리지 않고 표시).
                // 계약 표에 없는 키는 싣지 않는다 — 집계가 의존하는 이름만 보낸다.
                track("add_to_cart");
              }
              onActionRef.current?.(action);
              break;
            }
            case "done": {
              setProgress(null);
              // zero_result: 결과 0건(에러 아님). AI token 안내가 없었으면 기본 문구로 채운다.
              if (e.data.finishReason === "zero_result") {
                const last = useChatStore.getState().messages.slice(-1)[0];
                if (last?.role === "assistant" && !last.text) {
                  appendToLastAssistant(
                    "조건에 맞는 상품을 찾지 못했어요. 조건을 바꿔 다시 시도해 주세요.",
                  );
                }
              }
              // 분석 리포트(analysis+replace)는 우측 패널로 교체된다. 계약상 리포트는
              // 단일 token이라 마지막 assistant 텍스트를 그대로 리포트 본문으로 승계한다.
              const st = useChatStore.getState();
              if (st.lane === "analysis" && e.data.panel === "replace") {
                const last = st.messages[st.messages.length - 1];
                if (last?.role === "assistant" && last.text) {
                  setAnalysisReport(last.text);
                }
              }
              onDoneRef.current?.(e.data.panel);
              break;
            }
            case "error":
              // 종결 이벤트 — 해당 말풍선에 에러 표시. code 별 분기는 불필요하고
              // message 가 사용자 노출 문구다(계약 §error).
              //
              // 재시도 여부는 code 가 아니라 retryable 로 판단한다 — 같은 LLM_UNAVAILABLE
              // 이라도 "미구성"(재시도 무의미)과 "일시 불가"(유효)가 섞여 있어
              // emit 지점만이 안다. requestId 는 사용자 신고 시 서버 로그 추적에 쓴다.
              failLastAssistant(e.data.message, {
                retryable: e.data.retryable,
                requestId: e.data.requestId,
              });
              break;
          }
        };

        // 2) llmSseUrl + streamTicket 으로 SSE 스트림 소비.
        //    티켓 만료 401(스트림 시작 전 거부)이면 재발급 후 1회만 재시도한다(계약 CH-2).
        //    토큰 수신이 시작된 뒤의 오류는 SSE error 이벤트로 오므로 여기서 재시도하지 않는다
        //    (중복 담기 방지). 재발급도 실패하면 catch 로 떨어진다.
        try {
          await streamChat(
            session.llmSseUrl,
            session.streamTicket,
            body,
            onEvent,
            controller.signal,
          );
        } catch (err) {
          // 401(티켓 만료) — 코디네이터 경유로 재발급(같은 락)하고 1회만 재시도.
          // 갱신된 티켓은 브로드캐스트로 다른 탭에도 공유된다.
          if (err instanceof StreamStartError && err.status === 401) {
            const fresh = await refreshTicket(channel, session.sessionId);
            setSessionId(fresh.sessionId);
            await streamChat(
              fresh.llmSseUrl,
              fresh.streamTicket,
              body,
              onEvent,
              controller.signal,
            );
          } else {
            throw err;
          }
        }

        // 스트림이 끝나도 products.ready 의 CH-5 조회가 남아 있을 수 있다 — 함께 기다린다.
        // (각 조회는 내부에서 catch 하므로 여기서 예외로 실패 처리되지 않는다.)
        if (pendingFetches.length) await Promise.all(pendingFetches);
      } catch (err) {
        // 404 SESSION_NOT_FOUND = 세션 TTL(10분) 만료. CH-1 이 멱등 발급이라 다른 탭이
        // 세션을 축출하는 일은 없으므로 "다른 곳에서 종료됨"이 아니라 단순 만료다.
        // 캐시를 비워 두면 다음 전송의 ensureSession 이 새로 발급한다 — 여기서 자동
        // 재전송하지 않고 재시도 버튼만 준다(중복 담기 방지).
        if (err instanceof SessionClaimPendingError) {
          // 승계 실패가 미해결 — 배너가 이미 떠 있고 사용자가 재시도/새 대화를
          // 골라야 한다. 말풍선의 재시도 버튼은 감춘다(같은 이유로 또 막힌다).
          failLastAssistant(
            "이전 대화를 이어받지 못해 메시지를 보낼 수 없어요. 위 안내에서 다시 시도하거나 새 대화를 시작해 주세요.",
            { retryable: false },
          );
        } else if (isNotFound(err)) {
          clearCachedSession(channel);
          setSessionId(null);
          failLastAssistant(
            "대화가 만료되었어요. 다시 시도하면 새로 이어서 대화할 수 있어요.",
          );
        } else if (err instanceof StreamStartError) {
          // 스트림 시작 전 거부(계약 CH-2 §실패 응답) — 상태별로 안내와 재시도 여부가 다르다.
          // 자동 재시도는 하지 않는다(중복 담기 방지) — 재시도는 버튼으로만.
          const { message, retryable } = describeStreamStartError(err);
          failLastAssistant(message, { retryable, requestId: err.requestId });
        } else {
          // 세션 발급·티켓 재발급 실패(axios 경로) 등 나머지
          failLastAssistant("응답을 받지 못했어요. 다시 시도해 주세요.");
        }
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
      setSuggestions,
      setResults,
      addResult,
      settleDraft,
      setSessionId,
      setStreaming,
      setLane,
      setProgress,
      setAnalysisReport,
      acquireTicket,
      channel,
    ],
  );

  const send = useCallback(
    (message: string, conditionActions?: ConditionAction[]) => {
      const trimmed = message.trim();
      // 계약 CH-2: message 와 conditionActions 가 둘 다 비면 400. 하나만 있으면 정상이다.
      if (!trimmed && !conditionActions?.length) return;

      // 이 앱의 상품 검색은 챗봇이다. 단 칩 제거 같은 제어 요청은 사용자의 검색 의도가
      // 아니므로 제외한다.
      //
      // query 는 원문을 싣는다 — 발화는 LLM 진입 전에 개인정보가 필터링된다(2026-08 확인).
      //
      // resultsCount 는 발화 시점에 알 수 없어 싣지 못한다(products.ready → CH-5 조회가
      // 수 초 뒤다). 결과를 기다렸다 쏘면 스트림이 실패한 검색이 통째로 유실돼
      // "검색은 항상 성공한다"로 보이는 생존 편향이 생기므로 지금 쏜다.
      // 결과 수는 서버가 적재하는 recommendation_generated.itemCount 가 정본이다 —
      // 그쪽은 목록 저장 시점이라 개수를 알고 있다. search 행에는 _incomplete 가 붙는다.
      if (trimmed && !conditionActions?.length) {
        track("search", { properties: { query: trimmed } });
      }

      // 전송 시점의 화면을 싣는다(사이드 채팅에서 목록을 옮겨다니며 대화하므로)
      const screen = getScreenContextRef.current?.();

      return run(
        ({ sessionId, threadId }) => ({
          sessionId,
          threadId,
          message: trimmed,
          ...(conditionActions?.length ? { conditionActions } : {}),
          ...(screen ? { screen } : {}),
        }),
        // 칩 제거만 있는 턴은 사용자 말풍선을 남기지 않는다 — 제어 신호이지 발화가 아니다
        // (판매자 confirm 과 동일 처리, 계약 CH-2).
        trimmed || null,
      );
    },
    [run],
  );

  // draft 승인 — 발화가 아니라 최상위 action/draftId 로 확정한다(발화≠동의, 계약 v2).
  const confirm = useCallback(
    (draftId: string) => {
      return run(
        ({ sessionId, threadId }) => ({
          sessionId,
          threadId,
          action: "confirm",
          draftId,
        }),
        null, // 승인은 사용자 말풍선을 남기지 않는다
      );
    },
    [run],
  );

  // 실패한 응답 재시도 — 에러난 (user, assistant) 쌍을 제거하고 같은 메시지로 다시 전송
  const retry = useCallback(() => {
    const userText = useChatStore.getState().dropLastExchange();
    if (userText) send(userText);
  }, [send]);

  // 조건 칩 제거 — conditionActions 배열로 보낸다(계약 CH-2 #84, 규약 문자열 방식은 폐기).
  // 어떤 칩을 지웠는지는 UI만 아는 사실이라 발화만으로는 서버가 복원할 수 없다.
  // 아직 AI 에 수신부가 없어 무동작이다(extra=ignore 라 조용히 버려진다).
  const removeCondition = useCallback(
    (field: ConditionField) => {
      send("", [{ op: "remove", field }]);
    },
    [send],
  );

  // 제안 칩(완화·되돌리기) 적용 = 칩 label 을 다음 턴 message 로 보내는 왕복(계약 §suggestions).
  // label 이 사용자 발화 형태("6만원대까지 볼까요?")라 그대로 실으면 LLM 이 완화를 트리거한다.
  const applySuggestion = useCallback(
    (label: string) => {
      send(label);
    },
    [send],
  );

  // 새 대화 = 새 방. 세션(접속)은 유지하고 thread_id 만 새로 판다 — BE 와 합의된 동작.
  // 여기서 세션을 새로 발급하면 다른 탭의 세션을 축출해 멀티탭이 깨진다.
  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    const threadId = newThreadId(channel);
    // 저장소를 먼저 비운다 — saveChat 은 빈 대화를 무시하므로(다른 탭 덮어쓰기 방지)
    // reset() 만으로는 이전 대화가 저장소에 남아 새로고침 때 되살아난다.
    clearChat();
    // reset() 이 claimFailure 도 initial(null) 로 되돌린다 — 새 대화는 승계할
    // 이전 맥락 자체가 없으므로 배너가 남으면 안 된다.
    reset();
    useChatStore.getState().setThreadId(threadId); // reset 이 initial 을 뿌린 뒤에 다시 심는다
  }, [reset, channel]);

  return {
    send,
    confirm,
    retry,
    removeCondition,
    applySuggestion,
    startNewChat,
    isStreaming,
  };
}
