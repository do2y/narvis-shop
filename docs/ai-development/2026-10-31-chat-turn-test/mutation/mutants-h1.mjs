// H1 2단계(+I-4) 변이 — 기존 M·E·G 와 **별도 집계**.
//
// 의미(F1~F8)는 회귀 테스트 작성 전에 06-fix-plan.md 2단계 v3 에 고정했다.
// 문자열은 구현 뒤·실행 전에 씀(2026-10-31).
// F2(응답 중 버튼 노출)는 구현에서 canRetry 를 공유하게 되어 1단계 E1(재정의)과 **같은 코드 지점**이 됨 →
// 중복 실행하지 않고 E1 결과로 갈음한다(집계에서도 제외).

export const TESTS = [
  "src/shared/chat/useChat.test.ts",
  "src/shared/chat/MessageList.test.tsx",
  "src/features/seller/ChatPage.test.tsx",
];

export const mutants = [
  {
    id: "F1",
    scenario: "H1",
    target: "src/shared/chat/useChat.ts",
    desc: "요청 시작 표시를 하지 않음 (요청을 보낸 뒤의 실패를 보내기 전 실패로 오인)",
    find: "          requestStarted = true;\n",
    replace: "\n",
  },
  {
    id: "F3",
    scenario: "H1",
    target: "src/shared/chat/retryPolicy.ts",
    desc: "재전송 정보 형식 확인 제거 (객체면 무엇이든 재전송 정보로 받음)",
    find:
      "  if (typeof value !== \"object\" || value === null) return false;\n" +
      "  const v = value as { kind?: unknown; draftId?: unknown; actions?: unknown };",
    replace:
      "  if (typeof value !== \"object\" || value === null) return false;\n" +
      "  if (value) return true;\n" +
      "  const v = value as { kind?: unknown; draftId?: unknown; actions?: unknown };",
  },
  {
    id: "F4",
    scenario: "H1",
    target: "src/shared/chat/useChat.ts",
    desc: "실패가 아닌 턴에도 재전송 정책을 적용 (성공한 턴을 건드림)",
    find: "  if (last?.role !== \"assistant\" || !last.error) return; // 실패가 아니면(중단 포함) 할 일 없음",
    replace: "  if (last?.role !== \"assistant\") return;",
  },
  {
    id: "F5",
    scenario: "I-4·카드",
    target: "src/features/seller/ChatPage.tsx",
    desc: "판매자 카드가 canRetry 를 보지 않고 항상 다시 시도 버튼을 받음",
    find:
      "        canRetry(messages, isStreaming, lastMessage?.id)\n" +
      "          ? () => retry(lastMessage.id)\n" +
      "          : undefined",
    replace: "        () => lastMessage && retry(lastMessage.id)",
  },
  {
    id: "F6",
    scenario: "H1",
    target: "src/shared/chat/retryPolicy.ts",
    desc: "canRetry 가 retryable:false 를 보지 않음",
    find: "  if (!last.error || last.retryable === false) return false;",
    replace: "  if (!last.error) return false;",
  },
  {
    id: "F7",
    scenario: "H1",
    target: "src/shared/chat/useChat.ts",
    desc: "칩 제거 재전송 정보를 retryable:false 실패에도 기록",
    find: "  if (last.retryable !== false) setLastResend(resend);",
    replace: "  setLastResend(resend);",
  },
  {
    id: "F8",
    scenario: "H1",
    target: "src/shared/chat/useChat.ts",
    desc: "판매자 승인이 요청을 보낸 뒤 실패해도 재전송 허용",
    find: "  if (resend.kind === \"confirm\" && requestStarted) {",
    replace: "  if (false) {",
  },
  // --- 사후 추가 (H1 커밋 전 재확인에서 찾은 회귀의 수정분, 2026-10-31) ---
  {
    id: "F9",
    scenario: "H1·A",
    target: "src/shared/chat/useChat.ts",
    desc: "[사후] 정상 종료 경로의 재전송 정책이 현재 턴인지 보지 않음",
    find: "        if (resend && isCurrent()) settleResend(resend, requestStarted);",
    replace: "        if (resend) settleResend(resend, requestStarted);",
  },
];
