// 개인화 취향 프로필 데이터 계약.
//
// 정본: docs/plans/personalization-contract-2026-08-09.md (노션 M-11~M-16 / I-32~I-37)
// 2026-08-09 BE·FE 협의 완료 — 구현 근거로 쓸 수 있다.
//
// ⚠️ 이 파일은 한 번 축소됐다. 8/07 초안에 있던 nodes[]·confidence·source·origin·
// verified·usagePolicy·truncated 등은 **확정 응답에 없다.** 화면에서 쓰고 싶으면
// 계약 개정(C-25)이 먼저다 — 없는 필드를 낙관적으로 되살리지 말 것.
//
// M-14(되돌리기)는 폐기됐다. 번호가 빈 것이지 누락이 아니다.

/**
 * 취향 대상의 종류.
 *
 * 수정 창에서 사용자가 새 대상을 직접 입력할 때도 이 값을 실어 보낸다
 * (자동완성으로 고른 경우는 nodeId를 쓴다 — EditEdgeObject 주석 참조).
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
 * 서버 정렬은 predicate(이 순서) → 최근 확인 시각 내림차순 → edgeId 오름차순으로
 * 고정이다. **클라이언트가 재정렬하지 않는다.** 여기 배열은 그룹으로 묶을 때
 * 순회 기준으로만 쓴다(빈 그룹도 자리를 지켜야 해서, edges에 없는 predicate까지
 * 훑어야 한다).
 */
export const PREDICATE_ORDER: readonly PreferencePredicate[] = [
  "prefers",
  "likes",
  "avoids",
  "interestedIn",
  "purchased",
] as const;

/** 그룹 헤더에 쓰는 한국어 라벨 — 목록·그래프의 관계 이름 */
export const PREDICATE_LABEL: Record<PreferencePredicate, string> = {
  prefers: "선호",
  likes: "좋아함",
  avoids: "회피",
  interestedIn: "관심",
  purchased: "구매",
};

/**
 * 관계별 한 줄 설명 — 수정 창에서 선택지 아래에 붙인다.
 *
 * 라벨(PREDICATE_LABEL)은 계약 어휘 그대로 쓰되, 이름만으로는 구분이 안 되는
 * 것들이 있어 뜻을 함께 보여준다. 특히 `prefers`(비교 선호)와 `likes`(단순
 * 긍정)는 둘 다 "좋아함"으로 읽혀 설명이 없으면 고를 수가 없다.
 *
 * ⚠️ 라벨 자체를 "특히 좋아요" 같은 감상 표현으로 바꾸지 않는다 —
 * 계약 어휘를 임의로 갈면 그래프·목록의 그룹 헤더와 말이 갈리고,
 * "다른 것 대신 이것"이라는 prefers 의 뜻도 사라진다.
 */
export const PREDICATE_HINT: Record<PreferencePredicate, string> = {
  prefers: "다른 것 대신 이것",
  likes: "비교 없이 그냥 좋음",
  avoids: "피하고 싶음",
  interestedIn: "요즘 눈여겨보는 중",
  purchased: "구매한 사실",
};

/**
 * 수정 창에서 고를 수 있는 관계 — purchased 제외.
 *
 * "구매"를 선택지에 넣으면 서버가 400을 낸다. 목록에서 빼는 것으로 방어한다.
 *
 * 순서는 계약 순서(PREDICATE_ORDER)를 따른다 — 그래프·목록의 그룹 순서와
 * 같아야 "선호에 있던 걸 관심으로 옮겼다"가 자연스럽게 읽힌다.
 */
export const EDITABLE_PREDICATES: readonly PreferencePredicate[] = [
  "prefers",
  "likes",
  "avoids",
  "interestedIn",
] as const;

/**
 * 취향의 대상. **별도 nodes[] 배열이 없고 edge 안에 인라인된다.**
 *
 * 대상당 항목이 사실상 1개라 정규화 이득이 없고, 조인이 없으면 "라벨 없는 항목·
 * 항목 없는 라벨"이 원리적으로 생기지 않는다. 수정 요청(M-12)의 object와 모양이
 * 같아 항목을 그대로 요청에 재활용할 수 있다.
 */
export interface PreferenceObject {
  /** 내부 식별자 — "category:음향가전 > 블루투스 이어폰" 형태. **화면에 표시 금지** */
  nodeId: string;
  type: PreferenceNodeType;
  /** 화면에 보여줄 이름 — nodeId 대신 항상 이 값을 쓴다 */
  label: string;
}

/**
 * 취향 한 줄 — "나 → 관계 → 대상".
 *
 * 출발점(from)이 없는 것은 누락이 아니다. 항상 "나"라서 일부러 뺐다.
 * 넣으면 "여러 단계로 이어진 그래프"라는 잘못된 신호가 된다.
 */
export interface PreferenceEdge {
  /**
   * ⚠️ (관계, 대상)에서 파생되는 값이라 **수정하면 바뀐다.**
   * 수정 응답의 edge.edgeId로 클라이언트 키를 교체하지 않으면 다음
   * 수정·삭제가 전부 404다. 이 계약에서 가장 놓치기 쉬운 지점.
   *
   * 랜덤 id를 쓰지 않는 이유는 재파생 때 새 id로 부활해 삭제 표식을
   * 비켜가기 때문이다.
   */
  edgeId: string;
  predicate: PreferencePredicate;
  object: PreferenceObject;
  /** false = 구매 파생. ✏️만 비활성이고 🗑은 살아 있다 */
  editable: boolean;
  /**
   * 사용자가 고친 뒤 반대 관측이 임계 이상 쌓였다는 힌트. 상태는 바뀌지 않는다.
   *
   * **표시가 아니라 동작 트리거다** — FE가 "다시 반영할까요?"를 띄울지 판단하는
   * 값이고, 이게 없으면 AI가 사용자 수정에 이견이 있어도 알릴 방법이 사라진다.
   */
  challenged: boolean;
}

// 응답에 `lastConfirmedAt`(마지막 관측 시각)이 없다. 추가를 검토했으나
// **요청하지 않기로 했다**(2026-08-10):
//   ① 관측 시각은 사용자 언어가 아니라 시스템 언어다 — "최근 확인 7월 29일"을
//      보면 사용자는 자기 행동을 떠올리려다 못 찾는다
//   ② **오래된 게 틀린 게 아닌데** 날짜가 낡음의 신호로 읽혀 잘못된 삭제를 유도한다
// 지울지 말지는 "이게 내 취향이 맞나"로 판단하는 것이고, 그건 label이면 된다.

/**
 * 개인화 사용 여부.
 *
 * 끄면 사용·수집이 동시에 멈추고 **데이터는 보존된다**(지우는 것은 M-15로 별개).
 * 중지 시각은 저장 모델에만 있고 응답에는 오지 않는다.
 */
export interface PersonalizationState {
  enabled: boolean;
}

/** M-11 조회 응답 — 화면 전체가 이 하나로 그려진다 */
export interface ProfileGraph {
  userId: number;
  /**
   * false = 신규 회원. **오류가 아니고 HTTP 200이다.**
   * 빈 화면 안내로 처리하되 개인화 스위치와 [전체 초기화]는 그대로 보인다.
   */
  exists: boolean;
  /**
   * 좌상단 요약 문단. LLM 생성 문자열이라 HTML을 허용하지 않고 렌더한다.
   *
   * 배치(sleep-time consolidation) 산출물이라 **항상 최신이 아니다** —
   * 수정·삭제 직후에는 이전 내용이고, edges는 즉시 반영되므로 두 영역이
   * 일시적으로 어긋난다. generatedAt이 기준 시각이다.
   */
  markdown: string | null;
  generatedAt: string | null;
  /** ★ 보관 필수 — If-Match로 되돌려 보낸다. 불투명 문자열이라 파싱·비교 금지 */
  graphVersion: string;
  personalization: PersonalizationState;
  /**
   * **전량 실린다 — 서버 화면 상한이 없다.**
   *
   * 서버가 자르면 상한 밖 항목을 사용자가 보지도 지우지도 못해(전체 초기화
   * 말고는 정리 수단이 없어짐) 화면 목적과 정면으로 부딪힌다. 화면 부담은
   * FE가 일부만 렌더하고 "전체 보기"로 펼치는 방식으로 푼다.
   */
  edges: PreferenceEdge[];
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
 * predicate·object 중 최소 하나는 있어야 한다. 아무것도 안 바꾸고 저장을
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
  /**
   * ★ edgeId가 요청에 쓴 값과 다를 수 있다 — 클라이언트 키를 이걸로 교체.
   * M-11 목록 항목과 **완전히 같은 모양**이라 해당 항목을 통째로 교체하면 된다.
   */
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

/**
 * 초기화로 실제 삭제된 것 — **개수만** 온다(라벨·원문은 싣지 않는다).
 *
 * 화면 문구는 "취향 12건 · 대화 기록 143건"이면 충분하다.
 */
export interface PurgedCounts {
  edges: number;
  /** ★ 대화 기록. 사용자가 가장 놓치기 쉬운 항목이라 안내에 반드시 포함 */
  transcriptTurns: number;
}

/** M-15 초기화 응답 */
export interface ResetGraphResponse {
  userId: number;
  graphVersion: string;
  purged: PurgedCounts;
  /** 초기화해도 개인화 ON/OFF 설정은 바뀌지 않는다 — 지우기와 끄기는 별개 제어다 */
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
/** 구매 파생 항목을 수정하려 함 — 몇 번을 해도 안 된다. 재시도 금지 */
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

/**
 * 서버가 스스로 터진 경우 — 계약에 정의된 오류가 아니다.
 *
 * 400·404·409는 서버가 "무엇이 잘못됐는지" 알고 코드를 붙여 보낸 것이라
 * 그 문구를 그대로 보여주면 사용자가 다음 행동을 정할 수 있다. 5xx는 다르다.
 * INTERNAL_ERROR의 message는 "서버 내부 오류가 발생했습니다." 같은 시스템
 * 언어라 사용자가 할 수 있는 일을 알려주지 못하고, 이 화면의 다른 문구
 * ("~했어요" 체)와 말투도 어긋난다. 그래서 화면이 자기 문구로 덮는다.
 *
 * `status`를 보는 이유: 500의 `code`는 서버 사정에 따라 INTERNAL_ERROR 말고
 * 다른 값일 수 있어 상수 비교로는 새는 구멍이 생긴다. 여기서는 "서버 잘못인가"만
 * 판정하면 되므로 상태 코드가 더 정확하다.
 *
 * 2026-08-10 M-12(수정)가 모든 요청에서 500을 내던 중에 넣었다. 그건 백엔드에서
 * 고칠 일이지만, 이 방어는 그 버그와 무관하게 남는다 — 어떤 API든 5xx는 나고,
 * 그때마다 서버 문구가 화면에 새는 것을 막는 자리다.
 */
export function isServerFault(status: number | undefined): boolean {
  return status !== undefined && status >= 500;
}

// ─────────────────────────────────────────────────────────────────────────────
// 화면 조립 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 목록 뷰에서 한 그룹에 표시할 최대 항목 수. 초과분은 `+N개 더`로 접는다.
 *
 * 서버 상한(옛 200개)이 폐지되어 edges가 전량 오므로 **화면 상한은 FE 소유**다.
 * 방사형 그래프는 라벨이 겹치는 한계가 따로 있어 더 작다(graphLayout.ts).
 */
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
