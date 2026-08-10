import {
  PREDICATE_LABEL,
  PREDICATE_ORDER,
  type PreferenceEdge,
  type PreferenceNodeType,
  type PreferencePredicate,
} from "./types";

/**
 * 요약 카드에 쓸 수치 — **지금 있는 데이터만으로 계산한다.**
 *
 * ⚠️ 확정 응답의 edge 에는 `predicate` · `object{type,label}` · `editable` ·
 * `challenged` 뿐이다. `lastConfirmedAt` · `confidence` · `source` · `origin`
 * 은 **계약에서 빠졌다**(types.ts 주석). 그래서 아래는 만들 수 없다:
 *
 * | 흔히 넣고 싶어지는 것 | 왜 못 하나 |
 * |---|---|
 * | "지난주에 생긴 취향" | 시각 필드가 없다 |
 * | "확신도 높은 취향" | confidence 가 없다 |
 * | "대화에서 알게 된 N개" | source 가 없다 |
 *
 * **"최근"만 예외적으로 쓸 수 있다.** 서버 정렬이 그룹 안에서 *최근 확인 시각
 * 내림차순*으로 고정이라(types.ts §PREDICATE_ORDER), 배열 **앞쪽 = 더 최근**이
 * 보장된다. 날짜를 지어내지 않고 순서만 신뢰하는 것이라 계약 안에 있다.
 * 그래서 `interestedIn`(계약 정의: "최근 관심")의 앞 몇 개를 그대로 쓴다.
 */

/** 대상 종류의 한국어 — nodeId 는 화면 노출 금지라 type 만 옮긴다 */
const TYPE_LABEL: Record<PreferenceNodeType, string> = {
  brand: "브랜드",
  category: "카테고리",
  attribute: "속성",
  priceBand: "가격대",
  ratingBand: "평점대",
  product: "제품",
  situation: "상황",
};

export interface PredicateCount {
  predicate: PreferencePredicate;
  label: string;
  count: number;
}

/**
 * 취향을 설명하는 단서 한 칸 — `라벨 + 값`.
 *
 * ⚠️ **요약 문단(markdown)을 파싱해서 만들지 않는다.** 그건 LLM 생성 문자열이라
 * 문형이 언제든 바뀌고, "소니 제품을 선호로 등록하셨어요" 에서 브랜드명을
 * 뽑아내려면 문장 규칙을 가정해야 한다 — 그 가정이 깨지는 순간 화면이 조용히
 * 틀린 값을 보여준다.
 *
 * 다행히 그 문장들이 말하는 내용은 **이미 edge 에 구조화돼 있다**:
 *   "소니 제품을 선호로 등록하셨어요"  → prefers + type:brand
 *   "출퇴근 상황에서 쓸 제품을…"       → interestedIn + type:situation
 *   "무광 블랙 같은 차분한 마감을…"     → likes + type:attribute
 * 그래서 문장이 아니라 **(관계, 대상 종류)** 조합으로 뽑는다.
 */
export interface SummaryFacet {
  /** "선호 브랜드" 처럼 무엇인지 알려주는 작은 라벨 */
  label: string;
  /** 대표값 하나 — 서버 정렬상 그룹 앞쪽이 더 최근·더 대표적이다 */
  value: string;
  /** 같은 칸에 딸린 보조값(있을 때만). "무광 블랙 · 광택" 처럼 */
  extra?: string;
}

/**
 * 뽑아낼 단서의 정의 — (관계, 대상 종류) → 라벨.
 *
 * 순서가 곧 화면 순서다. 데이터가 없는 칸은 통째로 빠지고, 남은 칸끼리
 * 자연스럽게 붙는다(호출부에서 빈 배열을 걸러낸다).
 */
const FACET_RULES: readonly {
  label: string;
  predicate: PreferencePredicate;
  type: PreferenceNodeType;
}[] = [
  { label: "선호 브랜드", predicate: "prefers", type: "brand" },
  { label: "주요 상황", predicate: "interestedIn", type: "situation" },
  { label: "좋아하는 느낌", predicate: "likes", type: "attribute" },
];

export interface SummaryStats {
  /** 전체 취향 수 */
  total: number;
  /** 관계별 개수 — 항상 5개(빈 것도 자리를 지킨다) */
  counts: PredicateCount[];
  /**
   * 가장 많은 관계. 취향이 없거나 1등이 0개면 null.
   *
   * 지금 화면에서는 쓰지 않는다 — 요약 카드의 문장을 짧게 줄이면서, 이 사실은
   * 분포 막대와 범례가 이미 보여주게 됐다. 계산이 값싸고 테스트가 있어
   * 남겨 둔다(요약을 늘릴 때 가장 먼저 쓰게 될 값이다).
   */
  strongest: PredicateCount | null;
  /**
   * 요즘 자주 드러난 취향 — `interestedIn` 앞쪽 몇 개.
   * 그 관계가 비면 빈 배열이다(다른 관계로 대체하지 않는다 — "최근"이 아니게 된다).
   */
  recent: string[];
  /** 가장 많이 나온 대상 종류(브랜드·속성…). 동률이면 먼저 나온 것 */
  topType: { label: string; count: number } | null;
  /**
   * 취향을 설명하는 단서 — `선호 브랜드 · 주요 상황 · 좋아하는 느낌`.
   * 해당 데이터가 없는 칸은 아예 들어오지 않는다(빈 값을 만들지 않는다).
   */
  facets: SummaryFacet[];
}

/** 요약에 보여줄 "요즘 관심" 최대 개수 — 한 줄에 들어가는 만큼만 */
const RECENT_LIMIT = 4;

export function buildSummaryStats(edges: readonly PreferenceEdge[]): SummaryStats {
  const counts: PredicateCount[] = PREDICATE_ORDER.map((predicate) => ({
    predicate,
    label: PREDICATE_LABEL[predicate],
    count: edges.filter((e) => e.predicate === predicate).length,
  }));

  // 최다 관계. 클라이언트 재정렬 금지 규칙은 **그룹 안 항목 순서**에 대한
  // 것이라(types.ts), 여기서 개수를 비교하는 것은 그 규칙과 무관하다.
  const strongest = counts.reduce<PredicateCount | null>(
    (best, c) => (c.count > 0 && (!best || c.count > best.count) ? c : best),
    null,
  );

  const recent = edges
    .filter((e) => e.predicate === "interestedIn")
    .slice(0, RECENT_LIMIT)
    .map((e) => e.object.label);

  // 대상 종류 분포 — "브랜드를 많이 보시네요" 같은 발견을 만든다
  const byType = new Map<PreferenceNodeType, number>();
  for (const edge of edges) {
    byType.set(edge.object.type, (byType.get(edge.object.type) ?? 0) + 1);
  }
  let topType: SummaryStats["topType"] = null;
  for (const [type, count] of byType) {
    if (!topType || count > topType.count) {
      topType = { label: TYPE_LABEL[type], count };
    }
  }

  /*
    단서 칸 — 규칙에 맞는 edge 를 찾아 대표값 하나 + 보조값 하나까지.

    두 개까지만 쓰는 이유: 이 칸은 "이런 성향이구나"를 한눈에 전하는 자리라
    값이 늘수록 오히려 안 읽힌다. 나머지는 아래 전체 목록에 다 있다.
  */
  const facets: SummaryFacet[] = [];
  for (const rule of FACET_RULES) {
    const matched = edges.filter(
      (e) => e.predicate === rule.predicate && e.object.type === rule.type,
    );
    if (matched.length === 0) continue; // 없는 칸은 만들지 않는다
    facets.push({
      label: rule.label,
      value: matched[0].object.label,
      extra: matched[1]?.object.label,
    });
  }

  return { total: edges.length, counts, strongest, recent, topType, facets };
}
