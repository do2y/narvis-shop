// 취향 프로필 목 데이터 — 확정 계약(2026-08-09) 모양 그대로.
//
// API는 확정됐지만 dev 배포 전이라 목으로 화면을 만든다. 실 API 전환은 api.ts의
// USE_MOCK을 false로 바꾸면 끝난다. 이 파일은 그대로 두어 개발 중 시나리오 확인에
// 계속 쓴다.
//
// 계약 정본의 "반드시 확인할 시나리오" 13개를 재현할 수 있게 구성했다.

import { ApiError } from "@/shared/api/client";
import type {
  DeleteEdgeResponse,
  EditEdgeRequest,
  EditEdgeResponse,
  PreferenceEdge,
  PreferenceObject,
  ProfileGraph,
  ResetGraphResponse,
  SetPersonalizationResponse,
} from "./types";
import {
  PROFILE_EDGE_NOT_EDITABLE,
  PROFILE_EDGE_NOT_FOUND,
  PROFILE_VERSION_CONFLICT,
} from "./types";

/**
 * 개발 중 확인할 시나리오. `MOCK_SCENARIO`를 바꿔가며 화면을 본다.
 *
 * URL 쿼리로 전환하지 않는 이유: 프로덕션 번들에 파싱 코드가 남지 않게 하려는 것이다.
 * 모듈 상수라 USE_MOCK을 끄면 이 파일 전체가 트리셰이킹 대상이 된다.
 */
export type MockScenario =
  | "normal" // 정상
  | "empty" // exists: false (신규 회원)
  | "emptyEdges" // exists: true 인데 edges: []
  | "personalizationOff" // 개인화 꺼짐 — 편집은 그대로 동작해야 함
  | "many" // 대량(200) — 그래프 상한·`+N개 더`·전체 보기 확인
  | "conflict" // 수정·삭제·초기화가 409 VERSION_CONFLICT
  | "notEditable" // 수정이 409 NOT_EDITABLE
  | "merged" // 수정 응답 merged: true
  | "deletedElsewhere" // 삭제 409 → 재조회 시 edgeId 없음 (재시도 중단 확인)
  | "error"; // M-11 자체가 500

/** ⚠️ 개발 중 여기만 바꾼다 */
export const MOCK_SCENARIO: MockScenario = "normal";

/** 목 응답 지연(ms) — 스켈레톤이 실제로 보이는지 확인하려면 0보다 커야 한다 */
const MOCK_LATENCY = 400;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(value), MOCK_LATENCY),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 픽스처
// ─────────────────────────────────────────────────────────────────────────────

/** 대상 풀 — 확정 계약에서는 nodes[] 배열이 없고 edge 안에 인라인된다 */
const OBJECTS = {
  priceBand: {
    nodeId: "priceBand:30000-50000",
    type: "priceBand",
    label: "3~5만원대",
  },
  anc: {
    nodeId: "attribute:노이즈캔슬링",
    type: "attribute",
    label: "노이즈캔슬링",
  },
  wireless: { nodeId: "attribute:무선", type: "attribute", label: "무선" },
  sony: { nodeId: "brand:소니", type: "brand", label: "소니" },
  earbuds: {
    nodeId: "category:음향가전 > 블루투스 이어폰",
    type: "category",
    label: "블루투스 이어폰",
  },
  gloss: { nodeId: "attribute:광택", type: "attribute", label: "광택" },
  matteBlack: {
    nodeId: "attribute:무광 블랙",
    type: "attribute",
    label: "무광 블랙",
  },
  rating: {
    nodeId: "ratingBand:4.5+",
    type: "ratingBand",
    label: "평점 4.5 이상",
  },
  commute: { nodeId: "situation:출퇴근", type: "situation", label: "출퇴근" },
  apple: { nodeId: "brand:애플", type: "brand", label: "애플" },
  xm5: { nodeId: "product:p-1024", type: "product", label: "WH-1000XM5" },
} satisfies Record<string, PreferenceObject>;

const OBJECT_POOL = Object.values(OBJECTS);

/**
 * edge 픽스처 헬퍼 — 기본값이 "대화에서 파악한 평범한 항목"이고,
 * 각 시나리오는 필요한 필드만 덮어쓴다.
 */
function edge(
  edgeId: string,
  object: PreferenceObject,
  predicate: PreferenceEdge["predicate"],
  overrides: Partial<PreferenceEdge> = {},
): PreferenceEdge {
  return {
    edgeId,
    predicate,
    object,
    editable: true,
    challenged: false,
    ...overrides,
  };
}

/**
 * 정상 시나리오의 edges.
 *
 * 화면에서 갈라져야 하는 상태를 섞었다 — challenged, editable: false,
 * 그리고 서버 정렬(predicate 순 → 최근 확인 내림차순)을 흉내 낸 순서.
 *
 * avoids·purchased는 **의도적으로 비워 둔다.** 이 관계를 만드는 경로가 아직
 * 없어서 실제로도 항상 빈 배열로 온다.
 */
const NORMAL_EDGES: PreferenceEdge[] = [
  edge("e_2f80d1aa63b74c19", OBJECTS.priceBand, "prefers"),
  edge("e_7b1c9a04e5f2438d", OBJECTS.anc, "prefers", { challenged: true }),
  edge("e_a3f5029c81d64e77", OBJECTS.wireless, "prefers"),
  edge("e_c81d0b7742ae4f30", OBJECTS.sony, "prefers"),
  edge("e_5d92e4c03b184a6b", OBJECTS.earbuds, "prefers"),
  edge("e_1e47ab02d95c4f38", OBJECTS.rating, "prefers"),
  edge("e_9a02c5f81b7d4e63", OBJECTS.gloss, "likes"),
  edge("e_4c7f1e93d0a24b85", OBJECTS.matteBlack, "likes"),
  edge("e_6b3d80af52c14970", OBJECTS.commute, "interestedIn"),
  // editable: false = 구매 파생. ✏️ 비활성 / 🗑 활성을 확인하는 항목이다.
  edge("e_8f14c2e670bd4a19", OBJECTS.xm5, "interestedIn", { editable: false }),
];

const MARKDOWN = `# 취향 요약

**3~5만원대 무선 이어폰**을 선호하시고, 노이즈캔슬링을 중요하게 보세요.

- 소니 제품을 선호로 등록하셨어요
- 출퇴근 상황에서 쓸 제품을 최근 찾아보셨어요
- 무광 블랙 같은 차분한 마감을 좋아하세요`;

function baseGraph(): ProfileGraph {
  return {
    userId: 123,
    exists: true,
    markdown: MARKDOWN,
    generatedAt: "2026-08-04T21:10:00Z",
    graphVersion: "g42",
    personalization: { enabled: true },
    edges: NORMAL_EDGES,
  };
}

/**
 * 대량 시나리오 — 서버 상한이 폐지되어 edges가 전량 온다.
 *
 * 방사형의 관계당 표시 상한과 `+N개 더`, [전체 보기] 전환이 실제로 동작하는지,
 * 라벨이 겹쳐 화면이 뭉개지지 않는지 확인한다.
 */
function manyGraph(): ProfileGraph {
  const many: PreferenceEdge[] = Array.from({ length: 200 }, (_, i) =>
    edge(
      `e_bulk${String(i).padStart(4, "0")}`,
      OBJECT_POOL[i % OBJECT_POOL.length],
      "prefers",
    ),
  );
  return { ...baseGraph(), edges: many };
}

/** 시나리오별 M-11 응답 */
function scenarioGraph(): ProfileGraph {
  switch (MOCK_SCENARIO) {
    case "empty":
      return {
        ...baseGraph(),
        exists: false,
        markdown: null,
        generatedAt: null,
        edges: [],
      };
    case "emptyEdges":
      return { ...baseGraph(), edges: [] };
    case "personalizationOff":
      return { ...baseGraph(), personalization: { enabled: false } };
    case "many":
      return manyGraph();
    case "deletedElsewhere":
      // 삭제 자동 재시도의 중단 조건 확인용 — 첫 조회에는 있지만
      // 409 후 재조회에서는 사라진다(mockFetchProfileGraph의 분기).
      return baseGraph();
    default:
      return baseGraph();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 목 핸들러
// ─────────────────────────────────────────────────────────────────────────────

/** 409 재시도를 확인하려면 재조회 때 상태가 달라져야 해서 호출 횟수를 센다 */
let graphFetchCount = 0;

/** 뮤테이션이 한 번 성공하면 다음부터는 충돌을 내지 않는다(무한 409 방지) */
let conflictConsumed = false;

function nextVersion(): string {
  return `g${43 + graphFetchCount}`;
}

export function mockFetchProfileGraph(): Promise<ProfileGraph> {
  if (MOCK_SCENARIO === "error") {
    return Promise.reject(
      new ApiError(
        { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해 주세요." },
        500,
      ),
    );
  }

  graphFetchCount += 1;
  const graph = scenarioGraph();

  // 삭제 재시도 중단 조건: 재조회했을 때 그 edgeId가 없으면 밀어붙이지 않는다.
  // 두 번째 조회부터 대상 항목을 빼서 그 경로를 재현한다.
  if (MOCK_SCENARIO === "deletedElsewhere" && graphFetchCount > 1) {
    return delay({
      ...graph,
      graphVersion: nextVersion(),
      edges: graph.edges.filter((e) => e.edgeId !== "e_7b1c9a04e5f2438d"),
    });
  }

  return delay(graph);
}

function conflictError(): ApiError {
  return new ApiError(
    {
      code: PROFILE_VERSION_CONFLICT,
      message: "그 사이 취향이 업데이트됐어요.",
      detail: { graphVersion: nextVersion() },
    },
    409,
  );
}

export function mockEditEdge(
  edgeId: string,
  body: EditEdgeRequest,
): Promise<EditEdgeResponse> {
  if (MOCK_SCENARIO === "notEditable") {
    return Promise.reject(
      new ApiError(
        {
          code: PROFILE_EDGE_NOT_EDITABLE,
          message: "구매 기록에서 만들어진 항목은 수정할 수 없어요.",
        },
        409,
      ),
    );
  }
  if (MOCK_SCENARIO === "conflict" && !conflictConsumed) {
    conflictConsumed = true;
    return Promise.reject(conflictError());
  }

  const source =
    NORMAL_EDGES.find((e) => e.edgeId === edgeId) ?? NORMAL_EDGES[0];

  // 요청이 nodeId를 실었으면 그 대상으로, type+label이면 서버가 정규화한 셈 치고
  // 새 nodeId를 만든다. 둘 다 없으면 대상은 그대로다.
  let nextObject = source.object;
  if (body.object) {
    const requested = body.object;
    if ("nodeId" in requested) {
      nextObject =
        OBJECT_POOL.find((o) => o.nodeId === requested.nodeId) ?? source.object;
    } else {
      nextObject = {
        nodeId: `${requested.type}:${requested.label}`,
        type: requested.type,
        label: requested.label,
      };
    }
  }

  return delay({
    userId: 123,
    graphVersion: nextVersion(),
    edge: {
      ...source,
      // ★ 수정하면 edgeId가 바뀐다 — 클라이언트 키 교체를 확인하기 위해
      // 목에서도 반드시 다른 값을 돌려준다.
      edgeId: `e_${Math.random().toString(16).slice(2, 18)}`,
      object: nextObject,
      predicate: body.predicate ?? source.predicate,
    },
    merged: MOCK_SCENARIO === "merged",
    replayed: false,
  });
}

export function mockDeleteEdge(edgeId: string): Promise<DeleteEdgeResponse> {
  if (
    (MOCK_SCENARIO === "conflict" || MOCK_SCENARIO === "deletedElsewhere") &&
    !conflictConsumed
  ) {
    conflictConsumed = true;
    return Promise.reject(conflictError());
  }

  // 재조회에서 사라진 항목을 그래도 지우려 하면 404 — 화면이 중단 경로를 타는지 확인
  if (MOCK_SCENARIO === "deletedElsewhere") {
    return Promise.reject(
      new ApiError(
        {
          code: PROFILE_EDGE_NOT_FOUND,
          message: "이미 삭제되었거나 변경된 항목이에요.",
        },
        404,
      ),
    );
  }

  return delay({
    userId: 123,
    graphVersion: nextVersion(),
    edgeId,
    replayed: false,
  });
}

export function mockResetGraph(): Promise<ResetGraphResponse> {
  if (MOCK_SCENARIO === "conflict" && !conflictConsumed) {
    conflictConsumed = true;
    return Promise.reject(conflictError());
  }

  return delay({
    userId: 123,
    graphVersion: nextVersion(),
    // 확정 계약은 개수 둘뿐이다 — nodes·facts는 싣지 않는다.
    purged: { edges: 12, transcriptTurns: 143 },
    // 초기화해도 개인화 설정은 바뀌지 않는다
    personalization: { enabled: true },
    replayed: false,
  });
}

export function mockSetPersonalization(
  enabled: boolean,
): Promise<SetPersonalizationResponse> {
  return delay({
    userId: 123,
    graphVersion: nextVersion(),
    personalization: { enabled },
    replayed: false,
  });
}
