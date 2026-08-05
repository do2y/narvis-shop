"use client";

import { create } from "zustand";
import type {
  ChatAction,
  ChatResult,
  ConditionChip,
  SellerLane,
  SuggestionChip,
} from "@/shared/types/chat";

// 현재 챗봇 대화 상태 — persist 안 함(새로고침 소실이 의도된 동작, CLAUDE.md)
// SHOPPING·CS·SELLER가 같은 스토어를 쓴다. 채널별로 다른 건 results 항목의 kind뿐.

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  error?: string; // 응답 실패 시 해당 말풍선에 표시할 에러 메시지
  /**
   * 재시도 버튼을 줄지. 서버가 retryable:false 를 주거나(계약 CH-2) 재시도해도
   * 같은 결과가 뻔한 실패(429 과다 요청 등)면 false 로 둬 버튼을 감춘다.
   * 기본값은 true — 판단 근거가 없으면 재시도할 수 있게 둔다.
   */
  retryable?: boolean;
  /** 서버 로그 추적용 id. 사용자 신고 시 이 값으로 요청을 찾는다. */
  requestId?: string;
}

/**
 * 로그인 승계(CH-7) 실패 상태 — 게스트 대화를 회원으로 넘기지 못했을 때.
 *
 * 화면엔 이전 대화가 남아 있지만 서버 맥락은 끊긴 상태다. 조용히 새 세션으로
 * 폴백하면 "AI가 방금 한 얘기를 기억 못 하는" 어긋남이 생기므로, 사용자에게
 * 알리고 재시도/새 대화를 명시적으로 고르게 한다.
 */
export interface ClaimFailure {
  /** 승계를 시도했던 게스트 sessionId — 재시도 대상 */
  sessionId: string;
  /** 재시도가 진행 중인지(버튼 중복 클릭·이중 요청 방지) */
  retrying: boolean;
}

interface ChatState {
  sessionId: string | null;
  threadId: string | null; // 판매자 챗 계약: 대화 스레드 식별자(목록 전환·패널 변경에 불변)
  /** 승계 실패 안내. null 이면 정상(배너 없음). */
  claimFailure: ClaimFailure | null;
  messages: ChatMessage[];
  results: ChatResult[]; // 최신 응답의 결과 카드(상품·diff)
  conditions: ConditionChip[]; // AI 추출 조건 칩(구매자) — field로 제거 왕복
  suggestions: SuggestionChip[]; // 완화·되돌리기 제안 칩(구매자)
  isStreaming: boolean;
  lane: SellerLane | null; // 판매자 챗 화면 전환 신호 — 첫 프레임 meta.lane
  /**
   * 진행 표시 문구(최종 답변 아님, 로딩 표시용). 구매자·판매자 공용 슬롯이다 —
   * 페이로드는 채널마다 다르지만(구매자 {stage,message?} / 판매자 {text})
   * 화면에 필요한 건 표시 문구 하나뿐이라 useChat 이 문자열로 정규화해 넣는다.
   */
  progress: string | null;
  // 분석 리포트 — done{panel:replace}+lane:analysis 시 우측 패널에 표시할 리포트 본문.
  // 계약상 analysis 답변은 단일 token이라 results 카드가 아니라 이 문자열로 담는다.
  analysisReport: string | null;

  setSessionId: (id: string | null) => void; // null = 만료된 세션 폐기(다음 전송 때 재발급)
  setThreadId: (id: string) => void;
  /** 승계 실패 표시(=배너 노출). 재시도 성공·새 대화 시 null 로 해제한다. */
  setClaimFailure: (f: ClaimFailure | null) => void;
  setClaimRetrying: (retrying: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
  /** 저장된 대화 복원(chatPersistence) — 그 외 용도로 통째 교체하지 않는다 */
  setMessages: (messages: ChatMessage[]) => void;
  appendToLastAssistant: (text: string) => void; // token 이벤트 누적
  // 마지막 assistant 말풍선을 에러 상태로. opts 로 재시도 가능 여부·추적 id 를 함께 싣는다.
  failLastAssistant: (
    message: string,
    opts?: { retryable?: boolean; requestId?: string },
  ) => void;
  dropLastExchange: () => string | null; // 실패한 (user, assistant) 쌍 제거하고 user 텍스트 반환
  setResults: (results: ChatResult[]) => void;
  addResult: (result: ChatResult) => void;
  settleDraft: (draftId: string, action: ChatAction) => void;
  dropDraft: (draftId: string) => void;
  setConditions: (chips: ConditionChip[]) => void;
  setSuggestions: (chips: SuggestionChip[]) => void;
  setStreaming: (v: boolean) => void;
  setLane: (lane: SellerLane | null) => void;
  setProgress: (text: string | null) => void;
  setAnalysisReport: (text: string | null) => void;
  reset: () => void; // 새 대화
}

const initial = {
  sessionId: null,
  threadId: null,
  claimFailure: null,
  messages: [],
  results: [],
  conditions: [],
  suggestions: [],
  isStreaming: false,
  lane: null,
  progress: null,
  analysisReport: null,
};

export const useChatStore = create<ChatState>((set, get) => ({
  ...initial,

  setSessionId: (sessionId) => set({ sessionId }),
  setThreadId: (threadId) => set({ threadId }),
  setClaimFailure: (claimFailure) => set({ claimFailure }),
  setClaimRetrying: (retrying) =>
    set((s) =>
      s.claimFailure ? { claimFailure: { ...s.claimFailure, retrying } } : {},
    ),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  appendToLastAssistant: (text) =>
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        messages[messages.length - 1] = { ...last, text: last.text + text };
      }
      return { messages };
    }),
  failLastAssistant: (message, opts) =>
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        messages[messages.length - 1] = {
          ...last,
          error: message,
          // 판단 근거가 없으면 재시도 가능으로 둔다(구버전 서버·네트워크 오류 등)
          retryable: opts?.retryable ?? true,
          ...(opts?.requestId ? { requestId: opts.requestId } : {}),
        };
      }
      return { messages };
    }),
  dropLastExchange: () => {
    const messages = [...get().messages];
    // 마지막이 실패한 assistant면 그것과 직전 user를 제거하고 user 텍스트 반환
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant") return null;
    messages.pop();
    const prev = messages[messages.length - 1];
    const userText = prev?.role === "user" ? prev.text : null;
    if (prev?.role === "user") messages.pop();
    set({ messages });
    return userText;
  },
  setResults: (results) => set({ results }),
  addResult: (result) => set((s) => ({ results: [...s.results, result] })),
  // 수정 확인/실패 결과가 오면 해당 diff 카드를 처리 완료 상태로 잠근다
  // (이미 확정된 수정에 확인 버튼이 계속 남아 중복 요청되는 것을 막음)
  settleDraft: (draftId, action) =>
    set((s) => ({
      results: s.results.map((r) =>
        r.kind === "draft" && r.draft.draftId === draftId
          ? { ...r, settled: action }
          : r,
      ),
    })),
  // 사용자가 수정을 취소하면 실패가 아니라 "없던 일" — 카드를 그냥 걷어낸다(서버 호출 없음)
  dropDraft: (draftId) =>
    set((s) => ({
      results: s.results.filter(
        (r) => !(r.kind === "draft" && r.draft.draftId === draftId),
      ),
    })),
  setConditions: (conditions) => set({ conditions }),
  setSuggestions: (suggestions) => set({ suggestions }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setLane: (lane) => set({ lane }),
  setProgress: (progress) => set({ progress }),
  setAnalysisReport: (analysisReport) => set({ analysisReport }),
  // 새 대화 — 화면 상태만 비운다. 방 id 는 sessionStorage(threadId.ts), 세션은
  // 코디네이터가 들고 있어 여기서 지워지지 않는다("새 대화"=새 방, 세션 유지).
  reset: () => set({ ...initial }),
}));
