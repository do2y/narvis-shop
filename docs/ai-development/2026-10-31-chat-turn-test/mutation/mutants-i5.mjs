// I-5 · I-7 변이 — 기존 M·E·G·F·K 와 **별도 집계**.
//
// J1~J12: 의미는 회귀 테스트 작성 전에 06-fix-plan.md 에 고정했다(J4·J8 은 "구현 기준"에서 재정의).
// J13~J18: 계획 외 — J13 은 테스트 전에 추가, J14~J18 은 구현에서 생긴 방어선이라 구현 뒤·실행 전에 추가.
// 문자열은 구현 뒤·실행 전에 씀(2026-11-04).

export const TESTS = [
  "src/shared/chat/useChat.test.ts",
  "src/shared/chat/chatEventHandler.test.ts",
  "src/features/seller/ChatPage.test.tsx",
];

const USE_CHAT = "src/shared/chat/useChat.ts";
const APPROVAL = "src/shared/chat/draftApproval.ts";
const HANDLER = "src/shared/chat/chatEventHandler.ts";
const STORE = "src/shared/chat/store.ts";
const DIFF = "src/features/seller/components/ProductDiffCard.tsx";
const CREATE = "src/features/seller/components/ProductCreateCard.tsx";
const WORKSPACE = "src/features/seller/components/SellerWorkspace.tsx";

export const mutants = [
  { id: "J1", scenario: "I-5", target: USE_CHAT, desc: "승인 시작에 pending 을 남기지 않음",
    find: '      if (confirmingDraftId) setDraftApproval(confirmingDraftId, "pending");\n', replace: "" },
  { id: "J2", scenario: "I-5", target: APPROVAL, desc: "요청 후 실패를 unknown 으로 남기지 않음(재승인 가능해짐)",
    find: '    if (requestStarted) finish(draftId, "unknown");\n    else useChatStore', replace: "    useChatStore" },
  { id: "J3", scenario: "I-5", target: APPROVAL, desc: "action 없는 정상 종료를 잠그지 않음",
    find: "  closeApproval(draftId);\n}\n\n/** 이 초안을 승인하면", replace: "  useChatStore.getState().setDraftApproval(draftId, undefined);\n}\n\n/** 이 초안을 승인하면" },
  { id: "J4", scenario: "I-5", target: HANDLER, desc: "승인 턴의 성공 action 을 성공(settled)으로 기록",
    find: "            closeApproval(confirmingDraftId);\n",
    replace: "            useChatStore.getState().settleDraft(confirmingDraftId, action);\n            setDraftApproval(confirmingDraftId, undefined);\n" },
  { id: "J5a", scenario: "I-5·화면", target: DIFF, desc: "수정 카드가 승인 상태를 보지 않음",
    find: ") : approval && isApprovalLocked(approval) ? (", replace: ") : approval && false ? (" },
  { id: "J5b", scenario: "I-5·카드", target: CREATE, desc: "등록 카드가 승인 상태를 보지 않음",
    find: ': isApprovalLocked(approval)\n      ? "locked"', replace: ': false\n      ? "locked"' },
  { id: "J6", scenario: "I-5·카드", target: WORKSPACE, desc: "수정 카드 잠금을 초안 상태가 아니라 마지막 말풍선 오류로 판단",
    find: "<ProductDiffCard\n                      draft={r.draft}\n                      settled={r.settled}\n                      approval={r.approval}",
    replace: "<ProductDiffCard\n                      draft={r.draft}\n                      settled={r.settled}\n                      approval={streamError ? \"unknown\" : r.approval}" },
  { id: "J7", scenario: "I-5", target: USE_CHAT, desc: "confirm 의 상태 거부 제거",
    find: "      if (result?.approval || result?.settled) return;\n", replace: "" },
  { id: "J8", scenario: "I-7", target: HANDLER, desc: "승인 턴의 결과가 승인한 초안이 아니라 첫 초안에 기록됨",
    find: "            closeApproval(confirmingDraftId);\n",
    replace: '            closeApproval(useChatStore.getState().results.flatMap((r) => (r.kind === "draft" ? [r.draft.draftId] : []))[0] ?? confirmingDraftId);\n' },
  { id: "J9", scenario: "I-7", target: HANDLER, desc: "일반 턴의 판매자 action 도 등록 초안에 기록",
    find: '        if (confirmingDraftId) {\n          if (action.type === "PRODUCT_UPDATED") {',
    replace: '        confirmingDraftId ??= useChatStore.getState().results.flatMap((r) => (r.kind === "draft" && r.draft.op === "create" ? [r.draft.draftId] : []))[0];\n        if (confirmingDraftId) {\n          if (action.type === "PRODUCT_UPDATED") {' },
  { id: "J10", scenario: "I-5·화면", target: APPROVAL, desc: "경고 대상 비교 제거 — 다른 상품에도 경고",
    find: "  return unresolved.productId === draft.productId;", replace: "  return true;" },
  { id: "J11", scenario: "I-5", target: STORE, desc: "새 대화(reset)가 미해결 기록을 지움",
    find: "  reset: () => set({ ...initial }),", replace: "  reset: () => set({ ...initial, unresolvedApprovals: [] })," },
  { id: "J12", scenario: "I-5", target: USE_CHAT, desc: "결과 action 뒤 error 를 확인 안내로 덮어씀",
    find: "failLastAssistant(hasAnswer ? last.error : CONFIRM_UNKNOWN, {", replace: "failLastAssistant(CONFIRM_UNKNOWN, {" },
  // --- 계획 외 ---
  { id: "J13", scenario: "I-5·화면", target: APPROVAL, desc: "[계획 외] 경고가 소유자를 보지 않음",
    find: "  if (unresolved.ownerId !== ownerId) return false;\n", replace: "" },
  { id: "J14", scenario: "I-5", target: USE_CHAT, desc: "[계획 외] 새 대화가 진행 중 승인을 미해결로 남기지 않음",
    find: '      if (r.kind === "draft" && r.approval === "pending") {\n        recordUnresolved(r.draft.draftId);\n      }\n', replace: "" },
  { id: "J15", scenario: "I-5", target: USE_CHAT, desc: "[계획 외] 요청 전에 멈춘 승인의 미해결 기록을 지우지 않음",
    find: "        if (confirmingDraftId && !requestStarted && !isCurrent()) {", replace: "        if (false) {" },
  { id: "J16", scenario: "I-5·화면", target: "src/features/seller/ChatPage.tsx", desc: "[계획 외] 경고 확인이 이전 기록을 지우지 않음",
    find: "    acknowledgeUnresolved(draft);\n", replace: "" },
  { id: "J17", scenario: "I-5·화면", target: DIFF, desc: "[계획 외] 수정 카드 2단계 확인 생략",
    find: "                duplicateRisk ? setAsking(true) : onConfirm(draft.draftId)", replace: "                onConfirm(draft.draftId)" },
  { id: "J18", scenario: "I-5·화면", target: CREATE, desc: "[계획 외] 등록 카드 2단계 확인 생략",
    find: "(duplicateRisk ? setAsking(true) : onConfirm(draftId))", replace: "onConfirm(draftId)" },
];
