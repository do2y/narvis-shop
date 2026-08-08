// 취향 프로필 목 데이터 — API 5종이 BE 초안이라(노션 12장) 화면을 먼저 만들기 위한 것.
//
// 실 API 전환은 api.ts의 USE_MOCK을 false로 바꾸면 끝난다. 이 파일은 그대로 두어
// 개발 중 시나리오 확인에 계속 쓴다(계약이 바뀌면 픽스처도 함께 갱신).
//
// 노션 9장의 "반드시 확인할 시나리오" 12개를 전부 재현할 수 있게 구성했다.

import { ApiError } from "@/shared/api/client";
import type {
  DeleteEdgeResponse,
  EditEdgeRequest,
  EditEdgeResponse,
  PreferenceEdge,
  PreferenceNode,
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
  | "normal" // 정상 — 취향 24/8/5, 회피·구매 0
  | "empty" // exists: false (신규 회원)
  | "emptyEdges" // exists: true 인데 edges: []
  | "personalizationOff" // 개인화 꺼짐 — 편집은 그대로 동작해야 함
  | "truncated" // 200개 + truncated: true
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
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY));
}

// ─────────────────────────────────────────────────────────────────────────────
// 픽스처
// ─────────────────────────────────────────────────────────────────────────────

const NODES: PreferenceNode[] = [
  { nodeId: "priceBand:30000-50000", type: "priceBand", label: "3~5만원대", verified: true },
  { nodeId: "attribute:노이즈캔슬링", type: "attribute", label: "노이즈캔슬링", verified: true },
  { nodeId: "attribute:무선", type: "attribute", label: "무선", verified: true },
  { nodeId: "brand:소니", type: "brand", label: "소니", verified: true },
  { nodeId: "category:음향가전 > 블루투스 이어폰", type: "category", label: "블루투스 이어폰", verified: true },
  { nodeId: "attribute:광택", type: "attribute", label: "광택", verified: false },
  { nodeId: "attribute:무광 블랙", type: "attribute", label: "무광 블랙", verified: true },
  { nodeId: "ratingBand:4.5+", type: "ratingBand", label: "평점 4.5 이상", verified: true },
  { nodeId: "situation:출퇴근", type: "situation", label: "출퇴근", verified: true },
  { nodeId: "brand:애플", type: "brand", label: "애플", verified: true },
  { nodeId: "product:p-1024", type: "product", label: "WH-1000XM5", verified: true },
];

/**
 * edge 픽스처를 만드는 헬퍼 — 기본값이 "대화에서 파악한 평범한 항목"이고,
 * 각 시나리오는 필요한 필드만 덮어쓴다.
 */
function edge(
  edgeId: string,
  to: string,
  predicate: PreferenceEdge["predicate"],
  overrides: Partial<PreferenceEdge> = {},
): PreferenceEdge {
  return {
    edgeId,
    to,
    predicate,
    source: "conversation",
    origin: "machine",
    confidence: "MEDIUM",
    firstSeenAt: "2026-07-11T08:00:00Z",
    lastConfirmedAt: "2026-08-04T13:40:00Z",
    editable: true,
    challenged: false,
    derivedFromSensitive: false,
    ...overrides,
  };
}

/**
 * 정상 시나리오의 edges.
 *
 * 화면에서 갈라져야 하는 상태를 골고루 섞었다 — 확신도 3단계, origin: user,
 * verified: false, challenged, editable: false, derivedFromSensitive.
 * (derivedFromSensitive는 **일반 항목과 똑같이 그려지는지** 확인용이다)
 */
const NORMAL_EDGES: PreferenceEdge[] = [
  edge("e_2f80d1aa63b74c19", "priceBand:30000-50000", "prefers", {
    confidence: "HIGH",
  }),
  edge("e_7b1c9a04e5f2438d", "attribute:노이즈캔슬링", "prefers", {
    confidence: "HIGH",
    challenged: true,
  }),
  edge("e_a3f5029c81d64e77", "attribute:무선", "prefers"),
  edge("e_c81d0b7742ae4f30", "brand:소니", "prefers", {
    origin: "user",
    source: "user",
    confidence: "HIGH",
  }),
  edge("e_5d92e4c03b184a6b", "category:음향가전 > 블루투스 이어폰", "prefers", {
    confidence: "LOW",
  }),
  edge("e_1e47ab02d95c4f38", "ratingBand:4.5+", "prefers", { confidence: "LOW" }),
  edge("e_9a02c5f81b7d4e63", "attribute:광택", "likes"),
  edge("e_4c7f1e93d0a24b85", "attribute:무광 블랙", "likes", {
    derivedFromSensitive: true,
  }),
  edge("e_6b3d80af52c14970", "situation:출퇴근", "interestedIn", {
    confidence: "LOW",
  }),
  edge("e_8f14c2e670bd4a19", "product:p-1024", "interestedIn", {
    editable: false,
    source: "purchase",
    confidence: "HIGH",
  }),
];

const MARKDOWN = `# 취향 요약

**3~5만원대 무선 이어폰**을 선호하시고, 노이즈캔슬링을 중요하게 보세요.

- 소니 제품을 직접 선호로 등록하셨어요
- 출퇴근 상황에서 쓸 제품을 최근 찾아보셨어요
- 무광 블랙 같은 차분한 마감을 좋아하세요`;

function baseGraph(): ProfileGraph {
  return {
    userId: 123,
    exists: true,
    markdown: MARKDOWN,
    generatedAt: "2026-08-04T21:10:00Z",
    graphVersion: "g42",
    personalization: { enabled: true, disabledAt: null },
    usagePolicy: { orderOnly: true, filterSafe: false },
    nodes: NODES,
    edges: NORMAL_EDGES,
    unprojectedCount: 0,
    truncated: false,
  };
}

/**
 * 200개 상한 시나리오 — 그룹당 12개 제한과 `+N개 더`가 실제로 동작하는지,
 * 그리고 라벨이 겹쳐 화면이 뭉개지지 않는지 확인한다.
 */
function truncatedGraph(): ProfileGraph {
  const many: PreferenceEdge[] = Array.from({ length: 200 }, (_, i) =>
    edge(`e_bulk${String(i).padStart(4, "0")}`, NODES[i % NODES.length].nodeId, "prefers"),
  );
  return { ...baseGraph(), edges: many, truncated: true };
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
        nodes: [],
        edges: [],
      };
    case "emptyEdges":
      return { ...baseGraph(), edges: [] };
    case "personalizationOff":
      return {
        ...baseGraph(),
        personalization: { enabled: false, disabledAt: "2026-08-05T02:40:00Z" },
      };
    case "truncated":
      return truncatedGraph();
    case "deletedElsewhere":
      // 삭제 자동 재시도의 중단 조건 확인용 — 첫 조회에는 있지만
      // 409 후 재조회에서는 사라진다(fetchProfileGraph의 refetch 분기).
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

  const source = NORMAL_EDGES.find((e) => e.edgeId === edgeId) ?? NORMAL_EDGES[0];
  const nextTo =
    body.object && "nodeId" in body.object ? body.object.nodeId : source.to;

  return delay({
    userId: 123,
    graphVersion: nextVersion(),
    edge: {
      ...source,
      // ★ 수정하면 edgeId가 바뀐다 — 클라이언트 키 교체를 확인하기 위해
      // 목에서도 반드시 다른 값을 돌려준다.
      edgeId: `e_${Math.random().toString(16).slice(2, 18)}`,
      to: nextTo,
      predicate: body.predicate ?? source.predicate,
      origin: "user",
      source: "user",
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
    purged: { edges: 12, nodes: 9, facts: 12, transcriptTurns: 143 },
    // 초기화해도 개인화 설정은 바뀌지 않는다
    personalization: { enabled: true, disabledAt: null },
    replayed: false,
  });
}

export function mockSetPersonalization(
  enabled: boolean,
): Promise<SetPersonalizationResponse> {
  return delay({
    userId: 123,
    graphVersion: nextVersion(),
    personalization: {
      enabled,
      disabledAt: enabled ? null : "2026-08-05T02:40:00Z",
    },
    replayed: false,
  });
}
