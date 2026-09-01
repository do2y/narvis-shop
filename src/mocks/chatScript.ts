import "server-only";

import { MOCK_PRODUCTS } from "./fixtures";

/**
 * 채팅 목 시나리오 — SSE 프레임을 미리 짜 둔 각본.
 *
 * 왜 별도 파일인가: fixtures 는 REST 응답 모양이고 여기는 **시간 축이 있는 이벤트열**이다.
 * 프레임마다 delay 를 들고 있어 실제 스트리밍처럼 재생된다 — 한 번에 쏟으면
 * progress·token 이 같은 프레임에 뭉쳐 로딩 단계가 화면에 보이지 않는다.
 *
 * 계약(CH-2)을 그대로 따른다:
 * - 와이어는 `data: {"type":..,"data":{..}}` 한 줄. `event:` 줄은 쓰지 않는다
 * - 카드는 SSE 에 싣지 않는다(경로 B) — products.ready 의 listIds 로 CH-5 를 따로 조회한다
 * - 모든 스트림은 done 또는 error 로 끝난다
 */

export interface MockFrame {
  /** 직전 프레임과의 간격(ms) — 재생 속도를 만든다 */
  delay: number;
  type: string;
  data: unknown;
}

/** 목 목록 id — CH-5(GET /api/chat/lists/{listId}) 가 이 값을 받는다 */
export const MOCK_CHAT_LIST_ID = "mock-list-chat-0001";

/** 한 글자씩이 아니라 어절 단위로 끊는다 — 실제 토큰 스트림의 리듬에 가깝다 */
function tokens(text: string, delay = 45): MockFrame[] {
  return text.split(/(?<=\s)/).map((chunk) => ({
    delay,
    type: "token",
    data: { text: chunk },
  }));
}

/**
 * 상품 추천 시나리오 — 조건 추출 → 검색 → 근거 설명 → 카드.
 *
 * progress 를 여러 번 보내는 이유: 2026-08-06 다단계화 이후 실제로 여러 번 온다.
 * publishing 을 근거 token 뒤 products.ready 직전에 두는 것도 실제 순서다
 * (token 이 progress 를 지우지 않는다는 규칙이 화면에서 확인된다).
 */
function recommendScript(query: string): MockFrame[] {
  return [
    { delay: 250, type: "progress", data: { stage: "analyzing", message: "질문을 이해하고 있어요" } },
    { delay: 500, type: "progress", data: { stage: "mapping", message: "조건을 정리하고 있어요" } },
    {
      delay: 450,
      type: "conditions",
      data: {
        chips: [
          { field: "category", label: "카테고리 · 신발", value: "신발" },
          { field: "priceMax", label: "10만원 이하", value: 100000 },
          { field: "ratingMin", label: "별점 4.5 이상", value: 4.5 },
        ],
      },
    },
    { delay: 400, type: "progress", data: { stage: "searching", message: "상품을 찾고 있어요" } },
    { delay: 700, type: "progress", data: { stage: "reranking", message: "조건에 맞춰 순서를 고르고 있어요" } },
    ...tokens(
      `“${query}” 조건으로 골라봤어요. 가격대와 별점을 함께 보고, 러닝처럼 오래 신는 상황을 기준으로 무게가 가벼운 순으로 정렬했어요. `,
    ),
    ...tokens("아래 상품들이 특히 잘 맞아요."),
    { delay: 300, type: "progress", data: { stage: "publishing", message: "추천을 정리하고 있어요" } },
    { delay: 400, type: "products.ready", data: { listIds: [MOCK_CHAT_LIST_ID] } },
    {
      delay: 350,
      type: "suggestions",
      data: {
        chips: [
          { label: "12만원대까지 볼까요?", estCount: 9, relaxation: { field: "priceMax", value: 120000 } },
          { label: "별점 조건을 빼고 볼까요?", estCount: 14, relaxation: { field: "ratingMin", value: 0 } },
        ],
      },
    },
    { delay: 250, type: "done", data: { finishReason: "stop" } },
  ];
}

/** 조건 칩만 지운 턴 — 사용자 발화 없이 조건이 갱신되고 목록이 다시 나간다 */
function conditionRemovedScript(): MockFrame[] {
  return [
    { delay: 200, type: "progress", data: { stage: "relaxing", message: "조건을 다시 맞추고 있어요" } },
    {
      delay: 450,
      type: "conditions",
      data: {
        chips: [
          { field: "category", label: "카테고리 · 신발", value: "신발" },
          { field: "ratingMin", label: "별점 4.5 이상", value: 4.5 },
        ],
      },
    },
    { delay: 350, type: "progress", data: { stage: "searching", message: "상품을 다시 찾고 있어요" } },
    ...tokens("가격 조건을 빼고 다시 골랐어요. 선택지가 조금 더 넓어졌어요."),
    { delay: 300, type: "products.ready", data: { listIds: [MOCK_CHAT_LIST_ID] } },
    { delay: 250, type: "done", data: { finishReason: "stop" } },
  ];
}

/** 장바구니 담기 — action 이벤트로 결과가 온다(카드가 아니라 행위 알림) */
function cartScript(): MockFrame[] {
  return [
    { delay: 250, type: "progress", data: { stage: "analyzing", message: "요청을 확인하고 있어요" } },
    ...tokens("장바구니에 담았어요. 마이페이지에서 확인할 수 있어요."),
    {
      delay: 350,
      type: "action",
      data: { type: "CART_ADDED", message: "에어플로우 러닝화를 장바구니에 담았어요." },
    },
    { delay: 250, type: "done", data: { finishReason: "stop" } },
  ];
}

/** 결과 0건 — zero_result 로 끝나는 분기도 화면에 있어야 한다 */
function zeroResultScript(): MockFrame[] {
  return [
    { delay: 250, type: "progress", data: { stage: "analyzing", message: "질문을 이해하고 있어요" } },
    { delay: 500, type: "progress", data: { stage: "searching", message: "상품을 찾고 있어요" } },
    { delay: 600, type: "progress", data: { stage: "relaxing", message: "조건을 완화해 보고 있어요" } },
    ...tokens("조건에 맞는 상품을 찾지 못했어요. 조건을 조금 넓혀서 다시 찾아볼까요?"),
    {
      delay: 300,
      type: "suggestions",
      data: {
        chips: [
          { label: "가격 조건을 빼고 볼까요?", estCount: 11, relaxation: { field: "priceMax", value: 0 } },
        ],
      },
    },
    { delay: 250, type: "done", data: { finishReason: "zero_result" } },
  ];
}

/**
 * 판매자 분석 — meta 로 레인을 먼저 알리고, report 는 done{panel:"replace"} 로 커밋된다.
 * report 를 done 앞에 두는 건 계약 그대로다(도착 즉시 반영하면 실패한 턴의 리포트가 남는다).
 */
function sellerScript(): MockFrame[] {
  return [
    { delay: 200, type: "meta", data: { lane: "analysis" } },
    { delay: 400, type: "progress", data: { text: "매출 데이터를 모으고 있어요" } },
    { delay: 700, type: "progress", data: { text: "기간별로 비교하고 있어요" } },
    ...tokens(
      "최근 30일 매출은 직전 30일 대비 18% 늘었어요. 신발 카테고리가 증가분의 대부분을 만들었고, 상의는 소폭 줄었어요. ",
    ),
    ...tokens("아래 리포트에 카테고리별 추이를 정리했어요."),
    {
      delay: 400,
      type: "report",
      data: {
        title: "최근 30일 매출 분석",
        summary: "신발 카테고리가 성장을 견인했고, 상의는 재고 회전이 느려졌어요.",
        sections: [
          { heading: "카테고리별 매출", body: "신발 +32% · 가방 +9% · 상의 -4%" },
          { heading: "눈에 띄는 상품", body: "에어플로우 러닝화가 단일 상품 매출 1위예요." },
          { heading: "제안", body: "상의는 묶음 할인으로 회전율을 올려볼 수 있어요." },
        ],
      },
    },
    { delay: 300, type: "done", data: { finishReason: "stop", panel: "replace" } },
  ];
}

/**
 * 발화를 시나리오에 연결한다.
 *
 * 키워드 매칭으로 고른다 — 목이 LLM 을 흉내 낼 수는 없으니, 데모에서 자주 칠 만한
 * 몇 갈래만 갈라 준다. 어디에도 걸리지 않으면 추천 시나리오가 기본이다.
 */
export function pickChatScript(body: {
  message?: string;
  conditionActions?: unknown[];
  channel?: string;
}): MockFrame[] {
  const message = (body.message ?? "").trim();

  // 칩 제거만 있는 턴 — 사용자 말풍선이 없는 제어 신호다
  if (!message && Array.isArray(body.conditionActions) && body.conditionActions.length > 0) {
    return conditionRemovedScript();
  }

  if (/매출|분석|리포트|판매|재고/.test(message)) return sellerScript();
  if (/담아|장바구니|담아줘/.test(message)) return cartScript();
  if (/없는|이상한|xyz|zzz/.test(message)) return zeroResultScript();

  return recommendScript(message || "가벼운 러닝화");
}

/** CH-5 목록 조회 응답 — products.ready 뒤 화면이 이걸 따로 가져간다 */
export function mockChatList(listId: string) {
  const picks = [MOCK_PRODUCTS[0], MOCK_PRODUCTS[3], MOCK_PRODUCTS[1]].filter(Boolean);
  return {
    listId,
    recommendationRequestId: "mock-req-chat-0001",
    listType: "PICK_ONE",
    itemsDropped: 0,
    items: picks.map((p) => ({
      productId: p.productId,
      name: p.name,
      brandName: p.brandName,
      imageUrl: p.imageUrl,
      price: p.price,
      originalPrice: p.originalPrice,
      rating: p.rating,
      reviewCount: p.reviewCount,
      reason: p.reason,
    })),
  };
}
