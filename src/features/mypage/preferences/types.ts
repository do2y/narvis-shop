// 개인화 취향 프로필 데이터 계약 — 노션 「개인화 마이페이지 구현」 5장과 1:1.
//
// ⚠️ API 5종은 아직 BE 초안이다(노션 12장). 경로·필드가 바뀔 수 있으므로
// 계약 표현은 이 파일과 api.ts 두 곳에만 두고, 화면 코드는 여기 타입만 본다.
//
// M-14(되돌리기)는 폐기됐다 — 번호가 빈 것이지 누락이 아니다.
// 그래서 응답에 suppressed·suppressedAt·restorable이 없고, 삭제는 즉시 영구다.

/**
 * 취향 대상의 종류.
 *
 * 수정 창에서 사용자가 새 대상을 직접 입력할 때도 이 값을 실어 보낸다
 * (자동완성으로 고른 경우는 nodeId를 쓴다 — EditEdgeRequest 주석 참조).
 */
export type PreferenceNodeType =
  | "brand"
  | "category"
  | "attribute"
  | "priceBand"
  | "ratingBand"
  | "product"
  | "situation";

/**
 * 나와 대상을 잇는 관계 5종.
 *
 * purchased는 "의견이 아니라 사실"이라 사용자가 만들 수 없다 — 수정 창의
 * 선택지에서 빼야 하고, 보내면 서버가 400으로 거절한다(EDITABLE_PREDICATES).
 *
 * avoids·purchased는 당분간 항상 빈 배열로 온다. 이 관계를 만드는 경로가
 * 아직 없어서다. **오류가 아니다** — 화면에서 "아직 없어요"로 자리만 지킨다.
 */
export type PreferencePredicate =
  | "prefers" // 비교 선호 — 다른 것 대신 이것
  | "likes" // 단순 긍정 — 비교 없이 좋아함
  | "avoids" // 명시적 회피
  | "interestedIn" // 최근 관심 (시간이 지나면 약해짐)
  | "purchased"; // 구매 사실 — 수정 불가

/**
 * 화면 표시 순서 = 서버 정렬 순서.
 *
 * 서버가 이 순서로 내려주므로 **클라이언트가 재정렬하지 않는다**. 여기 배열은
 * 그룹으로 묶을 때 순회 기준으로만 쓴다(빈 그룹도 자리를 지켜야 해서, edges에
 * 없는 predicate까지 훑어야 한다).
 */
export const PREDICATE_ORDER: readonly PreferencePredicate[] = [
  "prefers",
  "likes",
  "avoids",
  "interestedIn",
  "purchased",
] as const;

/** 그룹 헤더에 쓰는 한국어 라벨 (노션 10.2) */
export const PREDICATE_LABEL: Record<PreferencePredicate, string> = {
  prefers: "선호",
  likes: "좋아함",
  avoids: "회피",
  interestedIn: "관심",
  purchased: "구매",
};

/**
 * 수정 창에서 고를 수 있는 관계 — purchased 제외.
 *
 * "구매"를 선택지에 넣으면 서버가 400을 낸다. 목록에서 빼는 것으로 방어한다.
 */
export const EDITABLE_PREDICATES: readonly PreferencePredicate[] = [
  "prefers",
  "likes",
  "avoids",
  "interestedIn",
] as const;

/** AI가 이 취향을 얼마나 확신하는가 */
export type PreferenceConfidence = "HIGH" | "MEDIUM" | "LOW";

/**
 * 확신도 문구.
 *
 * "신뢰도 85%" 같은 수치형 표현을 쓰지 않는 이유: 3단계 경계값이 서버 설정이라
 * 바뀔 수 있는데, 수치 라벨은 경계가 바뀌면 그대로 거짓이 된다.
 */
export const CONFIDENCE_LABEL: Record<PreferenceConfidence, string> = {
  HIGH: "확실해요",
  MEDIUM: "그런 것 같아요",
  LOW: "아직 확실하지 않아요",
};

/** 이 취향을 어디서 알게 되었나 */
export type PreferenceSource = "conversation" | "purchase" | "user";

/**
 * "왜 이 취향이 있나요"에 답할 수 있는 재료는 source와 lastConfirmedAt 둘뿐이다.
 * 원래 발화를 되돌려 보여주는 것은 금지이고, 서버가 주지도 않는다(노션 3.3).
 */
export const SOURCE_LABEL: Record<PreferenceSource, string> = {
  conversation: "대화에서 알게 되었어요",
  purchase: "구매 내역에서 알게 되었어요",
  user: "직접 수정하셨어요",
};

/** 누가 만든 취향인가 — user면 "내가 수정함" 배지 */
export type PreferenceOrigin = "machine" | "user";

/** 취향의 대상. edges[].to가 이 nodeId를 참조한다. */
export interface PreferenceNode {
  /** 내부 식별자 — "category:음향가전 > 블루투스 이어폰" 형태. **화면에 표시 금지** */
  nodeId: string;
  type: PreferenceNodeType;
  /** 화면에 보여줄 이름 — nodeId 대신 항상 이 값을 쓴다 */
  label: string;
  /** false면 추천에서 빠질 수 있는 대상 → 점선 테두리 */
  verified: boolean;
}

/**
 * 취향 한 줄 — "나 → 관계 → 대상".
 *
 * 출발점(from)이 없는 것은 누락이 아니다. 항상 "나"라서 일부러 뺐다.
 * 넣으면 "여러 단계로 이어진 그래프"라는 잘못된 신호가 된다(노션 10.1).
 */
export interface PreferenceEdge {
  /**
   * ⚠️ (관계, 대상)에서 파생되는 값이라 **수정하면 바뀐다.**
   * 수정 응답의 edge.edgeId로 클라이언트 키를 교체하지 않으면 다음
   * 수정·삭제가 전부 404다. 이 계약에서 가장 놓치기 쉬운 지점.
   */
  edgeId: string;
  /** PreferenceNode.nodeId 참조 */
  to: string;
  predicate: PreferencePredicate;
  source: PreferenceSource;
  origin: PreferenceOrigin;
  confidence: PreferenceConfidence;
  firstSeenAt: string; // ISO 일시
  lastConfirmedAt: string; // ISO 일시 — "최근 확인 7월 29일"
  /** false = 구매 기록. ✏️만 비활성이고 🗑은 살아 있다 */
  editable: boolean;
  /** true면 "최근 취향이 바뀐 것 같아요" 배지 (색은 바꾸지 않음) */
  challenged: boolean;
  /**
   * 🔒 **시각적 차이를 두면 안 된다.**
   * 다르게 보이는 것 자체가 "이 취향은 민감한 정보에서 나왔다"는 공개다.
   * 일반 항목과 완전히 똑같이 그린다(노션 3.3·7장).
   *
   * 타입에는 남겨두되 화면에서 읽지 않는다 — 계약에 있는 필드라 지우지 않는다.
   */
  derivedFromSensitive: boolean;
}

/**
 * 이 데이터를 어디에 쓸 수 있는가.
 *
 * ⚠️ **filterSafe는 읽고 분기할 값이 아니다.** 항상 false로 오며,
 * "이 데이터를 검색 필터로 바꾸는 것은 계약 위반"을 응답에 박아둔 표지판이다.
 *
 * 프로필을 필터 생성 단계에 주입했다가 회원 추천이 비회원보다 나빠진 실측
 * 회귀가 있다(nDCG@10 −0.288, 31턴 중 29턴에서 가격·브랜드·평점 축 오염).
 * 취향은 추천 **순서**에만 쓰고 후보를 **걸러내는 데** 쓰지 않는다.
 */
export interface PreferenceUsagePolicy {
  orderOnly: boolean;
  filterSafe: boolean;
}

/** 개인화 사용 여부 — 끄면 수집·사용이 멈추고 데이터는 보존된다 */
export interface PersonalizationState {
  enabled: boolean;
  disabledAt: string | null;
}

/** M-11 조회 응답 — 화면 전체가 이 하나로 그려진다 */
export interface ProfileGraph {
  userId: number;
  /**
   * false = 신규 회원. **오류가 아니고 HTTP 200이다.**
   * 빈 화면 안내로 처리하되 개인화 스위치와 [전체 초기화]는 그대로 보인다.
   */
  exists: boolean;
  /** 좌상단 요약 문단. LLM 생성 문자열이라 HTML을 허용하지 않고 렌더한다 */
  markdown: string | null;
  generatedAt: string | null;
  /** ★ 보관 필수 — If-Match로 되돌려 보낸다. 불투명 문자열이라 파싱·비교 금지 */
  graphVersion: string;
  personalization: PersonalizationState;
  usagePolicy: PreferenceUsagePolicy;
  nodes: PreferenceNode[];
  edges: PreferenceEdge[];
  /** 관측용 — **사용자에게 노출 금지**(그 개수 자체가 민감 정보 유출) */
  unprojectedCount: number;
  /** true = 서버 상한 200개에서 잘림. 페이지네이션은 계약에 없다 */
  truncated: boolean;
}

/**
 * 수정 요청의 대상 지정 — 둘 중 하나만 보낸다. 함께 실으면 400.
 *
 * 자동완성으로 고른 경우 nodeId를 쓰는 게 **권장**이다. type+label로 보내면
 * 서버가 라벨을 다시 정규화하면서 사용자가 고른 것과 다른 대상으로 튈 수 있다.
 */
export type EditEdgeObject =
  | { nodeId: string }
  | { type: PreferenceNodeType; label: string };

/**
 * M-12 수정 요청.
 *
 * predicate·object 중 최소 하나는 바뀌어야 한다. 아무것도 안 바꾸고 저장을
 * 누르면 그대로 보내지 말고 창만 닫는다(서버는 400을 낸다).
 */
export interface EditEdgeRequest {
  predicate?: PreferencePredicate;
  object?: EditEdgeObject;
}

/** M-12 수정 응답 */
export interface EditEdgeResponse {
  userId: number;
  /** ★ 보관값 갱신 */
  graphVersion: string;
  /** ★ edgeId가 요청에 쓴 값과 다를 수 있다 — 클라이언트 키를 이걸로 교체 */
  edge: PreferenceEdge;
  /**
   * true = 고친 내용이 이미 있던 다른 항목과 합쳐졌다.
   * 목록에서 항목 하나가 사라진 것처럼 보이므로 M-11 재조회가 필요하다.
   */
  merged: boolean;
  /** true = 중복 요청을 서버가 알아보고 처음 응답을 돌려준 것. 오류가 아니다 */
  replayed: boolean;
}

/** M-13 삭제 응답 — body 없이 호출한다 */
export interface DeleteEdgeResponse {
  userId: number;
  graphVersion: string;
  edgeId: string;
  replayed: boolean;
}

/**
 * M-15 초기화 범위.
 *
 * 지금은 "ALL" 하나뿐이고 생략할 수 없다 — 빈 요청 하나로 전체 삭제가
 * 일어나지 않게 막는 판별자다. 파괴 범위를 호출자가 명시적으로 이름 붙이게 한다.
 */
export type ResetScope = "ALL";

export interface ResetGraphRequest {
  scope: ResetScope;
}

/** 초기화로 실제 삭제된 것 — 결과 안내에 쓴다 */
export interface PurgedCounts {
  edges: number;
  nodes: number;
  facts: number;
  /** ★ 대화 기록. 사용자가 가장 놓치기 쉬운 항목이라 안내에 반드시 포함 */
  transcriptTurns: number;
}

/** M-15 초기화 응답 */
export interface ResetGraphResponse {
  userId: number;
  graphVersion: string;
  purged: PurgedCounts;
  /** 초기화해도 개인화 ON/OFF 설정은 바뀌지 않는다 */
  personalization: PersonalizationState;
  replayed: boolean;
}

export interface SetPersonalizationRequest {
  enabled: boolean;
}

/** M-16 개인화 응답 */
export interface SetPersonalizationResponse {
  userId: number;
  graphVersion: string;
  personalization: PersonalizationState;
  replayed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 에러 코드 — HTTP 상태로만 분기하면 틀리는 지점이 있어 코드를 상수로 둔다
// ─────────────────────────────────────────────────────────────────────────────

/** 버전 충돌 — 재조회하면 풀린다 */
export const PROFILE_VERSION_CONFLICT = "PROFILE_VERSION_CONFLICT";
/** 구매 기록을 수정하려 함 — 몇 번을 해도 안 된다. 재시도 금지 */
export const PROFILE_EDGE_NOT_EDITABLE = "PROFILE_EDGE_NOT_EDITABLE";
/** 이미 삭제되었거나 변경된 항목 */
export const PROFILE_EDGE_NOT_FOUND = "PROFILE_EDGE_NOT_FOUND";

/**
 * 409 두 종류를 가른다.
 *
 * ⚠️ **상태 코드로만 보면 틀린다.** 둘 다 409인데 대응이 정반대다 —
 * VERSION_CONFLICT는 재조회하면 풀리지만 NOT_EDITABLE은 몇 번을 해도 안 된다.
 * 그래서 판정을 여기 한 곳에 모아 호출부가 code를 직접 비교하지 않게 한다.
 */
export function isVersionConflict(code: string): boolean {
  return code === PROFILE_VERSION_CONFLICT;
}

export function isNotEditableConflict(code: string): boolean {
  return code === PROFILE_EDGE_NOT_EDITABLE;
}

// ─────────────────────────────────────────────────────────────────────────────
// 화면 조립 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

/** 한 그룹에 표시할 최대 항목 수. 초과분은 `+N개 더`로 접는다(노션 3.2) */
export const GROUP_DISPLAY_LIMIT = 12;

/** 관계별로 묶은 그룹 — 빈 그룹도 자리를 지켜야 해서 항상 5개가 나온다 */
export interface PreferenceGroupData {
  predicate: PreferencePredicate;
  label: string;
  edges: PreferenceEdge[];
}

/**
 * edges를 관계별 5그룹으로 묶는다.
 *
 * **서버 정렬을 보존한다** — 그룹 순서는 PREDICATE_ORDER(서버와 같은 순서)이고
 * 그룹 안 항목은 서버가 준 순서 그대로다. 클라이언트 재정렬은 금지다.
 *
 * edges에 없는 predicate도 빈 그룹으로 반환한다. avoids·purchased가 당분간
 * 항상 비어 있는데, 빼버리면 "회피는 등록할 수 없나?"라는 오해가 생긴다.
 */
export function groupEdgesByPredicate(
  edges: readonly PreferenceEdge[],
): PreferenceGroupData[] {
  return PREDICATE_ORDER.map((predicate) => ({
    predicate,
    label: PREDICATE_LABEL[predicate],
    edges: edges.filter((e) => e.predicate === predicate),
  }));
}

/**
 * nodeId → 노드 조회용 맵.
 *
 * edges[].to가 nodeId 문자열이라 라벨을 찾으려면 매번 nodes를 훑어야 하는데,
 * 항목이 200개까지 올 수 있어 렌더마다 선형 탐색을 반복하면 O(n²)이 된다.
 */
export function indexNodes(
  nodes: readonly PreferenceNode[],
): Map<string, PreferenceNode> {
  return new Map(nodes.map((n) => [n.nodeId, n]));
}
