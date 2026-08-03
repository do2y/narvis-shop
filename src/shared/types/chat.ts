import type { SeededProductCard } from "@/shared/types/product";
import type { RecommendationContext } from "@/shared/types/cart";
// 화면 어휘 정본은 E-1(analytics)이고 CH-2 는 참조만 한다 — 같은 이름을 두 벌 두지 않는다.
import type { PageType } from "@/shared/analytics/types";

/** 채팅 API 계약 타입 — 백엔드/LLM 스키마와 1:1. 변경 시 계약 문서와 함께 갱신 */
export type ChatChannel = "SHOPPING" | "CS" | "SELLER";

/**
 * 사용자가 지금 보고 있는 화면(계약 CH-2 §screen, 2026-07-28 확정).
 * 우측 패널을 보며 "이거 담아줘"라고 하는 지시어를 해소하는 데 쓴다 —
 * 무엇이 어떻게 보이고 있었는지는 FE 만 아는 사실이다.
 *
 * path·label 은 계약이 명시적으로 금지한다: 경로엔 검색어 등 개인정보가 실릴 수 있고,
 * 한글 화면명은 AI 가 pageType→표시명 매핑을 config 로 갖는다(FE 가 관리하면 표현이 흔들린다).
 */
export interface ChatScreenContext {
  /**
   * 우측 패널에 뜬 내용의 종류. 라우트가 아니다 — 채팅은 전용 페이지에만 있어
   * 라우트를 실으면 항상 chat·seller_chat 이라 정보가 0이다.
   * 어휘 정본은 E-1 이며 CH-2 가 참조한다(화면 이름은 하나여야 한다).
   */
  pageType: PageType;
  /**
   * 패널에 걸린 필터. 값은 enum 코드가 아니라 **화면에 보이는 한글 표시값**이다 —
   * 프롬프트에 그대로 들어가므로 코드값(ORDERED)은 의미가 전달되지 않는다.
   * 키는 status·sort·page 3종.
   */
  filters?: Record<string, string>;
  /**
   * 서버가 모르는 목록만 싣는다 — 기준은 "화면에 보이나"가 아니라 "서버가 이미 아나"다.
   * 추천 카드(CH-5)는 listId 로 서버가 알고 있어 싣지 않는다(되돌려주면 위조 경로가 된다).
   * 상한 20건, 초과분은 화면 순서대로 자른다.
   */
  products?: { productId: number; name: string }[];
  /**
   * 전송 시점 그리드 열 수 — 반응형이라 서버가 알 수 없다. 목록형은 1.
   * "3번째 줄 2번째" 같은 좌표 지시를 index = (row-1) × columns + (col-1) 로 푼다.
   * products 가 있으면 필수.
   */
  columns?: number;
}

/**
 * SSE 스트림 요청 body(streamChat 이 그대로 직렬화).
 * - 일반/제안: message 를 보낸다.
 * - 승인(confirm): action:"confirm" + draftId 를 최상위로 보낸다(발화≠동의, message 없음).
 * 신원(userId·sellerId·brandId)·channel 은 body 에 없다 — 세션 발급 단계에서 서버가 도출해
 * 티켓 claim 에 박으므로, SSE body 는 순수 대화 필드만 싣는다(IDOR 방지).
 * 선택 대상(주문/상품)은 계약상 별도 필드가 없다 — message 자연어에 녹여 LLM이 처리한다.
 */
export interface StreamChatBody {
  sessionId: string; // 세션 발급으로 받은 BE 발급값
  threadId: string; // 방 식별자(FE 생성, 방마다 고유) — 필수, 없으면 400
  message?: string; // confirm 요청에선 생략. conditionActions 가 있으면 빈 문자열 허용
  /**
   * 조건 칩 제거(구매자 전용). 미지정 기본값은 빈 배열이라 일반 발화는 종전대로 동작한다.
   * message 와 함께 보낼 수 있다 — "category 칩을 지우고 노트북으로 바꿔줘".
   * 둘 다 비어 있으면 400.
   */
  conditionActions?: ConditionAction[];
  screen?: ChatScreenContext; // 사이드 채팅에서만 전송
  action?: "confirm"; // draft 승인 — message 대신 이 필드로 확정
  draftId?: string; // action:"confirm" 일 때 대상 draft
}

/**
 * 챗 스트림 진입 티켓 — SSE 연결 전에 BE(Spring)가 발급한다.
 * 로그인 AT 를 이 API 로 교환해 단명 streamTicket 을 받고, SSE 요청엔 티켓을 싣는다.
 * (셀러: brandId 는 클라이언트 주장이 아니라 서버가 JWT→DB 로 도출해 티켓 claim 에 박음)
 */
export interface ChatSession {
  sessionId: string; // BE(Redis) 발급, 10분 sliding TTL
  ttlSeconds: number; // 세션 TTL(초)
  streamTicket: string; // 단명 JWT(RS256, TTL 30~60s) — SSE Authorization 에 사용
  ticketTtlSeconds: number; // 티켓 TTL(초)
  llmSseUrl: string; // FE 가 SSE POST 할 엔드포인트(BE 설정값)
}

// 시딩 계약(SeededProductCard)에 AI 추천 이유만 더한 형태 — 상세 캐시 승계 호환 유지
export interface ProductCard extends SeededProductCard {
  reason: string; // AI 추천 이유 한 줄(CH-5는 없으면 null → FE에서 "")
  purchasable?: boolean; // 재고·판매 가능 여부(CH-5). 목록은 이미 품절 드롭이라 대개 true
  /**
   * 이 카드가 나온 추천 목록의 출처 — 담기(C-2) 시 그대로 돌려보내 전환을 귀속시킨다.
   * 카드 자체에 붙여 둔다: 담기 버튼은 카드 안에 있고, 화면에 여러 목록이 동시에 뜰 수 있어
   * 별도 상태로 두면 어느 목록의 카드인지 잃는다(낡은 listId 오귀속의 주 원인).
   * 인기상품 등 추천이 아닌 카드에는 없다.
   */
  recommendationContext?: RecommendationContext;
}

/** CH-5 추천 목록의 성격 — PICK_ONE(하나만 고름) | BUY_ALL(전부 삼) */
export type RecommendationListType = "PICK_ONE" | "BUY_ALL";

export interface ProductGroup {
  title: string;
  items: ProductCard[];
  /**
   * 추천 목록에서 온 묶음의 부가 정보(CH-5). 인기상품·경로 A 카드에는 없다.
   * BUY_ALL 은 "이 조합을 통째로 산다"는 제안이라 합계·예산을 함께 보여줘야 의미가 통한다.
   */
  recommendation?: {
    listType: RecommendationListType;
    itemsDropped: number;
    totalBudget?: number;
    sum?: number;
    withinBudget?: boolean | null;
  };
}

/**
 * CH-5 추천 목록 조회 응답(GET /api/chat/lists/{listId}) 데이터부.
 * CH-2 SSE 의 products.ready{listId} 수신 후 조회한다. items 는 플랫 배열(순서 유지).
 * BE 가 카드 완결 필드를 최신값으로 부착(상품명·가격·정가·이미지·rating·reviewCount·purchasable).
 * HIDDEN·품절은 BE 가 드롭. listId TTL=세션 TTL(10분), 만료·미존재 404 RESOURCE_NOT_FOUND.
 */
export interface ChatListResponse {
  listId: string;
  // 담기·주문 시 recommendationContext 로 되돌려보낼 상관키(C-2·O-1). 이게 있어야 전환이 귀속된다.
  recommendationRequestId: string;
  /** PICK_ONE(하나만 고름) | BUY_ALL(전부 삼) — 항상 존재. 렌더 분기의 축 */
  listType: RecommendationListType;
  /** 추천 이후 품절·숨김으로 빠진 개수. listType 과 무관하게 항상 존재하며 0 도 내려온다 */
  itemsDropped: number;
  /** "알뜰"·"균형" 등 묶음 이름 — 여러 세트를 함께 제안할 때만 */
  label?: string;
  // 아래 3개는 BUY_ALL 에서만 존재한다(PICK_ONE 은 하나만 사므로 합계·예산이 의미 없다)
  totalBudget?: number;
  /** 남은 상품 기준 합계 — 드롭이 있으면 남은 것만 재계산된 값 */
  sum?: number;
  /** itemsDropped > 0 이면 판정 불가라 null 로 온다 */
  withinBudget?: boolean | null;
  items: (SeededProductCard & {
    reason: string | null; // I-21 콜백 reasons echo, 없으면 null
    purchasable: boolean;
  })[];
}

// ── SHOPPING/CS 전용 페이로드 (계약 CH-2) ──

/**
 * conditions 칩의 field 허용값 6종(계약 CH-2).
 * conditions 가 내보내는 집합과 conditionActions 가 지우는 집합은 동일하다.
 */
export type ConditionField =
  | "category"
  | "priceMax"
  | "priceMin"
  | "brand"
  | "ratingMin"
  | "keyword";

/**
 * AI가 추출한 필터 조건 칩. 제거 가능하게 노출한다.
 * 칩 제거는 conditionActions 배열로 보낸다(아래) — 규약 문자열 왕복은 폐기(2026-07-28, #84).
 */
export interface ConditionChip {
  field: ConditionField; // "priceMax" — 제거 액션의 식별자
  label: string; // "5만원 이하" — 표시용
  value: string | number; // 50000 | "여행용품/보안용품"
}

/**
 * 조건 칩 제거 액션(구매자 전용, 계약 CH-2 2026-07-28 신설).
 * 어떤 칩을 지웠는지는 UI만 아는 사실이라 서버가 발화만으로 복원할 수 없다.
 * op 는 remove 만 허용. 멱등하다 — 없는 필드를 지워도 성공 no-op.
 */
export interface ConditionAction {
  op: "remove";
  field: ConditionField;
}

/**
 * 완화/되돌리기 제안 칩. relaxation(조건 완화) 또는 revert(카테고리 되돌리기) 중 정확히 하나.
 * estCount==0 은 서버가 제외하지만 FE도 방어적으로 걸러 표시하지 않는다.
 */
export interface SuggestionChip {
  label: string; // "6만원대까지 볼까요?"
  estCount: number; // 완화 시 예상 결과 수(0이면 표시 안 함)
  relaxation?: { field: string; value: string | number };
  revert?: { category: string };
}

// ── SELLER 채널 전용 페이로드 ──
// 판매자 챗은 SHOPPING과 동일 엔드포인트를 channel만 바꿔 쓰지만 이벤트 집합이 다르다.
// 통계 답변은 차트 카드가 아니라 자연어 token 으로 오고, 쓰기(수정/삭제/등록)는
// draft(HITL 승인 대기) → confirm 흐름으로 온다. (계약 v2, 2026-07-22)

/** 첫 프레임 — FE가 즉시 레이아웃·로딩을 준비하는 레인 신호 */
export type SellerLane =
  | "analysis" // 통계 Q&A (progress 후 token)
  | "product" // 상품 상세 수정 제안 → draft
  | "general" // 일반 대화·되묻기
  | "confirm" // draft 승인 실행 결과
  | "apply" // "N번 적용해줘" 추천 적용 → draft
  | "refused"; // 도메인 밖 질문 거절

/** 종료 시 우측 패널 조치 — replace(교체) / keep(유지) / refresh(재조회) */
export type SellerPanel = "replace" | "keep" | "refresh";

/** 상품 수정 제안 필드(camelCase 8종) */
export type SellerDraftField =
  | "name"
  | "price"
  | "originalPrice"
  | "description"
  | "category"
  | "imageUrl"
  | "status"
  | "stockQuantity";

/** 상품 상세 수정/삭제/등록 제안(HITL 승인 대기) */
export interface SellerDraft {
  draftId: string; // confirm이 참조(보여준 것 == 실행)
  op: "update" | "create" | "delete";
  productId: number | null; // create는 null 일 수 있음
  changes: {
    field: SellerDraftField | string;
    before: string | number;
    after: string | number;
  }[];
  summary: string; // "가격을 27,500원으로 인하"
}

// ── 이벤트 스트림 ──
// 와이어 포맷: 각 이벤트는 `data: {"type":..., "data":{...}}` 한 줄(구매자·판매자 공통).
// event: 라인은 쓰지 않는다 — payload 의 type 으로 구분한다.

// 장바구니 담기 실패 사유(계약 CH-2 §action).
// message는 AI가 조립한 사용자 노출 문구 → FE는 그대로 표시하고 reason으로만 분기.
export type CartAddFailReason =
  | "PRODUCT_NOT_FOUND"
  | "STOCK_INSUFFICIENT" // 재고 부족·품절(OUT_OF_STOCK 통합)
  | "CART_ERROR"; // 운영 오류 또는 수량 상한 초과(합산>99)

export type ChatAction =
  // ── SHOPPING/CS ──
  | { type: "CART_ADDED"; message: string; cartItemId: number }
  | { type: "CART_ADD_FAILED"; message: string; reason: CartAddFailReason }
  // ── SELLER ──
  | { type: "PRODUCT_UPDATED"; message: string; productId: number }
  | { type: "PRODUCT_UPDATE_FAILED"; message: string; productId: number };

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
  | { type: "progress"; data: { text: string } }
  | { type: "draft"; data: SellerDraft };

/**
 * 채팅 결과 패널에 쌓이는 항목. 채널별로 종류가 다르므로 유니온으로 두고
 * 렌더러는 페이지가 주입한다(공통 모듈은 도메인 UI를 모른다).
 * - SHOPPING: products (상품 카드)
 * - SELLER: draft (수정 제안 diff 카드) — 통계 답변은 token 으로만 오므로 결과 카드가 없다
 */
export type ChatResult =
  | { kind: "products"; groups: ProductGroup[] }
  | { kind: "draft"; draft: SellerDraft; settled?: ChatAction };
