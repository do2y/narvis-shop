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
