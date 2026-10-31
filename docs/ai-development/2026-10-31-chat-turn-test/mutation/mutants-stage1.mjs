// 1단계(B1~B4 수정) 변이 — 기존 15개(mutants.mjs)와 **별도 집계**.
//
// 의미(무엇을 깨는가)는 회귀 테스트 작성 전에 06-fix-plan.md 에 고정했다(E1~E4).
// 문자열은 구현이 생긴 뒤에야 지정할 수 있어 구현 직후·변이 실행 전에 썼다(2026-10-31).
// 실행 결과를 본 뒤 이 파일을 고치면 02-interaction-log.md 에 사유를 남긴다.

export const TESTS = [
  "src/shared/chat/useChat.test.ts",
  "src/shared/chat/MessageList.test.tsx",
  "src/features/seller/ChatPage.test.tsx",
];

export const mutants = [
  {
    id: "E1",
    scenario: "B1",
    target: "src/shared/chat/useChat.ts",
    desc: "retry 의 스트리밍 중 가드 제거",
    find: "    if (isStreaming) return;\n    if (last?.id !== messageId",
    replace: "    if (last?.id !== messageId",
  },
  {
    id: "E2",
    scenario: "B4",
    target: "src/shared/chat/useChat.ts",
    desc: "retry 의 '대상이 마지막 말풍선인가' 확인 제거",
    find: "if (last?.id !== messageId || !last.error",
    replace: "if (!last?.error",
  },
  {
    id: "E3",
    scenario: "B",
    target: "src/shared/chat/store.ts",
    desc: "dropLastExchange 의 '마지막이 실패인가' 확인 제거",
    find: 'if (last?.role !== "assistant" || !last.error) return null;',
    replace: 'if (last?.role !== "assistant") return null;',
  },
  {
    id: "E4",
    scenario: "MessageList",
    target: "src/shared/chat/MessageList.tsx",
    desc: "재시도 버튼을 마지막 말풍선으로 제한하지 않음",
    find: "{isLast && msg.retryable !== false && (",
    replace: "{msg.retryable !== false && (",
  },
  // --- 사후 추가 (1단계 최종 검토, 2026-10-31) ---
  // 판매자 카드 배선 테스트(ChatPage.test.tsx)를 **작성한 뒤** 그 테스트가 배선 오류를 잡는지 보려고 추가.
  // E1~E4 와 달리 테스트보다 먼저 고정한 것이 아니므로 별도로 표기한다.
  {
    id: "E5",
    scenario: "B·카드",
    target: "src/features/seller/ChatPage.tsx",
    desc: "[사후] 등록 카드 재시도가 마지막 말풍선이 아닌 대상을 넘김",
    find: "onRetry={() => lastMessage && retry(lastMessage.id)}",
    replace: 'onRetry={() => lastMessage && retry("")}',
  },
];
