/**
 * 판매자 데모 시나리오.
 *
 * ⚠️ **목 데이터다.** 계약(`shared/types/chat.ts`)의 모양을 따르되 서버를 부르지
 * 않는다. 분석 종류는 실제 `SellerAnalysisType` 6종 안에서만 쓴다 —
 * 지원 여부가 불분명한 분석을 지어내면 랜딩이 없는 기능을 약속하게 된다.
 *
 * **내부 용어를 쓰지 않는다.** 멀티 에이전트·오케스트레이터·서브그래프·노드·
 * 상태 머신은 이 파일 어디에도 등장하지 않는다. 화면에는 "여러 분석 관점",
 * "결과 교차 검토" 같은 사용자 언어만 나간다.
 */

/** 분석 진행 단계 — 사용자에게 보이는 이름 */
export interface AnalysisStage {
  label: string;
  /** 그 단계에서 무엇을 하는지 한 줄 */
  detail: string;
}

export const ANALYSIS_STAGES: readonly AnalysisStage[] = [
  { label: "질문 이해", detail: "질문 범위와 기간을 확인해요" },
  { label: "관련 데이터 확인", detail: "필요한 판매 데이터를 모아요" },
  { label: "여러 관점으로 분석", detail: "매출·전환·행동을 나눠서 살펴봐요" },
  { label: "결과 검토", detail: "관점별 결과를 서로 맞춰봐요" },
  { label: "보고서 작성", detail: "핵심 요약과 개선안으로 정리해요" },
] as const;

/** 지표 카드 한 칸 */
export interface DemoMetric {
  label: string;
  value: string;
  /** 증감률(%) — null이면 비교 데이터 없음 */
  deltaRate: number | null;
  caption: string;
  /** 이상 징후로 강조할 지표 */
  flagged?: boolean;
}

/** 리포트의 발견 한 건 */
export interface DemoFinding {
  /** 실제 `SellerAnalysisType`의 화면 라벨과 같은 문구를 쓴다 */
  analysisLabel: string;
  severity: "info" | "warning" | "critical";
  summary: string;
  /** 데이터로 확인된 수치 근거 */
  evidence: string[];
}

export interface DemoRecommendation {
  index: number;
  title: string;
  expectedEffect: string;
  actionLabel: string;
}

export interface SellerScenario {
  question: string;
  /** 질문 범위 확인 — AI가 무엇을 분석할지 되짚는 단계 */
  scope: { label: string; value: string }[];
  metrics: DemoMetric[];
  summary: string;
  findings: DemoFinding[];
  recommendations: DemoRecommendation[];
  /** 상품 수정 초안 — 개선안을 실행으로 옮길 때의 전·후 비교 */
  draft: {
    summary: string;
    changes: { field: string; before: string; after: string }[];
  };
}

export const SELLER_SCENARIOS: readonly SellerScenario[] = [
  {
    question: "최근 30일 매출이 떨어진 상품과 원인을 알려줘",
    scope: [
      { label: "기간", value: "최근 30일" },
      { label: "대상", value: "판매 중 상품 42개" },
      { label: "관점", value: "매출 · 전환 · 고객 행동" },
    ],
    metrics: [
      {
        label: "30일 매출",
        value: "1,842만원",
        deltaRate: -18.4,
        caption: "이전 30일 대비",
        flagged: true,
      },
      {
        label: "주문 수",
        value: "612건",
        deltaRate: -9.2,
        caption: "이전 30일 대비",
      },
      {
        label: "구매 전환율",
        value: "1.8%",
        deltaRate: -0.7,
        caption: "이전 30일 대비",
        flagged: true,
      },
      {
        label: "상품 조회수",
        value: "34,120",
        deltaRate: 4.1,
        caption: "이전 30일 대비",
      },
    ],
    summary:
      "조회수는 늘었지만 매출은 18.4% 줄었어요. 특정 상품 3개에서 전환이 크게 떨어진 것이 가장 큰 영향으로 보입니다.",
    findings: [
      {
        analysisLabel: "매출 이상 분석",
        severity: "critical",
        summary:
          "‘경량 러닝화 GX-1’의 매출이 30일 만에 절반 이하로 줄었어요.",
        evidence: [
          "매출 412만원 → 176만원 (-57.3%)",
          "감소분의 68%가 이 상품 한 건에서 발생",
        ],
      },
      {
        analysisLabel: "구매전환 분석",
        severity: "warning",
        summary:
          "조회는 유지되는데 장바구니 담기에서 이탈이 늘었어요.",
        evidence: [
          "조회 → 장바구니 4.2% → 1.9%",
          "재고 없음 옵션 노출 비율 31%",
        ],
      },
      {
        analysisLabel: "고객 행동 분석",
        severity: "info",
        summary:
          "상세 페이지 체류 시간은 오히려 늘었어요. 정보를 찾다 이탈했을 가능성이 있어요.",
        evidence: ["평균 체류 48초 → 71초"],
      },
    ],
    recommendations: [
      {
        index: 1,
        title: "품절 옵션을 정리하고 재고를 보충하세요",
        expectedEffect: "장바구니 담기 이탈 감소",
        actionLabel: "재고 조정",
      },
      {
        index: 2,
        title: "사이즈 정보를 상세 설명 상단으로 올리세요",
        expectedEffect: "정보 탐색 이탈 감소",
        actionLabel: "설명 개선",
      },
    ],
    draft: {
      summary: "‘경량 러닝화 GX-1’ 상세 설명에 사이즈 안내를 추가",
      changes: [
        {
          field: "상품 설명",
          before: "가볍고 편안한 데일리 러닝화입니다.",
          after:
            "가볍고 편안한 데일리 러닝화입니다. 정사이즈 권장 · 발볼 넓은 편.",
        },
        { field: "재고", before: "0", after: "40" },
      ],
    },
  },
  {
    question: "조회수는 높은데 구매 전환율이 낮은 상품을 찾아줘",
    scope: [
      { label: "기간", value: "최근 14일" },
      { label: "대상", value: "조회 상위 20개 상품" },
      { label: "관점", value: "구매 전환 · 고객 행동" },
    ],
    metrics: [
      {
        label: "평균 전환율",
        value: "2.1%",
        deltaRate: -0.3,
        caption: "이전 14일 대비",
      },
      {
        label: "조회 상위 20개",
        value: "18,940",
        deltaRate: 12.6,
        caption: "조회수 합계",
      },
      {
        label: "전환 부진 상품",
        value: "4개",
        deltaRate: null,
        caption: "평균 대비 절반 이하",
        flagged: true,
      },
      {
        label: "장바구니 이탈률",
        value: "63%",
        deltaRate: 5.4,
        caption: "이전 14일 대비",
        flagged: true,
      },
    ],
    summary:
      "조회 상위 20개 중 4개가 평균 전환율의 절반에 못 미쳐요. 가격 경쟁력보다 상세 정보 부족이 공통점으로 보입니다.",
    findings: [
      {
        analysisLabel: "구매전환 분석",
        severity: "warning",
        summary:
          "‘방수 세면도구 파우치’는 조회 3위인데 전환은 하위권이에요.",
        evidence: ["조회 2,140회 · 전환 0.8%", "평균 전환율 2.1% 대비 -1.3%p"],
      },
      {
        analysisLabel: "고객 행동 분석",
        severity: "warning",
        summary:
          "부진한 4개 상품 모두 이미지가 2장 이하예요.",
        evidence: ["전환 상위 상품 평균 이미지 6.4장"],
      },
      {
        analysisLabel: "리뷰 분석",
        severity: "info",
        summary: "리뷰 수가 적어 구매 판단 근거가 부족할 수 있어요.",
        evidence: ["부진 상품 평균 리뷰 3.2건"],
      },
    ],
    recommendations: [
      {
        index: 1,
        title: "부진 상품 4개에 사용 예시 이미지를 추가하세요",
        expectedEffect: "상세 이탈 감소",
        actionLabel: "설명 개선",
      },
      {
        index: 2,
        title: "‘방수 파우치’ 판매가를 3만 원 이하로 조정해 보세요",
        expectedEffect: "가격대 진입 장벽 완화",
        actionLabel: "가격 조정",
      },
    ],
    draft: {
      summary: "‘방수 세면도구 파우치’ 판매가 조정",
      changes: [
        { field: "판매가", before: "34,000원", after: "29,900원" },
        { field: "상품명", before: "방수 세면도구 파우치", after: "방수 세면도구 파우치 (행잉형)" },
      ],
    },
  },
  {
    question: "판매가 부진한 상품의 개선안을 제안해줘",
    scope: [
      { label: "기간", value: "최근 30일" },
      { label: "대상", value: "판매 부진 상품 6개" },
      { label: "관점", value: "매출 · 전환 · 리뷰" },
    ],
    metrics: [
      {
        label: "부진 상품",
        value: "6개",
        deltaRate: null,
        caption: "30일 주문 3건 이하",
        flagged: true,
      },
      {
        label: "해당 매출 비중",
        value: "4.2%",
        deltaRate: -1.8,
        caption: "전체 매출 대비",
      },
      {
        label: "평균 리뷰 평점",
        value: "3.6",
        deltaRate: -0.4,
        caption: "이전 30일 대비",
        flagged: true,
      },
      {
        label: "재고 보유량",
        value: "284개",
        deltaRate: null,
        caption: "부진 상품 합계",
      },
    ],
    summary:
      "부진 상품 6개 중 4개는 노출 자체가 적었고, 2개는 리뷰 평점이 떨어진 뒤 주문이 줄었어요.",
    findings: [
      {
        analysisLabel: "매출 이상 분석",
        severity: "warning",
        summary: "4개 상품은 검색 노출이 거의 없었어요.",
        evidence: ["30일 노출 120회 이하", "카테고리 미지정 3건"],
      },
      {
        analysisLabel: "리뷰 분석",
        severity: "critical",
        summary:
          "‘캠핑 랜턴’은 최근 리뷰 평점이 떨어진 뒤 주문이 끊겼어요.",
        evidence: ["평점 4.4 → 3.1", "최근 리뷰 5건 중 4건이 배터리 언급"],
      },
    ],
    recommendations: [
      {
        index: 1,
        title: "카테고리가 비어 있는 3개 상품을 분류하세요",
        expectedEffect: "검색 노출 확보",
        actionLabel: "노출 변경",
      },
      {
        index: 2,
        title: "‘캠핑 랜턴’ 상세에 배터리 사용 시간을 명시하세요",
        expectedEffect: "리뷰 지적 사항 해소",
        actionLabel: "설명 개선",
      },
    ],
    draft: {
      summary: "‘충전식 캠핑 랜턴’ 카테고리 지정 및 설명 보완",
      changes: [
        { field: "카테고리", before: "미지정", after: "캠핑 > 조명" },
        {
          field: "상품 설명",
          before: "밝고 오래가는 충전식 랜턴입니다.",
          after:
            "밝고 오래가는 충전식 랜턴입니다. 완충 시 최대 12시간 사용 (최저 밝기 기준).",
        },
      ],
    },
  },
] as const;
