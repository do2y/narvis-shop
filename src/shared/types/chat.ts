import type { SeededProductCard } from "@/shared/types/product";
import type { RecommendationContext } from "@/shared/types/cart";
// 화면 어휘 정본은 E-1(analytics)이고 CH-2 는 참조만 한다 — 같은 이름을 두 벌 두지 않는다.
import type { PageType } from "@/shared/analytics/types";

/**
 * 채팅 API 계약 타입 — 백엔드/LLM 스키마와 1:1. 변경 시 계약 문서와 함께 갱신.
 *
 * "CS" 는 2026-08-11 CH-1 개정으로 폐기됐다 — 문의 챗봇(CH-3)이 폐기되면서
 * 붙을 챗봇이 없어졌고, BE enum 에서도 빠져(PR #171) 보내면 400 이다.
 * 남겨두면 openChatSession 이 타입상 허용해 400 을 부르는 경로가 열린다.
 */
export type ChatChannel = "SHOPPING" | "SELLER";

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
   *
   * 용도는 채널마다 다르다 — 구매자는 담기 대상, 판매자(S-4)는 **수정 대상 확정용**이다
   * ("1번 상품 가격 내려줘"의 "1번"이 화면 순번이라 이게 없으면 draft 대상을 못 정한다).
   * 판매자 쪽 소유권은 Spring 하드게이트(brandId)가 막으므로 FE 가 거르지 않는다.
   */
  products?: { productId: string; name: string }[];
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
  /**
   * 상품 등록용 이미지 (판매자 전용, 2026-08-08 신설).
   *
   * **새로 첨부한 턴에만 보낸다.** 첨부 즉시 업로드하는 구조라 FE 가 URL 을 계속
   * 들고 있게 되는데, 후속 턴에도 실으면 AI 가 매 턴 사진을 다시 분석한다 —
   * 턴1 에 "코튼 오버핏 셔츠"였던 상품명이 턴2 에 "면 셔츠"로 바뀌고 이미지 토큰도
   * 매번 나간다. AI 는 첫 분석 결과를 서버에 갖고 있어 안 보내도 이어진다.
   * (예외: 대화 중 다른 사진을 새로 첨부하면 그 턴에는 보낸다 — 재분석이 목적이다.)
   */
  imageUrls?: string[];
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
  /**
   * FE 가 SSE POST 할 엔드포인트(BE 설정값 LLM_SSE_URL 유래).
   *
   * streamChat 은 여기에 아무것도 덧붙이지 않고 그대로 POST 한다.
   * **FE 가 AI 서버 주소를 아는 유일한 경로이기도 하다** — LLM_SSE_URL 은 Spring 쪽
   * 환경변수라 FE 번들에 들어오지 않는다(주소는 런타임에 서버가 주는 값이지 프론트가
   * 설정으로 갖는 값이 아니다). R-1/R-2(AI 서버 직행 REST)는 이 필드의 **origin 만**
   * 취해 base 로 쓴다 — features/seller/reportsApi.ts의 reportsBaseUrl.
   */
  llmSseUrl: string;
}

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

// ── SELLER report (계약 §3.2 v0.24.0, 이슈 #296) ──
// 분석 답변의 결과물. 종전엔 token 연문 한 덩어리였고, 이제 구조화 리포트가 별도
// 이벤트로 온다. token 연문은 그대로 유지되므로(body 와 같은 내용) 채팅 말풍선은
// 종전대로 흐르고, 우측 패널만 이 구조를 렌더한다.

export type SellerAnalysisType =
  | "sales_anomaly"
  | "conversion"
  | "behavior"
  | "churn"
  | "abuse"
  | "review"; // #297 I-31 리뷰 분석 워커 — BE 는 6종인데 여기가 5종이라 라벨이 비던 것

export type SellerFindingSeverity = "info" | "warning" | "critical";

export interface SellerReportFinding {
  analysisType: SellerAnalysisType;
  severity: SellerFindingSeverity;
  summary: string;
  evidence: string[]; // degrade finding 은 빈 배열
  recommendation: string; // 조치 힌트(선택, "" 가능)
}

export interface SellerReportRecommendation {
  /**
   * 1-base. 목록 순서와 항상 일치하며 "N번 적용해줘"의 그 N 이다.
   * FE 가 재정렬·재번호하면 사용자가 말한 번호와 서버가 아는 번호가 어긋난다.
   */
  index: number;
  title: string;
  expectedEffect: string; // "" 가능
  actionType:
    | "price_adjust"
    | "description_update"
    | "stock_adjust"
    | "product_visibility"
    | "promotion";
  productId: number;
  /**
   * 추천 생애주기 — R-2 에만 실려 온다(S-4 report 이벤트에는 없다).
   * 저장 보고서는 나중에 다시 열 수 있어 "이미 적용한 추천"이라는 상태가 생긴다.
   * 선택 필드라 챗 패널(S-4)은 undefined 로 두고 그대로 동작한다.
   */
  status?: "proposed" | "applied" | "superseded";
  /** 적용 시각 — R-2 에만. 미적용이면 null */
  appliedAt?: string | null;
}

/**
 * 리포트 차트 — 대시보드의 SellerAnalysis 와 구조가 같다.
 * 계약 옆에 따로 두는 이유: shared 는 features 를 import 하지 않는다(의존 방향).
 * 형태가 같으므로 AnalysisChart 가 무수정으로 둘 다 받는다.
 */
export interface SellerReportChart {
  title: string;
  chartType: "line" | "bar";
  /** RATING 은 상품별 평균 평점 차트(2026-08-08 신설) — 1~5 실수 */
  unit: "KRW" | "COUNT" | "PERCENT" | "RATING";
  /**
   * 이 계열을 어떻게 집계했는가 (2026-08-08 신설).
   * 서버가 소스 레지스트리에서 채워 보낸다 — unit 으로 추측하지 말 것
   * (같은 COUNT 라도 판매 수량은 sum, 재고는 none 이다).
   *  sum  합계가 의미 있음
   *  avg  평균 (평점)
   *  none 스냅샷이라 합계·평균 둘 다 무의미 (가격·재고)
   */
  aggregate: "sum" | "avg" | "none";
  series: { label: string; points: { x: string; y: number }[] }[];
  summary?: string;
}

export interface SellerReport {
  title: string;
  period: { from: string; to: string }; // YYYY-MM-DD
  generatedAt: string; // RFC3339, KST(+09:00)
  summary: string;
  body: string;
  findings: SellerReportFinding[];
  limitations: string[];
  chartRequested: boolean;
  charts: SellerReportChart[];
  /**
   * 차트 기간이 분석 기간과 다를 때만 온다 (2026-08-08 신설). 없으면 period 와 같다.
   * "지난달 이탈 보고서 + 최근 7일 매출 그래프" 같은 요청에서 갈린다 —
   * 표기하지 않으면 판매자가 7일 그래프를 지난달 그래프로 읽는다.
   */
  chartPeriod?: { from: string; to: string };
  /**
   * 차트를 못 만든 사유 (2026-08-08 신설). 차트 일부만 성공하면
   * charts 와 이 배열이 동시에 온다.
   *
   * reason 을 닫힌 유니온으로 두지 않는 이유는 progress.stage 와 같다 —
   * 사유가 늘 때마다 FE 배포를 기다리게 하지 않으려는 것이다.
   * 화면에는 message 를 그대로 싣고(서버가 완성 문장으로 준다) reason 은 로깅·QA 용이다.
   */
  chartUnavailable?: { reason: string; message: string }[];
  recommendations: SellerReportRecommendation[];
  applyGuide: string; // 추천 없으면 ""
}

// ── SELLER 저장 보고서 (계약 R-1·R-2, 2026-08-12 신설 · 이슈 #599) ──
// 무인 파이프라인이 저장한 분석 보고서의 조회 경로. 결정 6 에 따라 이 보고서들은
// report SSE 이벤트로 방출되지 않으므로 R-1/R-2 가 유일한 소비 경로다.
// (S-4 report 이벤트는 사용자가 대화로 요청한 즉석 분석 전용으로 그대로 남는다.)
//
// ⚠️ 시각 표기가 S-4 와 다르다 — R-1/R-2 는 전부 UTC "Z", S-4 는 KST(+09:00) 고정이다.
// 이 파일의 타입에 실리는 값은 **서버 원본(UTC)** 이고, 화면에 넘기기 전
// reportsApi 의 매핑이 KST 로 옮긴다. 자세한 근거는 shared/utils/kstTime.ts.

/** 보고서가 만들어진 계기 — R-1·R-2 공용 어휘 4종 */
export type SellerReportTriggerType =
  | "scheduled_daily"
  | "scheduled_weekly"
  | "event"
  | "manual";

/**
 * 목록이 빌 때만 실리는 사유 (R-1). 5종 + null.
 *
 * ⚠️ null 을 no_trigger("이상 없음")로 추정하지 않는다 — "판정 보류 ≠ 이상 없음" 이
 * 계약의 불변 규약이다. null 은 판정 불가이므로 일반 빈 상태로 표시한다.
 */
export type NoReportReason =
  | "not_registered" // targets 에 행 없음
  | "inactive" // last_seen_at > TTL(14일)
  | "no_trigger" // last_skip_reason
  | "no_baseline" // last_skip_reason
  | "pending_first_run"; // last_run_at IS NULL — 신규 판매자가 반드시 겪는 정상 대기

/** R-1 목록 한 줄 */
export interface SellerReportListItem {
  /** UUID 문자열 — 상품·주문 id(BIGINT) 규약과 무관하다 */
  reportId: string;
  triggerType: SellerReportTriggerType;
  /** 분석 기간 YYYY-MM-DD (타임존 없음) */
  periodFrom: string;
  periodTo: string;
  title: string;
  summary: string;
  recommendationCount: number;
  /** 판정 보류 존재 — 목록 배지용. 상세는 R-2 holds[] */
  hasHolds: boolean;
  createdAt: string;
  /** null = 미읽음 */
  readAt: string | null;
}

export interface SellerReportListResponse {
  /** unreadOnly 필터 적용 **후** 건수 — 페이징 기준 */
  total: number;
  /**
   * 필터 무관 **항상 전량 기준** — 배지용.
   * S-2 tabCounts 와 같은 원칙이라 필터를 켜도 배지가 흔들리지 않는다.
   * total 과 기준이 다르므로 페이지 수 계산에 쓰지 말 것.
   */
  unreadCount: number;
  /** 목록이 빌 때만 값이 실린다 */
  noReportReason: NoReportReason | null;
  items: SellerReportListItem[];
}

/** R-2 세그먼트 표 재료 — centroidStats 는 지표명이 열려 있어 좁히지 않는다 */
export interface SellerReportSegment {
  segmentId: number;
  size: number;
  llmLabel: string;
  llmDesc: string;
  centroidStats: Record<string, number>;
}

/**
 * R-2 상세 — S-4 report 페이로드 13필드 + 보고서 전용 11필드.
 *
 * 앞 13개는 **같은 조립기(_report_payload)** 가 만들어 스키마가 동일하다.
 * 그래서 AnalysisReport 컴포넌트가 무수정으로 이 타입도 받는다(계약 확정 6:
 * 채팅 패널과 보고서 페이지가 구조적으로 어긋날 수 없게 한 설계).
 *
 * 평면 별칭(periodFrom/To·comparedFrom/To)과 reportMd 는 **의도적으로 뺐다** —
 * 각각 period.{from,to}·comparedPeriod·body 와 값이 같은 중복 필드라, 타입에 올리면
 * "어느 쪽을 읽어야 하나"가 생긴다. reportMd 는 원본 컬럼이 아니라 마스킹된 body 의
 * 복사본이므로 body 를 읽는 것이 항상 안전하다.
 */
export interface SellerReportDetail extends SellerReport {
  reportId: string;
  triggerType: SellerReportTriggerType;
  /** 비교 기간 — 없을 수 있다 */
  comparedPeriod: { from: string; to: string } | null;
  segments: SellerReportSegment[];
  /** {step, reason} 판정 보류 원본. limitations[] 에도 문자열로 합류돼 온다 */
  holds: { step: string; reason: string }[];
  /**
   * **이번 조회로 각인되기 "직전" 값** — 첫 조회는 null.
   * R-2 조회가 곧 읽음 처리(멱등)이며, 방금 바뀐 값을 실으면
   * "안 읽음→읽음" 전환을 감지할 수 없어 서버가 직전 값을 준다.
   */
  readAt: string | null;
}

/**
 * 등록 초안 카드의 근거·주의 블록 (2026-08-08 신설).
 *
 * kind 를 닫힌 유니온으로 두지 않는다 — 종류가 늘어도 FE 배포 없이 서버만 바뀌면 되게.
 * 아는 값은 source(초안 근거) · warning(승인 전 확인) · note(수정 반영 내역) 3종이고,
 * **모르는 kind 는 무시한다**(렌더하지 않는다).
 */
export interface DraftSection {
  kind: string;
  title: string; // 블록 제목 — 그대로 출력
  items: string[]; // 불릿 항목 — 그대로 출력
}

/**
 * 등록 초안의 표시 사본 (op === "create" 에만 존재, 2026-08-08 신설).
 *
 * changes 가 실행 정본이고 이쪽은 사람이 읽을 형태로 서버가 옮겨 둔 것이다.
 * **화면은 preview 만 본다** — changes 로 그리면 "32,000원"에서 32000 을 역파싱하거나
 * 카테고리 변환·할인율 계산을 FE 가 떠안게 되고, 그 계산이 AI 와 어긋나는 날이 온다.
 * (preview 를 고쳐 보내도 저장 값은 안 바뀐다 — 승인은 draftId 만 보낸다.)
 *
 * 값이 없을 수 있는 필드는 null 로 오지 키가 빠지지 않는다 — undefined 분기 불필요.
 */
export interface DraftPreview {
  title: string;
  imageUrl: string | null;
  /** true 면 "이미지 미등록" 배지 — 등록 후에 알아채는 걸 막는 장치 */
  imagePlaceholder: boolean;
  /** "32,000원" — 서버가 포맷을 마쳤다. 콤마·단위를 다시 붙이지 말 것 */
  priceText: string;
  originalPriceText: string | null;
  /** 0 이면 할인 배지를 숨긴다 */
  discountRate: number;
  stockText: string; // "50개" — 포맷 완료
  /**
   * "패션의류/잡화 > 남성의류 > 셔츠".
   * changes 에는 categoryId 만 있고 이를 경로로 바꾸려면 1,221건짜리 트리가 필요한데
   * FE 에 그 트리가 없다 — AI 가 스냅샷을 갖고 있어 서버가 변환해 내려준다.
   */
  categoryPath: string;
  summary: string | null;
  description: string | null;
  sections: DraftSection[];
}

/** 상품 상세 수정/삭제/등록 제안(HITL 승인 대기) */
export interface SellerDraft {
  /**
   * confirm 이 참조(보여준 것 == 실행).
   * **캐싱 금지** — 수정 턴마다 새로 발급되고 이전 것은 서버가 무효화한다.
   * 옛 값으로 confirm 하면 실패한다(브라우저에 남은 카드로 수정 전 값이 등록되는 걸 막는 장치).
   */
  draftId: string;
  op: "update" | "create" | "delete";
  productId: string | null; // create는 null 일 수 있음
  /** 실행 정본 — 승인하면 이 값이 그대로 상품이 된다. 표시에는 쓰지 않는다 */
  changes: {
    field: SellerDraftField | string;
    before: string | number;
    after: string | number;
  }[];
  summary: string; // "가격을 27,500원으로 인하"
  /** 표시 사본 — op === "create" 에만 온다 */
  preview?: DraftPreview;
}

// ── 이벤트 스트림 ──
// 와이어 포맷: 각 이벤트는 `data: {"type":..., "data":{...}}` 한 줄(구매자·판매자 공통).
// event: 라인은 쓰지 않는다 — payload 의 type 으로 구분한다.

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

/** 판매자 progress 페이로드 — 자유 문자열(계약 S-4, 구매자와 쉐이프가 다르다) */
export interface SellerProgress {
  text: string;
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

// 액션 실패 사유(계약 CH-2 §action).
// message는 AI가 조립한 사용자 노출 문구 → FE는 그대로 표시하고 reason으로만 분기.
export type ActionFailReason =
  | "PRODUCT_NOT_FOUND"
  | "STOCK_INSUFFICIENT" // 재고 부족·품절(OUT_OF_STOCK 통합)
  | "CART_ERROR" // 운영 오류 또는 수량 상한 초과(합산>99)
  | "WISHLIST_ERROR"; // 찜 추가·해제의 그 밖의 실패(2026-08-05 신설)

/**
 * SSE action 이벤트 페이로드(계약 CH-2 §action, 2종 → 10종 확장 2026-08-05 #116·#117).
 * 근거 계약은 I-24(삭제)·I-25(수량 변경)·I-26(찜 추가)·I-27(찜 해제).
 *
 * "이미 그 상태"인 경우는 실패가 아니라 성공으로 온다 — 사용자 목표 상태가 같기 때문이다.
 * (404 CART_ITEM_NOT_FOUND → CART_REMOVED, 409 WISHLIST_DUPLICATE → WISHLIST_ADDED,
 *  404 WISHLIST_NOT_FOUND → WISHLIST_REMOVED)
 */
export type ChatAction =
  // ── SHOPPING : 장바구니 ──
  // cartItemId 는 문자열이다(2026-08-06 공통 규약) — BIGINT 라 number 로 파싱하면
  // 끝자리가 조용히 바뀐다. CartItem.cartItemId 와 같은 축이라 타입도 같아야 한다.
  | { type: "CART_ADDED"; message: string; cartItemId: string }
  | { type: "CART_ADD_FAILED"; message: string; reason: ActionFailReason }
  // CART_REMOVED 도 담기와 같은 필드로 항목 id 를 싣는다(§2.6).
  | { type: "CART_REMOVED"; message: string; cartItemId: string }
  | { type: "CART_REMOVE_FAILED"; message: string; reason: ActionFailReason }
  // 수량 변경 2종은 계약에만 있고 AI 가 아직 발행하지 않는다(I-25 미구현, 대응 이슈 없음).
  // 계약이 확정이라 수신부를 미리 둔다 — 켜질 때 FE 배포를 기다리지 않게.
  | {
      type: "CART_QUANTITY_CHANGED";
      message: string;
      cartItemId: string;
      quantity: number;
    }
  | {
      type: "CART_QUANTITY_CHANGE_FAILED";
      message: string;
      reason: ActionFailReason;
    }
  // ── SHOPPING : 찜 ──
  // 찜 이벤트는 식별자를 싣지 않는다 — 구매자 SSE 가 상품 id 를 싣지 않는 경로 B를 지킨다(§2.6).
  // FE 는 type 만 보고 찜 목록을 재조회한다.
  // 게스트 찜 발화는 action 이 아예 오지 않는다 — 회원 전용(M-4)이라 token 로그인 안내로 degrade.
  | { type: "WISHLIST_ADDED"; message: string }
  | { type: "WISHLIST_ADD_FAILED"; message: string; reason: ActionFailReason }
  | { type: "WISHLIST_REMOVED"; message: string }
  | { type: "WISHLIST_REMOVE_FAILED"; message: string; reason: ActionFailReason }
  // ── SELLER ──
  | { type: "PRODUCT_UPDATED"; message: string; productId: string }
  | { type: "PRODUCT_UPDATE_FAILED"; message: string; productId: string };

/**
 * 장바구니가 실제로 바뀐 액션인가 — 성공 3종만 해당한다(실패는 서버 상태가 그대로다).
 * 재조회 대상을 화면이 아니라 계약 옆에 두는 이유: action type 이 늘어날 때
 * 갱신해야 할 곳이 여기 하나이길 바라서다(2종 → 10종 확장에서 실제로 겪은 문제).
 */
export function isCartMutatingAction(action: ChatAction): boolean {
  return (
    action.type === "CART_ADDED" ||
    action.type === "CART_REMOVED" ||
    action.type === "CART_QUANTITY_CHANGED"
  );
}

/** 찜 목록이 실제로 바뀐 액션인가 — 성공 2종만. 찜 이벤트엔 productId 가 없어 목록 재조회뿐이다. */
export function isWishlistMutatingAction(action: ChatAction): boolean {
  return action.type === "WISHLIST_ADDED" || action.type === "WISHLIST_REMOVED";
}

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
