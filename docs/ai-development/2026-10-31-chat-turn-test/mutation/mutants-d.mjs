// 개발자 라운드 D1~D8 — 기존 AI 세트(87/87)와 **별도 집계**.
// 의미는 05-review §4.1~4.3(AI가 뽑은 후보), 사전 예측은 §4.4(개발자 결정, AI와 논의)에 실행 전 고정.
// 대상 문자열은 현재 코드(e97e5f8) 기준으로 실행 직전에 씀(2026-11-09). 실행 후 수정하지 않는다.
// 테스트는 저장소 전체(src)를 돌린다 — 어느 테스트가 잡는지 미리 한정하지 않으려는 것.

export const TESTS = ["src"];

const STORE = "src/shared/chat/store.ts";
const USE_CHAT = "src/shared/chat/useChat.ts";
const ERRORS = "src/shared/chat/chatErrors.ts";

export const mutants = [
  { id: "D1", scenario: "D", target: STORE, desc: "endTurn 이 진행 문구를 비우지 않음",
    find: "? { activeTurnId: null, isStreaming: false, progress: null }", replace: "? { activeTurnId: null, isStreaming: false }" },
  { id: "D2", scenario: "D", target: USE_CHAT, desc: "승계 실패 중에도 새 세션 생성 허용",
    find: "const allowCreate = !claimFailure;", replace: "const allowCreate = true;" },
  { id: "D3", scenario: "D", target: USE_CHAT, desc: "401 재발급 결과의 sessionId 를 스토어에 쓰지 않음",
    find: "            setSessionId(fresh.sessionId);\n", replace: "" },
  { id: "D4", scenario: "D", target: USE_CHAT, desc: "StreamInterruptedError 분기 삭제(일반 실패로)",
    find: '        } else if (err instanceof StreamInterruptedError) {\n          // read 가 끝났더라도 done/error 가 없으면 정상 종료가 아니다 — 응답이\n          // 반쯤 잘려 버튼도 없이 남는 쪽이 사용자 경험상 더 나쁘다.\n          failLastAssistant("응답 연결이 중간에 끊겼어요. 다시 시도해 주세요.");\n        } else if (err instanceof StreamStartError) {',
    replace: "        } else if (err instanceof StreamStartError) {" },
  { id: "D5", scenario: "D", target: USE_CHAT, desc: "run 시작에서 이전 턴 레인을 비우지 않음",
    find: "      setLane(null);\n", replace: "" },
  { id: "D6", scenario: "D", target: USE_CHAT, desc: "send 가 화면 맥락(screen)을 body 에 싣지 않음",
    find: "          ...(screen ? { screen } : {}),\n", replace: "" },
  { id: "D7", scenario: "D", target: USE_CHAT, desc: "startNewChat 이 진행 중 스트림을 abort 하지 않음",
    find: "    }\n    abortRef.current?.abort();\n    const threadId = newThreadId(channel);", replace: "    }\n    const threadId = newThreadId(channel);" },
  { id: "D8", scenario: "D", target: ERRORS, desc: "429 를 재시도 가능으로",
    find: '        message: "요청이 많아요. 잠시 후 다시 시도해 주세요.",\n        retryable: false,', replace: '        message: "요청이 많아요. 잠시 후 다시 시도해 주세요.",\n        retryable: true,' },
];
