import type { ChatAction } from "./action";
import type {
  BuyerProgress,
  ConditionChip,
  ProductGroup,
  SuggestionChip,
} from "./buyer";
import type { SellerDraft, SellerLane, SellerPanel, SellerProgress } from "./seller";
import type { SellerReport } from "./sellerReport";

// ── 이벤트 스트림 ──
// 와이어 포맷: 각 이벤트는 `data: {"type":..., "data":{...}}` 한 줄(구매자·판매자 공통).
// event: 라인은 쓰지 않는다 — payload 의 type 으로 구분한다.

// 구매자 정상 종료 사유(계약 CH-2 §done). zero_result = 결과 0건.
export type ChatFinishReason = "stop" | "zero_result";

// 스트림 내부 오류 코드(계약 CH-2 §error). 종결 이벤트.
export type ChatErrorCode =
  | "LLM_TIMEOUT"
  | "LLM_UNAVAILABLE"
  | "SEARCH_FAILED"
  | "INTERNAL";

export type ChatEvent =
  // ── 공통 ──
  | { type: "token"; data: { text: string } }
  | {
      type: "done";
      // finishReason: 구매자 stop|zero_result. panel: 판매자 우측 패널 조치.
      data: { finishReason: ChatFinishReason; panel?: SellerPanel };
    }
  | {
      type: "error";
      data: {
        code: ChatErrorCode;
        message: string;
        /**
         * 이 요청의 추적 id(2026-07-28 신설). 사용자가 "오류 났어요"라고 신고했을 때
         * 서버 로그에서 그 요청을 찾는 유일한 키다.
         */
        requestId?: string;
        /**
         * 재시도를 권할지(2026-07-28 신설). code 로는 복원할 수 없다 —
         * 같은 LLM_UNAVAILABLE 이라도 "미구성"(재시도 무의미)과 "일시 불가"(유효)가
         * 섞이므로 emit 지점이 값을 정한다. 생략되면 재시도 가능으로 본다(구버전 호환).
         */
        retryable?: boolean;
      };
    }
  // ── SHOPPING/CS 전용 ──
  | { type: "conditions"; data: { chips: ConditionChip[] } }
  | { type: "suggestions"; data: { chips: SuggestionChip[] } }
  // products.ready: 카드가 아니라 상관키만 온다(경로 B). FE가 CH-5로 목록을 조회한다.
  // 계약은 listIds(배열)지만 AI 가 아직 단수 listId 를 보낸다. 전환되면 listId 를 지운다.
  | {
      type: "products.ready";
      data: { sessionId?: string; listIds?: string[]; listId?: string };
    }
  // 구버전 products 이벤트(카드를 SSE 에 직접 싣던 경로 A)는 계약에서 폐기됐다 —
  // 현행은 products.ready + CH-5 조회(경로 B)뿐이다. 인기상품 시딩은 SSE 가 아니라
  // 화면이 P-4 를 직접 조회해 setResults 로 넣는다.
  | { type: "action"; data: ChatAction }
  // ── SELLER 전용 ──
  | { type: "meta"; data: { lane: SellerLane } }
  | { type: "draft"; data: SellerDraft }
  // 분석 결과 구조화 리포트. 정확히 1회, token 연문 뒤 done{replace} 앞에 온다.
  // 되묻기·거절은 이 이벤트 없이 done{keep} 으로 끝난다(계약 §3.2).
  | { type: "report"; data: SellerReport }
  // ── progress: 두 스트림의 페이로드가 다르다 ──
  // 구매자는 {stage, message?}(기계 판독 가능한 enum), 판매자는 {text}(자유 문자열)로
  // 계약이 확정됐다(2026-08-05 #289). 쉐이프를 맞추는 건 후속 과제라 수신부가 분기해야 한다.
  | { type: "progress"; data: BuyerProgress | SellerProgress };

/**
 * 채팅 결과 패널에 쌓이는 항목. 채널별로 종류가 다르므로 유니온으로 두고
 * 렌더러는 페이지가 주입한다(공통 모듈은 도메인 UI를 모른다).
 * - SHOPPING: products (상품 카드)
 * - SELLER: draft (수정 제안 diff 카드) — 통계 답변은 token 으로만 오므로 결과 카드가 없다
 */
export type ChatResult =
  | { kind: "products"; groups: ProductGroup[] }
  | { kind: "draft"; draft: SellerDraft; settled?: ChatAction };
