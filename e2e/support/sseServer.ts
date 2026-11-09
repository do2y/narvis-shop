import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * 테스트 전용 SSE 서버 — AI 서버(`llmSseUrl`) 자리를 대신한다.
 *
 * 왜 Playwright `route.fulfill` 이 아닌가: fulfill 의 body 는 string|Buffer 뿐이라
 * 응답을 한 번에 내보낸다(1.65.0 types.d.ts 확인). "토큰 1개만 온 상태에서 멈춤",
 * "스트림 도중 소켓이 끊김"처럼 시간 축이 있는 장애를 만들 수 없다.
 *
 * 왜 교차 출처인가: 운영에서 SSE 는 nginx·Next 를 타지 않고 AI 서버 절대 URL 로 직접 나간다.
 * 이 서버를 앱(localhost:3000)과 다른 출처(127.0.0.1:임의 포트)에 띄워, 브라우저가
 * `Authorization` 헤더 때문에 보내는 사전 요청(preflight)까지 운영과 같은 모양으로 지나가게 한다.
 *
 * 응답은 자동으로 보내지 않는다. 요청이 도착하면 `nextStream()` 이 그 요청의 손잡이를
 * 돌려주고, 테스트가 프레임·종료·끊김을 직접 정한다 — 고정 시간 대기 없이 동기화하기 위해서다.
 */

export interface RecordedRequest {
  method: string;
  path: string;
  headers: http.IncomingHttpHeaders;
  /** POST 본문(JSON). 파싱 실패 시 원문 문자열 */
  body: unknown;
  /** 이 요청이 도착한 TCP 연결의 식별자(서버가 연결을 받은 순서, 1부터) */
  socketId: number;
  /** 그 연결에서 몇 번째 요청인가(0 = 새 연결의 첫 요청, 1 이상 = 재사용된 연결) */
  socketRequestIndex: number;
}

/**
 * 서버가 본 사건의 순서 기록 — 연결 열림·닫힘, 요청 도착, 테스트가 연결을 끊은 시점.
 * seq 는 서버 안에서 단조 증가한다(시간이 아니라 순서). 헤더 값만 보고 "새 연결"이라 단정하지
 * 않기 위해 실제 소켓 단위로 남긴다.
 */
export interface ServerEvent {
  seq: number;
  type:
    | "socket-open"
    | "socket-close"
    | "preflight"
    | "request"
    | "destroyed-by-test"
    | "idle-closed-by-test";
  socketId: number;
  detail?: Record<string, unknown>;
}

export interface SseStream {
  readonly request: RecordedRequest;
  /** 200 + text/event-stream 헤더를 보낸다. 프레임을 보내기 전에 한 번 부른다 */
  open(): void;
  /** 계약 와이어 형식(`data: {"type","data"}` + 빈 줄)으로 프레임 1개를 보낸다 */
  send(type: string, data: unknown): void;
  /** 정상 종료(청크 전송 종결) */
  end(): void;
  /** 소켓을 강제로 끊는다 — 종결 청크 없이 연결이 사라지는 장애 */
  destroy(): void;
  /** 스트림 시작 전 거부(계약 CH-2 §실패 응답의 envelope) */
  reject(status: number, code: string): void;
  /** 브라우저가 연결을 먼저 끊었는가(abort) */
  readonly clientClosed: boolean;
  /** 응답 헤더를 이미 보냈는가 — "헤더 전에 끊김"과 "스트림 도중 끊김"을 구분하는 근거 */
  readonly headersSent: boolean;
}

export interface SseServerOptions {
  /**
   * CORS 를 허용할 출처. 이 값과 다른 Origin 에는 허용 헤더를 주지 않는다 —
   * 무조건 `*` 를 주면 CORS 경로가 깨져도 테스트가 알아채지 못한다.
   */
  allowedOrigin: string;
  /**
   * 모든 응답에 `Connection: close` 를 실어 응답이 끝나면 연결을 닫는다(연결 재사용 제한).
   * 실제로 새 연결이 쓰였는지는 헤더가 아니라 RecordedRequest.socketId·socketRequestIndex 로 확인한다.
   */
  connectionClose?: boolean;
}

export interface SseServer {
  /** SSE 엔드포인트 절대 URL — 세션 응답의 llmSseUrl 로 내려준다 */
  readonly streamUrl: string;
  /** 도착 순서대로의 사전 요청(OPTIONS) */
  readonly preflights: RecordedRequest[];
  /** 도착 순서대로의 SSE 요청(POST) */
  readonly requests: RecordedRequest[];
  /** 서버 사건 순서 기록(연결·요청·끊김) */
  readonly events: ServerEvent[];
  /** 아직 꺼내지 않은 다음 POST 의 손잡이. 이미 와 있으면 즉시, 아니면 도착할 때 resolve */
  nextStream(): Promise<SseStream>;
  /**
   * 처리 중인 요청이 없는(유휴) 연결을 서버에서 모두 닫고, 각 연결의 close 사건까지 기다린다.
   * keep-alive 정책은 그대로 둔 채 "다음 요청은 새 연결에서 시작"하게 만들려는 용도다.
   * 브라우저가 닫힘을 알아채기 전에 그 연결로 보내는 경쟁은 막지 못한다 — 호출부가 사후에
   * 다음 요청의 socketId·socketRequestIndex 로 새 연결이었는지 확인해야 한다.
   * @returns 닫은 연결의 socketId 목록
   */
  closeIdleSockets(): Promise<number[]>;
  close(): Promise<void>;
}

const STREAM_PATH = "/stream";

function corsHeaders(
  origin: string | undefined,
  allowedOrigin: string,
): Record<string, string> {
  if (origin !== allowedOrigin) return {};
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "content-type, authorization",
    Vary: "Origin",
  };
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(raw);
      }
    });
    req.on("error", reject);
  });
}

export async function startSseServer(
  options: SseServerOptions,
): Promise<SseServer> {
  const preflights: RecordedRequest[] = [];
  const requests: RecordedRequest[] = [];
  const ready: SseStream[] = [];
  const waiters: ((s: SseStream) => void)[] = [];
  const sockets = new Set<import("node:net").Socket>();
  const events: ServerEvent[] = [];
  let seq = 0;
  const log = (
    type: ServerEvent["type"],
    socketId: number,
    detail?: Record<string, unknown>,
  ) => events.push({ seq: ++seq, type, socketId, ...(detail ? { detail } : {}) });

  // 연결 식별 — 서버가 연결을 받은 순서로 번호를 매기고, 연결마다 요청 수를 센다
  const socketIds = new WeakMap<import("node:net").Socket, number>();
  const socketRequests = new WeakMap<import("node:net").Socket, number>();
  let nextSocketId = 0;
  const connectionHeader: Record<string, string> = options.connectionClose
    ? { Connection: "close" }
    : {};

  // 연결마다 응답이 끝나지 않은 요청 수 — 0 이면 유휴
  const inFlight = new WeakMap<import("node:net").Socket, number>();

  /** 요청이 들어온 연결의 식별자와 그 연결에서의 순번을 매긴다 */
  const identify = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const socket = req.socket;
    const socketId = socketIds.get(socket) ?? 0;
    const socketRequestIndex = socketRequests.get(socket) ?? 0;
    socketRequests.set(socket, socketRequestIndex + 1);
    inFlight.set(socket, (inFlight.get(socket) ?? 0) + 1);
    res.once("close", () => inFlight.set(socket, (inFlight.get(socket) ?? 1) - 1));
    return { socketId, socketRequestIndex };
  };

  const deliver = (stream: SseStream) => {
    const waiter = waiters.shift();
    if (waiter) waiter(stream);
    else ready.push(stream);
  };

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const path = req.url ?? "";

    if (path !== STREAM_PATH) {
      res.writeHead(404).end();
      return;
    }

    if (req.method === "OPTIONS") {
      const id = identify(req, res);
      preflights.push({ method: "OPTIONS", path, headers: req.headers, body: null, ...id });
      log("preflight", id.socketId, { socketRequestIndex: id.socketRequestIndex });
      res
        .writeHead(204, { ...corsHeaders(origin, options.allowedOrigin), ...connectionHeader })
        .end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }

    const id = identify(req, res);
    const recorded: RecordedRequest = {
      method: "POST",
      path,
      headers: req.headers,
      body: await readBody(req),
      ...id,
    };
    requests.push(recorded);
    log("request", id.socketId, {
      socketRequestIndex: id.socketRequestIndex,
      requestIndex: requests.length - 1,
    });

    const cors = corsHeaders(origin, options.allowedOrigin);
    let clientClosed = false;
    // 응답을 다 보내기 전에 연결이 닫히면 브라우저가 끊은 것이다(abort·페이지 이탈)
    res.on("close", () => {
      if (!res.writableEnded) clientClosed = true;
    });

    deliver({
      request: recorded,
      get clientClosed() {
        return clientClosed;
      },
      get headersSent() {
        return res.headersSent;
      },
      open() {
        res.writeHead(200, {
          ...cors,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          ...connectionHeader,
        });
        // 헤더를 즉시 내보내 브라우저의 fetch 가 resolve 되게 한다
        res.flushHeaders();
      },
      send(type, data) {
        res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
      },
      end() {
        res.end();
      },
      destroy() {
        log("destroyed-by-test", id.socketId, {
          requestIndex: requests.indexOf(recorded),
          headersSent: res.headersSent,
        });
        res.socket?.destroy();
      },
      reject(status, code) {
        res
          .writeHead(status, {
            ...cors,
            "Content-Type": "application/json",
            ...connectionHeader,
          })
          .end(JSON.stringify({ success: false, error: { code, message: code } }));
      },
    });
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    const socketId = ++nextSocketId;
    socketIds.set(socket, socketId);
    log("socket-open", socketId);
    socket.on("close", () => {
      sockets.delete(socket);
      log("socket-close", socketId);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    streamUrl: `http://127.0.0.1:${port}${STREAM_PATH}`,
    preflights,
    requests,
    events,
    nextStream() {
      const stream = ready.shift();
      if (stream) return Promise.resolve(stream);
      return new Promise((resolve) => waiters.push(resolve));
    },
    async closeIdleSockets() {
      const idle = [...sockets].filter((s) => (inFlight.get(s) ?? 0) === 0);
      const closed = idle.map(
        (s) =>
          new Promise<number>((resolve) => {
            const socketId = socketIds.get(s) ?? 0;
            log("idle-closed-by-test", socketId);
            s.once("close", () => resolve(socketId));
            s.destroy();
          }),
      );
      return Promise.all(closed);
    },
    close() {
      // 열린 스트림이 남아 있으면 close 가 영원히 기다린다 — 소켓을 먼저 정리한다
      for (const socket of sockets) socket.destroy();
      return new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}
