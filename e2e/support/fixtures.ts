import { test as base } from "@playwright/test";

import { startApiMock, type ApiMock } from "./apiMock";
import { startSseServer, type SseServer } from "./sseServer";

/** playwright.config 의 baseURL 과 같아야 한다 — CORS 허용 출처 판정에 쓴다 */
export const APP_ORIGIN = "http://localhost:3000";

/**
 * 테스트마다 새 SSE 서버와 테스트 백엔드를 준다 — 테스트 간 요청 기록이 섞이지 않게.
 * 끝나면 두 기록을 첨부해, 실패 시 "무엇이 나갔는가"를 trace 와 함께 볼 수 있게 한다.
 *
 * 브라우저 요청 가로채기(page/context.route)는 쓰지 않는다 — 쓰면 Playwright 가 CORS
 * 사전 요청을 대신 응답해 교차 출처 검증이 공허해진다(apiMock.ts 주석).
 */
// 두 번째 인자를 `use` 가 아니라 `provide` 로 부른다 — react-hooks 규칙이 `use(...)` 를
// React 훅 호출로 오인해 에러를 낸다(Playwright 는 인자 이름을 가리지 않는다)
export const test = base.extend<{ sse: SseServer; api: ApiMock }>({
  sse: async ({}, provide, testInfo) => {
    const server = await startSseServer({ allowedOrigin: APP_ORIGIN });
    await provide(server);
    await testInfo.attach("sse-log.json", {
      body: JSON.stringify(
        {
          preflights: server.preflights,
          requests: server.requests,
          events: server.events,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await server.close();
  },
  api: async ({}, provide, testInfo) => {
    const mock = await startApiMock();
    await provide(mock);
    await testInfo.attach("api-log.json", {
      body: JSON.stringify(
        { calls: mock.calls, unhandled: mock.unhandled },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await mock.close();
  },
});

export { expect } from "@playwright/test";
