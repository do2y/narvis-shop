import { defineConfig, devices } from "@playwright/test";

import { API_TARGET } from "./e2e/support/apiMock";

/**
 * 실제 브라우저 통합 테스트(T2) — Vitest(jsdom, src/**)와 별개다.
 *
 * - 앱은 프로덕션 빌드(`next build` + `next start`)로 띄운다. StrictMode 를 봐야 하는
 *   시나리오만 나중에 dev 서버 프로젝트를 따로 둔다.
 *   (운영 컨테이너는 standalone `node server.js` 다. `next start` 는 standalone 설정에서
 *   경고를 내지만 같은 빌드 산출물을 쓴다 — 차이는 결과 문서에 한계로 남긴다.)
 * - 실제 백엔드·AI 서버에는 요청하지 않는다:
 *   `/api/**` 는 Next 로컬 프록시 → 테스트 백엔드(e2e/support/apiMock.ts, API_TARGET),
 *   SSE 는 테스트 전용 서버(e2e/support/sseServer.ts)가 받는다.
 *   MOCK_API 는 끈다 — 켜면 Next 내장 목이 세션 발급을 먼저 가로채 테스트가 조종할 수 없다.
 * - 포트 3000 고정(CLAUDE.md). 이미 떠 있는 서버를 재사용하지 않는다 — 다른 설정으로
 *   띄운 dev 서버에 붙으면 위의 차단이 보장되지 않는다.
 */
export default defineConfig({
  testDir: "./e2e",
  // 시나리오가 SSE 서버·세션 캐시(localStorage)를 각자 쓰므로 우선 직렬로 돌린다
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // 재시도로 불안정한 테스트를 가리지 않는다
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000/healthz",
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      MOCK_API: "",
      // 테스트 백엔드 — 테스트 사이에 꺼져 있으면 연결 거부로 끝나고 실제 백엔드로 새지 않는다
      API_PROXY_TARGET: API_TARGET,
      NEXT_PUBLIC_API_BASE_URL: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
