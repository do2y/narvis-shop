import { chatList, ok, useGuestShoppingDefaults } from "./support/apiMock";
import { APP_ORIGIN, expect, test } from "./support/fixtures";

/**
 * 하네스 스모크 — T2 시나리오의 전제(목 경계)가 실제 브라우저에서 성립하는지 확인한다.
 * 결함 탐지용이 아니다. 이 테스트가 실패하면 이후 시나리오의 결과는 믿을 수 없다.
 *
 * 확인하는 것:
 * 1. 교차 출처 SSE — 브라우저가 사전 요청을 보내고, 허용 응답을 받은 뒤에만 POST 가 나간다
 * 2. 스트리밍 — 첫 토큰이 `done` 전에 화면에 보인다(테스트가 스트림 중간 상태를 붙잡을 수 있다)
 * 3. 경로 B — products.ready → CH-5 조회 → 카드 표시
 * 4. 턴 종료 — 입력창이 다시 열리고, 요청은 각각 1회
 */
test("구매자 전송 → 교차 출처 SSE → 상품 카드 표시", async ({
  page,
  sse,
  api,
}) => {
  useGuestShoppingDefaults(api, { llmSseUrl: sse.streamUrl });
  const listId = "e2e-list-1";
  const cardNames = ["E2E 러닝화 A", "E2E 러닝화 B", "E2E 러닝화 C"];
  api.on("GET", /^\/api\/chat\/lists\/[^/]+$/, () =>
    ok(chatList(listId, cardNames)),
  );

  await page.goto("/chat");

  const form = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "전송" }) });
  const input = form.getByRole("textbox");
  await input.fill("러닝화 추천해줘");
  await form.getByRole("button", { name: "전송" }).click();

  // --- 1. 교차 출처 요청 ---
  // 도착을 단언으로 기다린다 — nextStream() 만 기다리면 CORS 가 막혀 요청이 안 올 때
  // 테스트 타임아웃으로 끝나, "무엇이 틀렸는지"를 말하지 못한다(음성 대조 N1에서 확인)
  await expect
    .poll(() => sse.preflights.length, { message: "SSE 사전 요청 도착" })
    .toBe(1);
  await expect
    .poll(() => sse.requests.length, {
      message: "사전 요청 허용 뒤 SSE POST 도착",
    })
    .toBe(1);
  const stream = await sse.nextStream();
  const body = stream.request.body as Record<string, unknown>;
  expect(body).toMatchObject({
    sessionId: "e2e-session-1",
    message: "러닝화 추천해줘",
  });
  expect(typeof body.threadId).toBe("string");
  expect(stream.request.headers.authorization).toBe("Bearer e2e-ticket-1");
  expect(stream.request.headers.origin).toBe(APP_ORIGIN);

  // 사전 요청이 Authorization 때문에 생긴 것이어야 한다
  const preflight = sse.preflights[0].headers;
  expect(preflight.origin).toBe(APP_ORIGIN);
  expect(preflight["access-control-request-method"]).toBe("POST");
  expect(preflight["access-control-request-headers"]).toContain(
    "authorization",
  );

  // --- 2. 스트리밍 중간 상태 ---
  stream.open();
  stream.send("token", { text: "조건에 맞는 러닝화를 " });
  await expect(page.getByText("조건에 맞는 러닝화를")).toBeVisible();
  // 아직 done 전이다 — 응답 중이면 전송이 잠긴다. 빈 입력도 버튼을 잠그므로
  // 글자를 먼저 넣어 "응답 중"만이 잠금의 이유가 되게 한다(입력 자체는 응답 중에도 가능하다)
  await input.fill("다음 질문");
  await expect(form.getByRole("button", { name: "전송" })).toBeDisabled();

  // --- 3. 경로 B ---
  stream.send("token", { text: "세 켤레 골랐어요." });
  const listRequest = page.waitForRequest(
    (r) => new URL(r.url()).pathname === `/api/chat/lists/${listId}`,
  );
  stream.send("products.ready", { listIds: [listId] });
  await listRequest;
  stream.send("done", { finishReason: "stop" });
  stream.end();

  for (const name of cardNames) {
    await expect(
      page.getByRole("link", { name: `${name} 상세 보기 (새 탭)` }),
    ).toBeVisible();
  }
  await expect(
    page.getByText("조건에 맞는 러닝화를 세 켤레 골랐어요."),
  ).toBeVisible();

  // --- 4. 턴 종료 — 같은 입력 그대로 전송이 풀린다 ---
  await expect(input).toHaveValue("다음 질문");
  await expect(form.getByRole("button", { name: "전송" })).toBeEnabled();

  expect(sse.requests).toHaveLength(1);
  const count = (path: string) =>
    api.calls.filter((c) => c.path === path).length;
  expect(count("/api/chat/sessions")).toBe(1);
  expect(count(`/api/chat/lists/${listId}`)).toBe(1);
  expect(api.unhandled).toEqual([]);
});
