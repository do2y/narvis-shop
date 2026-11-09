// 변이 정의 — useChat.test.ts 작성 **전에** 고정함(2026-10-31).
// 잡히는 변이만 고르는 편향을 막기 위해, 이 파일은 테스트를 본 뒤 고치지 않는다.
// 바꾼다면 02-interaction-log.md 에 사유를 남긴다.
//
// 각 변이는 대상 파일의 문자열 1곳을 치환한다. find 는 파일에 정확히 1회 있어야 한다
// (run-mutants.mjs 가 검사 — 0회·2회 이상이면 그 변이는 "무효"로 기록하고 실행하지 않는다).

export const TARGET = "src/shared/chat/useChat.ts";

export const mutants = [
  {
    id: "M1",
    scenario: "R1",
    desc: "스트리밍 중 재진입 가드 제거",
    find: "      if (useChatStore.getState().isStreaming) return;\n",
    replace: "\n",
  },
  {
    id: "M2",
    scenario: "R2",
    desc: "시작 전 401 재시도 제거",
    find: "if (err instanceof StreamStartError && err.status === 401) {",
    replace: "if (err instanceof StreamStartError && err.status === 401 && false) {",
  },
  {
    id: "M3",
    scenario: "R2",
    desc: "재발급은 하되 기존 티켓으로 재시도",
    find: "              fresh.llmSseUrl,\n              fresh.streamTicket,",
    replace: "              session.llmSseUrl,\n              session.streamTicket,",
  },
  {
    id: "M4",
    scenario: "R3",
    desc: "403 에도 티켓 재발급·재시도",
    find: "if (err instanceof StreamStartError && err.status === 401) {",
    replace:
      "if (err instanceof StreamStartError && (err.status === 401 || err.status === 403)) {",
  },
  {
    id: "M5",
    scenario: "C3'",
    desc: "스트림 404 가 만료 분기를 건너뜀 (catch 에서 StreamStartError 분기를 앞세운 것과 같은 효과)",
    find: "} else if (isNotFound(err)) {",
    replace: "} else if (isNotFound(err) && !(err instanceof StreamStartError)) {",
  },
  {
    id: "M6",
    scenario: "C1",
    desc: "abort 판정 분기 제거 (중단이 일반 실패로 떨어짐)",
    find: "        if (isAbortError(err)) {",
    replace: "        if (false) {",
  },
  {
    id: "M7",
    scenario: "C3",
    desc: "404 만료 시 세션 캐시를 비우지 않음",
    find: "          clearCachedSession(channel);\n",
    replace: "\n",
  },
  {
    id: "M8",
    scenario: "C2",
    desc: "승계 대기 실패에 재시도 버튼 노출",
    find: "            { retryable: false },",
    replace: "            { retryable: true },",
  },
  {
    id: "M9",
    scenario: "R4",
    desc: "products.ready 카드 조회를 기다리지 않고 턴 종료",
    find: "        await turn.settle();\n",
    replace: "\n",
  },
  {
    id: "M10",
    scenario: "F",
    desc: "finally 에서 스트리밍 상태를 풀지 않음",
    // 재정의(2026-10-31, A 단위): finally 의 setStreaming(false)·setProgress(null) 이
    // endTurn(turnId) 하나로 바뀌어 원래 문자열이 사라짐(5차까지는 아래 원문으로 실행).
    //   원문 find: "        setStreaming(false);\n        setProgress(null);\n        abortRef.current = null;"
    // 의미(턴이 끝나도 스트리밍 상태가 풀리지 않음)는 그대로 두고 대상만 옮김.
    find: "        endTurn(turnId);\n",
    replace: "\n",
  },
  {
    id: "M11",
    scenario: "S1",
    desc: "message·conditionActions 가 둘 다 빈 요청을 막지 않음",
    find: "      if (!trimmed && !conditionActions?.length) return;\n",
    replace: "\n",
  },
  {
    id: "M12",
    scenario: "S2",
    desc: "칩 제거 턴에도 search 수집",
    find: "      if (trimmed && !conditionActions?.length) {",
    replace: "      if (true) {",
  },
  {
    id: "M13",
    scenario: "S3",
    desc: "재시도에서 이미지 누락",
    find: "      send(dropped.text, undefined, { imageUrls: dropped.imageUrls });",
    replace: "      send(dropped.text);",
  },
  {
    id: "M14",
    scenario: "N1",
    desc: "새 대화에서 대화 저장소를 비우지 않음",
    find: "    clearChat();\n",
    replace: "\n",
  },
  {
    id: "M15",
    scenario: "U1",
    desc: "언마운트 abort 를 한 틱 미루지 않고 즉시 실행",
    find:
      "      abortTimerRef.current = setTimeout(() => {\n" +
      "        abortTimerRef.current = null;\n" +
      "        controller.abort();\n" +
      "        if (abortRef.current === controller) abortRef.current = null;\n" +
      "      }, 0);",
    replace:
      "      controller.abort();\n" +
      "      if (abortRef.current === controller) abortRef.current = null;",
  },
];
