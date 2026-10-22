// 화면 어휘 정본은 E-1(analytics)이고 CH-2 는 참조만 한다 — 같은 이름을 두 벌 두지 않는다.
import type { PageType } from "@/shared/analytics/types";
import type { ConditionAction } from "./buyer";

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
