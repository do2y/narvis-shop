// I-3 변이 — 기존 세트와 별도 집계. 구현 뒤·실행 전에 씀(2026-11-05).
// L1~L13: 개발자 조건 7개와 구현의 방어선을 하나씩 깬다.
// L14: 모바일 화면 전환 — 동작 정책이 미결정이라 테스트로 고정하지 않았다. 생존이 예상되는 것이 아니라
//      "이 동작은 검증되지 않았다"를 기록하려고 넣는다.

export const TESTS = [
  "src/shared/chat/chatEventHandler.test.ts",
  "src/features/seller/ChatPage.test.tsx",
];

const PAGE = "src/features/seller/ChatPage.tsx";
const HANDLER = "src/shared/chat/chatEventHandler.ts";
const USE_CHAT = "src/shared/chat/useChat.ts";

export const mutants = [
  { id: "L1", scenario: "새 초안", target: PAGE, desc: "새 초안이 와도 결과 패널로 전환하지 않음",
    find: '      setPanelIntent("results");\n      setMobileView("chat");', replace: '      setMobileView("chat");' },
  { id: "L2", scenario: "청크", target: PAGE, desc: "초안이 온 턴도 done 이 패널을 정함(청크 경계 의존 복귀)",
    find: "      if (draftArrived) return;\n", replace: "" },
  { id: "L3", scenario: "청크", target: HANDLER, desc: "초안 도착을 done 에 알리지 않음",
    find: "        draftArrived = true;\n", replace: "" },
  { id: "L4", scenario: "새 초안", target: HANDLER, desc: "핸들러가 onDraft 를 부르지 않음",
    find: "        onDraft?.();\n", replace: "" },
  { id: "L5", scenario: "검토 중 전송", target: PAGE, desc: "입력창 전송이 항상 auto 로 돌림(카드 가려짐 복귀)",
    find: '      prev === "results" && reviewingDraft ? "results" : "auto",', replace: '      prev === "never" ? "results" : "auto",' },
  { id: "L6", scenario: "초안 만료", target: PAGE, desc: "초안이 없어도 results 유지(빈 결과 패널)",
    find: '      prev === "results" && reviewingDraft ? "results" : "auto",', replace: '      prev === "results" ? "results" : "auto",' },
  { id: "L7", scenario: "분석 회귀", target: PAGE, desc: "입력창 전송이 list 를 풀지 않음(스켈레톤 안 뜸)",
    find: '      prev === "results" && reviewingDraft ? "results" : "auto",', replace: "      prev,"},
  { id: "L8", scenario: "턴 수명", target: HANDLER, desc: "이 턴이 아니라 남아 있는 초안으로 판단(이전 턴이 샘)",
    find: "        onDone?.(e.data.panel, { draftArrived });",
    replace: '        onDone?.(e.data.panel, { draftArrived: useChatStore.getState().results.some((r) => r.kind === "draft") });' },
  { id: "L9", scenario: "버려진 턴", target: HANDLER, desc: "버려진 턴의 초안도 패널을 엶",
    find: "    if (!isCurrent()) {\n", replace: '    if (!isCurrent()) {\n      if (e.type === "draft") onDraft?.();\n' },
  { id: "L10", scenario: "refresh", target: PAGE, desc: "초안이 온 턴에는 목록을 다시 받지 않음",
    find: '      if (panel === "refresh") {\n        queryClient.invalidateQueries', replace: '      if (panel === "refresh" && !draftArrived) {\n        queryClient.invalidateQueries' },
  { id: "L11", scenario: "수동 닫기", target: PAGE, desc: "초안이 남아 있으면 results 변화마다 다시 엶(재렌더링으로 열림)",
    find: '  const reviewingDraft = results.some((r) => r.kind === "draft");\n',
    replace: '  const reviewingDraft = results.some((r) => r.kind === "draft");\n  useEffect(() => {\n    if (results.some((r) => r.kind === "draft")) setPanelIntent("results");\n  }, [results]);\n' },
  { id: "L12", scenario: "배선", target: USE_CHAT, desc: "useChat 이 onDraft 를 넘기지 않음",
    find: "          onDraft: () => onDraftRef.current?.(),\n", replace: "" },
  { id: "L13", scenario: "배선", target: USE_CHAT, desc: "useChat 이 초안 도착 여부를 버림",
    find: "onDoneRef.current?.(panel, turn),", replace: "onDoneRef.current?.(panel, { draftArrived: false }),"},
  { id: "L14", scenario: "모바일(미결정)", target: PAGE, desc: "새 초안 도착 때 모바일 화면을 채팅으로 돌리지 않음",
    find: '      setPanelIntent("results");\n      setMobileView("chat");', replace: '      setPanelIntent("results");' },
];
