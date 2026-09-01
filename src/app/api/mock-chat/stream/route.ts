import type { NextRequest } from "next/server";

import { pickChatScript } from "@/mocks/chatScript";

/**
 * 목 SSE 엔드포인트 — `MOCK_API=1` 일 때 채팅 스트림을 대신 재생한다.
 *
 * 왜 별도 라우트인가: 실제 SSE 는 nginx·Next 를 타지 않고 세션 발급이 준 llmSseUrl
 * (AI 서버 절대 URL)로 streamChat 이 직접 나간다. 그래서 /api 프록시의 목이 걸리지 않는다.
 * 목 모드에서는 세션 발급이 llmSseUrl 로 **이 라우트 주소**를 내려주고, streamChat 은
 * 평소처럼 그 값을 그대로 POST 한다 — 클라이언트 코드는 한 줄도 바뀌지 않는다.
 *
 * 프레임을 한 번에 쏟지 않고 delay 만큼 띄워 보낸다. 뭉쳐 보내면 progress 단계가
 * 화면에 보이지 않고 token 도 한 덩어리로 튀어나와 스트리밍처럼 보이지 않는다.
 */

const useMock = process.env.MOCK_API === "1";

export async function POST(req: NextRequest): Promise<Response> {
  if (!useMock) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "mock disabled" } },
      { status: 404 },
    );
  }

  let body: { message?: string; conditionActions?: unknown[]; channel?: string } = {};
  try {
    body = await req.json();
  } catch {
    // 본문 없음 — 기본 시나리오로 진행한다
  }

  const frames = pickChatScript(body);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const frame of frames) {
          // 연결이 끊기면(사용자가 중단) 남은 프레임을 흘려보내지 않는다
          if (req.signal.aborted) break;
          await new Promise((r) => setTimeout(r, frame.delay));
          if (req.signal.aborted) break;

          // 와이어 포맷: data 한 줄 + 빈 줄. event: 줄은 쓰지 않는다(계약 CH-2)
          const line = `data: ${JSON.stringify({ type: frame.type, data: frame.data })}\n\n`;
          controller.enqueue(encoder.encode(line));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // 프록시가 버퍼링하면 프레임이 뭉쳐서 도착해 스트리밍이 보이지 않는다
      "X-Accel-Buffering": "no",
    },
  });
}
