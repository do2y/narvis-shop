// I-6(승인 전 새 티켓 + 승인 401 자동 재전송 금지) 변이 — 기존 M·E·G·F 와 **별도 집계**.
//
// K1~K4: 의미는 회귀 테스트 작성 전에 06-fix-plan.md 에 고정했다.
// K5·K6: 계획 외 — 개발자 승인 조건에서 나와 테스트 작성 전에 의미를 추가했다(2026-11-04).
// 문자열은 구현 뒤·실행 전에 씀.

export const TESTS = [
  "src/shared/chat/sessionCoordinator.test.ts",
  "src/shared/chat/useChat.test.ts",
  "src/features/seller/ChatPage.test.tsx",
];

const USE_CHAT = "src/shared/chat/useChat.ts";
const COORDINATOR = "src/shared/chat/sessionCoordinator.ts";

export const mutants = [
  {
    id: "K1",
    scenario: "I-6",
    target: USE_CHAT,
    desc: "승인도 캐시 티켓 경로를 씀",
    find: 'await acquireTicket(resend?.kind === "confirm")',
    replace: "await acquireTicket(false)",
  },
  {
    id: "K2",
    scenario: "I-6",
    target: USE_CHAT,
    desc: "승인 401 자동 재발급·재전송 복원",
    find: '          if (resend?.kind === "confirm") throw err;\n',
    replace: "",
  },
  {
    id: "K3",
    scenario: "I-6",
    target: USE_CHAT,
    desc: "모든 턴에 fresh 적용 (일반 발화·칩 제거도 캐시를 건너뜀)",
    find: 'await acquireTicket(resend?.kind === "confirm")',
    replace: "await acquireTicket(true)",
  },
  {
    id: "K4",
    scenario: "I-6",
    target: COORDINATOR,
    desc: "fresh 인데 락 안에서 캐시를 읽음",
    find: "const again = fresh ? null : readCache(channel);",
    replace: "const again = readCache(channel);",
  },
  // --- 계획 외 (개발자 승인 조건) ---
  {
    id: "K5",
    scenario: "I-6",
    target: COORDINATOR,
    desc: "[계획 외] fresh 인데 락 밖에서 캐시를 읽음",
    find: "const cached = fresh ? null : readCache(channel);",
    replace: "const cached = readCache(channel);",
  },
  {
    id: "K6",
    scenario: "I-6",
    target: COORDINATOR,
    desc: "[계획 외] 발급이 실패하면 캐시의 옛 티켓으로 되돌아감",
    find:
      "    const session = knownSessionId\n" +
      "      ? await reissueOrCreate(channel, knownSessionId, allowCreate)\n" +
      "      : await createSession(channel);",
    replace:
      "    const session = await (knownSessionId\n" +
      "      ? reissueOrCreate(channel, knownSessionId, allowCreate)\n" +
      "      : createSession(channel)\n" +
      "    ).catch((err) => {\n" +
      "      const old = readCache(channel);\n" +
      "      if (old) return old;\n" +
      "      throw err;\n" +
      "    });",
  },
];
