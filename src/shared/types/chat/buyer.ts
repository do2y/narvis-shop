import type { SeededProductCard } from "@/shared/types/product";
import type { RecommendationContext } from "@/shared/types/cart";

// 시딩 계약(SeededProductCard)에 AI 추천 이유만 더한 형태 — 상세 캐시 승계 호환 유지
export interface ProductCard extends SeededProductCard {
  reason: string; // AI 추천 이유 한 줄(CH-5는 없으면 null → FE에서 "")
  // 구매 가능 여부 필드는 없다 — 못 사는 상품은 BE가 목록에서 드롭하므로(itemsDropped로
  // 개수만 온다) 남은 카드는 항상 살 수 있다. P-4·P-5도 같은 이유로 이 필드가 없다.
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
  titleKind?: "default" | "label";
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
 * BE 가 카드 완결 필드를 최신값으로 부착(상품명·가격·정가·이미지·rating·reviewCount).
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
  /**
   * "priceMax" — 제거 액션의 축 식별자.
   *
   * **칩을 유일하게 가리키지 않는다.** category·brand 는 값당 칩 1개로 나뉘어
   * 같은 field 가 여러 개 온다(v0.32.14). 칩을 특정하려면 (field, value) 쌍이 필요하다.
   */
  field: ConditionField;
  label: string; // "카테고리 · 여행용품" | "5만원 이하" — 표시용
  /**
   * 항상 스칼라다.
   *
   * v0.32.14 이전에는 brand 칩에 한해 리스트(["삼성","LG"])가 실려 이 선언과
   * 어긋나 있었다. 값당 분리로 brand 도 스칼라가 되어 선언과 실제가 일치한다.
   */
  value: string | number; // 50000 | "여행용품"
}

/**
 * 조건 칩 제거 액션(구매자 전용, 계약 CH-2 2026-07-28 신설).
 * 어떤 칩을 지웠는지는 UI만 아는 사실이라 서버가 발화만으로 복원할 수 없다.
 * op 는 remove 만 허용. 멱등하다 — 없는 필드를 지워도 성공 no-op.
 */
export interface ConditionAction {
  op: "remove";
  field: ConditionField;
  /**
   * 지울 값(선택, v0.32.14 신설). 와이어는 추가 전용이라 생략하면 종전과 동일하게
   * 그 축 전체가 제거된다.
   *
   * - category·brand: 그 값만 빼고 나머지로 재검색
   * - priceMax·priceMin·ratingMin·keyword: 값이 하나뿐인 축이라 서버가 무시하고 축 전체 제거
   * - 서버가 모르는 값은 관대 무시(400 아님)
   *
   * 같은 축에 value 없는 액션이 섞이면 전체 제거가 이긴다(상위집합).
   */
  value?: string | number;
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

/**
 * 구매자 진행 단계(계약 CH-2 §progress, 2026-08-05 신설 #289 → 다단계화 2026-08-06).
 *
 * 어휘는 **개방형**이다 — 계약이 "FE 는 모르는 stage 를 무시한다"를 명문화했으므로
 * 닫힌 유니온으로 두지 않는다. AI 가 stage 를 추가할 때 FE 배포를 기다리게 하지 않으려는 것이고,
 * 실제로 retrying 이 후속으로 예고돼 있다(jarvis-ai#406).
 * KNOWN 목록은 자체 문구를 가진 것들일 뿐 허용 집합이 아니다.
 */
export const KNOWN_BUYER_PROGRESS_STAGES = [
  "analyzing",
  "mapping",
  "expanding",
  "searching",
  "relaxing",
  "reranking",
  "publishing",
] as const;

/** 알려진 7종 + 그 밖의 문자열. `& {}` 는 유니온이 string 으로 뭉개져 자동완성이 죽는 걸 막는다. */
export type BuyerProgressStage =
  | (typeof KNOWN_BUYER_PROGRESS_STAGES)[number]
  | (string & {});

/**
 * 구매자 progress 페이로드 — **다회 나갈 수 있다**(2026-08-06 다단계화 전까지는 0~1회였다).
 *
 * FE 는 도착을 전제하면 안 된다: 그 앞에서 끝나는 턴(LLM 미구성 → error{LLM_UNAVAILABLE},
 * 세션 저장소 장애 → 스트림 전 오류 봉투)에서는 0회다.
 *
 * publishing 은 근거 token 이 나간 **뒤** products.ready 직전에 온다 —
 * 그래서 진행 표시를 답변 렌더링에 종속시키면 안 된다(계약 CH-2 §progress).
 */
export interface BuyerProgress {
  stage: BuyerProgressStage;
  /**
   * 사용자 노출 문구. 서버가 빈 값이면 키 자체를 싣지 않으며,
   * 그때 FE 가 stage 로 자체 문구를 매핑한다(BUYER_PROGRESS_LABEL).
   */
  message?: string;
}

/**
 * 서버가 message 를 생략했을 때 쓰는 fallback 문구.
 * 계약이 "FE 가 stage 로 자체 문구를 매핑한다(다국어·로컬 카피)"로 위임한 지점이다.
 *
 * 어휘가 개방형이라 Record 가 아니라 부분 맵이다 — 모르는 stage 는 여기서 undefined 가 되고,
 * 수신부가 그걸 "문구 없음"으로 흘려보낸다(계약: FE 는 모르는 stage 를 무시한다).
 */
export const BUYER_PROGRESS_LABEL: Partial<Record<string, string>> = {
  analyzing: "요청을 확인하고 있어요",
  mapping: "카테고리를 찾고 있어요",
  expanding: "어떤 상품이 필요한지 넓혀 보고 있어요",
  searching: "상품을 검색하고 있어요",
  relaxing: "조건을 조금 넓혀 다시 찾고 있어요",
  reranking: "가장 잘 맞는 걸 고르고 있어요",
  publishing: "추천 목록을 준비하고 있어요",
};
