// A 단위(턴 소유권) 변이 — 기존 15개·1단계 E 와 **별도 집계**.
//
// G1~G6: 의미는 회귀 테스트 작성 전에 06-fix-plan.md 에 고정했다. 문자열은 구현 뒤·실행 전에 씀.
// G7~G9: 계획에 없던 방어선 — 구현하면서 생긴 확인 지점이라 함께 겨눈다(구현 뒤·실행 전 추가).
//         회귀 테스트는 이보다 먼저 작성됐지만 이 방어선들을 의식하고 쓴 것은 아니다.

export const TESTS = [
  "src/shared/chat/useChat.test.ts",
  "src/shared/chat/chatEventHandler.test.ts",
  "src/shared/chat/MessageList.test.tsx",
  "src/features/seller/ChatPage.test.tsx",
];

export const mutants = [
  {
    id: "G1",
    scenario: "A2",
    target: "src/shared/chat/store.ts",
    desc: "endTurn 이 현재 턴인지 보지 않고 무조건 정리 (finally 의 소유권 확인 제거)",
    find: "      s.activeTurnId === turnId\n        ?",
    replace: "      true\n        ?",
  },
  {
    id: "G2",
    scenario: "A1",
    target: "src/shared/chat/chatEventHandler.ts",
    desc: "카드 조회 .then 의 소유권 확인 제거",
    find: "            if (!isCurrent()) return;\n            const usable",
    replace: "            const usable",
  },
  {
    id: "G3",
    scenario: "A2",
    target: "src/shared/chat/useChat.ts",
    desc: "세션 확보 뒤 소유권 확인 제거",
    find: "        if (!isCurrent()) return;\n        setSessionId(session.sessionId);",
    replace: "        setSessionId(session.sessionId);",
  },
  {
    id: "G4",
    scenario: "A·reset",
    target: "src/shared/chat/store.ts",
    desc: "reset 이 activeTurnId 를 비우지 않음",
    find: "  reset: () => set({ ...initial }),",
    replace: "  reset: () => set((s) => ({ ...initial, activeTurnId: s.activeTurnId })),",
  },
  {
    id: "G5",
    scenario: "A",
    target: "src/shared/chat/chatEventHandler.ts",
    desc: "끝난 턴의 action 을 종류 불문하고 onAction 으로 넘김",
    find: 'e.type === "action" &&\n        (isCartMutatingAction(e.data) || isWishlistMutatingAction(e.data))',
    replace: 'e.type === "action"',
  },
  {
    id: "G6",
    scenario: "A3",
    target: "src/shared/chat/useChat.ts",
    desc: "finally 의 abortRef 정리에서 컨트롤러 일치 확인 제거",
    find: "        if (abortRef.current === controller) abortRef.current = null;\n      }\n    },",
    replace: "        abortRef.current = null;\n      }\n    },",
  },
  // --- 계획 외 (구현에서 생긴 방어선) ---
  {
    id: "G7",
    scenario: "A",
    target: "src/shared/chat/chatEventHandler.ts",
    desc: "[계획 외] 이벤트 처리 입구의 소유권 확인 제거",
    find: "    if (!isCurrent()) {\n      // 끝난 턴",
    replace: "    if (false) {\n      // 끝난 턴",
  },
  {
    id: "G8",
    scenario: "A",
    target: "src/shared/chat/useChat.ts",
    desc: "[계획 외] catch 의 소유권 확인 제거 (끝난 턴의 실패가 새 대화 말풍선에 쓰임)",
    // 재정의(2026-10-31, A 최종 검토): catch 입구가 "끝난 턴이라도 404 면 세션 캐시는 비운다"로
    // 바뀌어 원래 문자열이 사라짐. 의미(입구 확인 전체 제거)는 그대로.
    //   원문 find: "        if (!isCurrent()) return;\n        if (isAbortError(err)) {"
    find:
      "        if (!isCurrent()) {\n" +
      "          if (isNotFound(err)) clearCachedSession(channel);\n" +
      "          return;\n" +
      "        }\n",
    replace: "",
  },
  {
    id: "G9",
    scenario: "A",
    target: "src/shared/chat/useChat.ts",
    desc: "[계획 외] 401 재발급 뒤 소유권 확인 제거",
    find: "            if (!isCurrent()) return;\n            setSessionId(fresh.sessionId);",
    replace: "            setSessionId(fresh.sessionId);",
  },
  // --- 사후 추가 (A 최종 검토에서 찾은 문제의 수정분, 2026-10-31) ---
  {
    id: "G10",
    scenario: "A2",
    target: "src/shared/chat/useChat.ts",
    desc: "[사후] 끝난 턴이 알게 된 세션 만료를 공유 캐시에 반영하지 않음",
    find: "          if (isNotFound(err)) clearCachedSession(channel);\n          return;",
    replace: "          return;",
  },
];
