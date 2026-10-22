/**
 * 채팅 API 계약 타입 — 백엔드/LLM 스키마와 1:1. 변경 시 계약 문서와 함께 갱신.
 *
 * 한 파일(733줄)이던 것을 계약 단위로 나눴다. 가져다 쓰는 쪽은 종전처럼
 * `@/shared/types/chat` 하나만 본다 — 어느 파일에 있는지는 몰라도 된다.
 *
 * - session      채널 · 화면 맥락 · SSE 요청 body · 세션/티켓 (CH-1·CH-2)
 * - buyer        추천 카드 · 조건 칩 · 제안 칩 · 구매자 progress (CH-2·CH-5)
 * - seller       레인 · 패널 · 상품 초안(HITL) · 판매자 progress (S-4)
 * - sellerReport 분석 리포트 · 저장 보고서 (S-4 §3.2 · R-1·R-2)
 * - action       action 이벤트 10종 · 쿼리 무효화 판정 (CH-2 §action)
 * - events       SSE 이벤트 유니온 · 결과 패널 항목
 */
export * from "./session";
export * from "./buyer";
export * from "./seller";
export * from "./sellerReport";
export * from "./action";
export * from "./events";
