// 취향 프로필 API 5종 (M-11·12·13·15·16) — 노션 「개인화 마이페이지 구현」 5장 계약.
//
// M-14(되돌리기)는 폐기됐다. 번호가 빈 것이지 누락이 아니다.
//
// 회원 id를 요청 어디에도 담지 않는다 — 경로·쿼리·본문 전부. 서버가 로그인
// 세션에서만 도출한다(IDOR 방지). 그래서 함수 인자에 userId가 없다.
//
// 응답 봉투({ success, data })는 shared/api/client.ts의 인터셉터가 이미 벗긴다.
// 여기서 res.data는 곧 계약의 `data` 안쪽이다.

import { api } from "@/shared/api/client";
import {
  mockDeleteEdge,
  mockEditEdge,
  mockFetchProfileGraph,
  mockResetGraph,
  mockSetPersonalization,
} from "./mock";
import type {
  DeleteEdgeResponse,
  EditEdgeRequest,
  EditEdgeResponse,
  ProfileGraph,
  ResetGraphResponse,
  SetPersonalizationResponse,
} from "./types";

/**
 * 실 API를 쓴다(2026-08-10 LLM 배포).
 *
 * 목 파일(`mock.ts`)은 **지우지 않고 남긴다.** 번들에는 들어가지 않고
 * (모듈 상수라 false면 통째로 트리셰이킹된다) 서버로는 만들기 어려운 상태를
 * 재현하는 유일한 수단이기 때문이다 — 409 버전 충돌, 409 후 재조회에서 사라진
 * 항목, 수정 불가(구매 파생), 병합, 500, 200개 대량.
 * 전부 계약 확인 목록에 있는 항목이라 한 번 지우면 다시 만들어야 한다.
 *
 * 그 상태를 볼 때만 잠깐 true 로 바꾸고 `mock.ts`의 `MOCK_SCENARIO`를 고른다.
 */
const USE_MOCK = false;

const BASE = "/api/profile/graph";

/**
 * If-Match 헤더 — M-11 응답의 graphVersion을 **그대로** 실어 보낸다.
 *
 * graphVersion은 의미 없는 불투명 문자열이다. 파싱·크기 비교·순서 추론 금지.
 * 요청은 헤더, 응답은 본문이 정규다 — 응답 헤더의 ETag는 CORS 때문에
 * 브라우저 JS가 읽을 수 없으니 쓰지 않는다.
 */
function ifMatch(graphVersion: string) {
  return { headers: { "If-Match": graphVersion } };
}

/** M-11 조회 — 화면 진입 시 한 번. graphVersion 보관의 출발점이다 */
export async function fetchProfileGraph(): Promise<ProfileGraph> {
  if (USE_MOCK) return mockFetchProfileGraph();
  const { data } = await api.get<ProfileGraph>(BASE);
  return data;
}

/**
 * M-12 수정 — If-Match 필수.
 *
 * ★ 응답의 edge.edgeId가 요청에 쓴 값과 **다를 수 있다**(ID가 관계·대상에서
 * 파생되기 때문). 호출부는 반드시 응답 값으로 클라이언트 키를 교체해야 한다.
 */
export async function editEdge(
  edgeId: string,
  body: EditEdgeRequest,
  graphVersion: string,
): Promise<EditEdgeResponse> {
  if (USE_MOCK) return mockEditEdge(edgeId, body);
  const { data } = await api.patch<EditEdgeResponse>(
    `${BASE}/edges/${edgeId}`,
    body,
    ifMatch(graphVersion),
  );
  return data;
}

/** M-13 삭제 — If-Match 필수, body 없음. 되돌릴 수 없다 */
export async function deleteEdge(
  edgeId: string,
  graphVersion: string,
): Promise<DeleteEdgeResponse> {
  if (USE_MOCK) return mockDeleteEdge(edgeId);
  const { data } = await api.delete<DeleteEdgeResponse>(
    `${BASE}/edges/${edgeId}`,
    ifMatch(graphVersion),
  );
  return data;
}

/**
 * M-15 전체 초기화 — If-Match 필수.
 *
 * scope는 생략할 수 없다. 빈 요청 하나로 전체 삭제가 일어나지 않게 막는
 * 판별자라, 파괴 범위를 호출자가 명시적으로 이름 붙이게 하는 장치다.
 * 대화 기록까지 지워진다는 점을 확인창에서 반드시 알려야 한다.
 */
export async function resetGraph(
  graphVersion: string,
): Promise<ResetGraphResponse> {
  if (USE_MOCK) return mockResetGraph();
  const { data } = await api.post<ResetGraphResponse>(
    `${BASE}/reset`,
    { scope: "ALL" },
    ifMatch(graphVersion),
  );
  return data;
}

/**
 * M-16 개인화 ON/OFF — 5종 중 유일하게 If-Match가 **선택**이라 보내지 않는다.
 *
 * 연타를 막을 필요도 없다. 같은 값을 다시 보내도 replayed: true로 정상 200이다.
 * 끈다고 데이터가 지워지지는 않는다 — 사용·수집만 멈추고 보존된다.
 */
export async function setPersonalization(
  enabled: boolean,
): Promise<SetPersonalizationResponse> {
  if (USE_MOCK) return mockSetPersonalization(enabled);
  const { data } = await api.put<SetPersonalizationResponse>(
    "/api/profile/personalization",
    { enabled },
  );
  return data;
}
