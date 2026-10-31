import { useEffect } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "@/shared/analytics/track";
import { ApiError } from "@/shared/api/client";
import { loadChat, saveChat } from "@/shared/chat/chatPersistence";
import { fetchChatListGroup } from "@/shared/chat/lists";
import {
  clearCachedSession,
  ensureSession,
  refreshTicket,
  SessionClaimPendingError,
} from "@/shared/chat/sessionCoordinator";
import type { ChatSession, ProductGroup } from "@/shared/types/chat";
import { useChatStore } from "./store";
import { useChat } from "./useChat";

/**
 * 한 턴의 실행(useChat.run)과 그 진입점 — 부품을 "엮는 쪽"의 회귀 방지.
 *
 * 이벤트 처리(chatEventHandler)·세션 발급(sessionCoordinator)·파서(streamChat)는 각자
 * 테스트가 있다. 여기서 지키는 것은 그 부품들이 **어떤 순서와 분기로 엮이는가**다 —
 * 연타 중복 전송, 입력창 영구 잠김, 만료 세션 재사용처럼 사용자에게 바로 보이는 결함이 여기서 난다.
 *
 * 목 경계: 네트워크에서만 끊는다. SSE 는 global fetch 를 가짜로 두고 실제 바이트를 흘려
 * 진짜 파서 → 진짜 이벤트 핸들러 → 진짜 스토어를 지나게 한다. 세션 코디네이터는
 * Web Locks·BroadcastChannel 의존이고 자체 테스트가 있어 목으로 둔다.
 */

vi.mock("@/shared/chat/sessionCoordinator", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/chat/sessionCoordinator")>();
  return {
    ...actual,
    ensureSession: vi.fn(),
    refreshTicket: vi.fn(),
    clearCachedSession: vi.fn(),
    subscribeSession: vi.fn(() => () => {}),
    subscribeOwnershipChange: vi.fn(() => () => {}),
  };
});
vi.mock("@/shared/chat/lists", () => ({ fetchChatListGroup: vi.fn() }));
vi.mock("@/shared/analytics/track", () => ({ track: vi.fn() }));

// --- 픽스처 ---------------------------------------------------------------

function session(streamTicket = "ticket-1"): ChatSession {
  return {
    sessionId: "session-1",
    ttlSeconds: 600,
    streamTicket,
    ticketTtlSeconds: 60,
    llmSseUrl: "https://ai.example/chat",
  };
}

const encoder = new TextEncoder();
const frame = (type: string, data: unknown) =>
  `data: ${JSON.stringify({ type, data })}\n\n`;
const token = (text: string) => frame("token", { text });
const DONE = frame("done", { finishReason: "stop" });

/** 모든 프레임을 담고 닫힌 SSE 응답 */
function sse(...frames: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(f));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

/** 스트림 시작 전 거부 — 계약 CH-2 §실패 응답 envelope */
function rejected(status: number, code = "ERROR"): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message: "", requestId: "req-1" },
    }),
    { status },
  );
}

/**
 * 테스트가 프레임을 하나씩 밀어 넣는 스트림. abort 되면 실제 fetch 처럼
 * 읽기가 AbortError 로 끊긴다.
 */
function openStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const reply = (signal: AbortSignal) => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    signal.addEventListener("abort", () =>
      controller.error(new DOMException("aborted", "AbortError")),
    );
    return new Response(stream, { status: 200 });
  };
  return {
    reply,
    push: (f: string) => controller.enqueue(encoder.encode(f)),
    close: () => controller.close(),
  };
}

// fetch 는 준비된 응답을 순서대로 하나씩 돌려준다. 준비되지 않은 호출은 곧 "나가면 안 되는 요청"이다.
type Reply = Response | ((signal: AbortSignal) => Response);
let replies: Reply[] = [];
const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
  const signal = init.signal as AbortSignal;
  if (signal.aborted) throw new DOMException("aborted", "AbortError");
  const next = replies.shift();
  if (!next) throw new Error("unexpected fetch");
  return typeof next === "function" ? next(signal) : next;
});

const requestBody = (call: number) =>
  JSON.parse(fetchMock.mock.calls[call][1].body as string);
const requestAuth = (call: number) =>
  (fetchMock.mock.calls[call][1].headers as Record<string, string>)
    .Authorization;

const state = () => useChatStore.getState();
const lastMessage = () => state().messages.slice(-1)[0];

function setup(options: Partial<Parameters<typeof useChat>[0]> = {}) {
  return renderHook(() => useChat({ channel: "SHOPPING", ...options }));
}

beforeEach(() => {
  state().reset();
  sessionStorage.clear();
  replies = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(ensureSession).mockReset().mockResolvedValue(session());
  vi.mocked(refreshTicket)
    .mockReset()
    .mockResolvedValue(session("ticket-2"));
  vi.mocked(clearCachedSession).mockReset();
  vi.mocked(fetchChatListGroup).mockReset();
  vi.mocked(track).mockReset();
});

afterEach(async () => {
  // vitest globals 를 켜지 않아 RTL 자동 정리가 등록되지 않는다 — 직접 언마운트한다.
  cleanup();
  // 언마운트 abort 는 한 틱 미뤄 실행된다. 다음 테스트의 스토어로 새지 않게 흘려보낸다.
  await new Promise((r) => setTimeout(r, 0));
  vi.unstubAllGlobals();
});

// --- 시나리오 (ID 는 docs/ai-development/2026-10-31-chat-turn-test/03-validation.md) ---

describe("useChat — 전송과 재시도", () => {
  it("[R1] 응답 중에 다시 보내면 무시한다 — 연타가 두 번 나가면 장바구니에 중복으로 담긴다", async () => {
    const stream = openStream();
    replies.push(stream.reply);
    const { result } = setup();

    act(() => {
      void result.current.send("이거 담아줘");
      void result.current.send("이거 담아줘");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    stream.push(DONE);
    stream.close();
    await waitFor(() => expect(state().isStreaming).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state().messages.filter((m) => m.role === "user")).toHaveLength(1);
  });

  it("[R2] 티켓 만료(401)로 거부되면 재발급한 티켓으로 한 번 다시 연다", async () => {
    replies.push(rejected(401, "TOKEN_EXPIRED"), sse(token("안녕하세요"), DONE));
    const { result } = setup();

    await act(() => result.current.send("안녕"));

    expect(refreshTicket).toHaveBeenCalledWith("SHOPPING", "session-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestAuth(0)).toBe("Bearer ticket-1");
    expect(requestAuth(1)).toBe("Bearer ticket-2");
    expect(lastMessage()).toMatchObject({ role: "assistant", text: "안녕하세요" });
    expect(lastMessage().error).toBeUndefined();
  });

  it("[R2] 재발급 뒤에도 401 이면 더 시도하지 않는다 — 재시도는 1회뿐", async () => {
    replies.push(rejected(401), rejected(401));
    const { result } = setup();

    await act(() => result.current.send("안녕"));

    expect(refreshTicket).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 실패로 끝났다는 것만 고정한다. 문구·재시도 버튼 여부는 UX 가 정해지지 않았다
    // (재발급 티켓마저 401 이면 재시도가 무의미할 수 있음 — 05-review §5 R2 제안).
    expect(lastMessage().error).toBeDefined();
  });

  it("[R3] 401 이 아닌 시작 거부는 재발급·재시도하지 않는다 — 같은 티켓·같은 결과", async () => {
    replies.push(rejected(403, "FORBIDDEN"));
    const { result } = setup();

    await act(() => result.current.send("안녕"));

    expect(refreshTicket).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastMessage()).toMatchObject({
      error: "이 대화를 열 권한이 없어요. 새로고침 후 다시 시도해 주세요.",
      retryable: false,
    });
  });

  it("[R4] 추천 카드 조회가 끝날 때까지 턴을 닫지 않는다 — 먼저 풀리면 다음 턴과 섞인다", async () => {
    let resolveGroup!: (g: ProductGroup) => void;
    vi.mocked(fetchChatListGroup).mockReturnValue(
      new Promise((r) => {
        resolveGroup = r;
      }),
    );
    replies.push(sse(frame("products.ready", { listIds: ["list-1"] }), DONE));
    const onDone = vi.fn();
    const { result } = setup({ onDone });

    act(() => {
      void result.current.send("셔츠 추천");
    });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(state().isStreaming).toBe(true);

    // 카드를 기다리는 동안 다음 질문을 보내도 나가지 않는다
    act(() => {
      void result.current.send("다음 질문");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state().messages.filter((m) => m.role === "user")).toHaveLength(1);

    resolveGroup({
      title: "추천",
      items: [],
      recommendation: { listType: "PICK_ONE", itemsDropped: 1 },
    });
    await waitFor(() => expect(state().isStreaming).toBe(false));
    expect(state().results).toHaveLength(1);
  });
});

describe("useChat — 실패 분류", () => {
  it("[C1] 응답 도중 화면을 떠나면 실패 말풍선을 남기지 않는다 — 사용자가 끊은 것은 오류가 아니다", async () => {
    const stream = openStream();
    replies.push(stream.reply);
    const { result, unmount } = setup();

    act(() => {
      void result.current.send("안녕");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    stream.push(token("답변 일부"));
    await waitFor(() => expect(lastMessage().text).toBe("답변 일부"));

    unmount();
    await waitFor(() => expect(state().isStreaming).toBe(false));

    expect(lastMessage().error).toBeUndefined();
    expect(lastMessage().text).toBe("답변 일부");
  });

  it("[C2] 로그인 승계 실패가 미해결이면 재시도 버튼 없이 배너로 안내한다 — 다시 눌러도 같은 이유로 막힌다", async () => {
    vi.mocked(ensureSession).mockRejectedValue(new SessionClaimPendingError());
    const { result } = setup();

    await act(() => result.current.send("안녕"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastMessage().error).toContain("이전 대화를 이어받지 못해");
    expect(lastMessage().retryable).toBe(false);
  });

  it("[C2] 승계 실패 중에는 새 세션을 만들지 말라고 코디네이터에 알린다", async () => {
    useChatStore.setState({
      claimFailure: { sessionId: "guest-1", retrying: false },
    });
    replies.push(sse(DONE));
    const { result } = setup();

    await act(() => result.current.send("안녕"));

    expect(ensureSession).toHaveBeenCalledWith("SHOPPING", null, false);
  });

  it("[C3] 티켓 재발급에서 만료(404)가 나면 캐시를 비우고 다시 시도하라고 안내한다", async () => {
    // 실제로 404 가 useChat 까지 올라오는 경로는 이것뿐이다 — 최초 발급(ensureSession)은
    // 404 를 받으면 코디네이터 안에서 새 세션으로 폴백해 던지지 않는다(sessionCoordinator.ts).
    replies.push(rejected(401, "TOKEN_EXPIRED"));
    vi.mocked(refreshTicket).mockRejectedValue(
      new ApiError({ code: "SESSION_NOT_FOUND", message: "" }, 404),
    );
    const { result } = setup();

    await act(() => result.current.send("안녕"));

    expect(refreshTicket).toHaveBeenCalledTimes(1); // 전제 — 재발급 경로를 실제로 탔다
    expect(clearCachedSession).toHaveBeenCalledWith("SHOPPING");
    expect(state().sessionId).toBeNull();
    expect(lastMessage()).toMatchObject({
      error: "대화가 만료되었어요. 다시 시도하면 새로 이어서 대화할 수 있어요.",
      retryable: true,
    });
  });

  it("[C3'] 스트림 시작이 404 로 거부돼도 만료로 판정한다 — 시작 거부 일반 안내보다 먼저 본다", async () => {
    replies.push(rejected(404, "SESSION_NOT_FOUND"));
    const { result } = setup();

    await act(() => result.current.send("안녕"));

    expect(clearCachedSession).toHaveBeenCalledWith("SHOPPING");
    expect(state().sessionId).toBeNull();
    expect(lastMessage().error).toBe(
      "대화가 만료되었어요. 다시 시도하면 새로 이어서 대화할 수 있어요.",
    );
  });

  it("[C4] done·error 없이 끊기면 받은 답은 두고 '연결이 끊겼다'며 재시도를 연다", async () => {
    replies.push(sse(token("반쯤 온 답")));
    const { result } = setup();

    await act(() => result.current.send("안녕"));

    expect(lastMessage()).toMatchObject({
      text: "반쯤 온 답",
      error: "응답 연결이 중간에 끊겼어요. 다시 시도해 주세요.",
      retryable: true,
    });
  });

  it.each([
    [409, "다른 대화가 진행 중이에요. 잠시 후 다시 시도해 주세요.", false],
    [429, "요청이 많아요. 잠시 후 다시 시도해 주세요.", false],
    [504, "응답이 지연되고 있어요. 다시 시도해 주세요.", true],
    [500, "응답을 받지 못했어요. 다시 시도해 주세요.", true],
  ])(
    "[C5] 시작 거부 %i 는 상태에 맞는 안내와 재시도 여부를 보이고 추적 id 를 남긴다",
    async (status, message, retryable) => {
      replies.push(rejected(status));
      const { result } = setup();

      await act(() => result.current.send("안녕"));

      expect(lastMessage()).toMatchObject({
        error: message,
        retryable,
        requestId: "req-1",
      });
    },
  );
});

describe("useChat — 턴 정리와 진입점", () => {
  it.each([
    ["정상 종료", () => sse(token("답"), DONE)],
    ["시작 거부", () => rejected(500)],
  ])("[F] %s 뒤에는 입력이 다시 열린다", async (_label, reply) => {
    replies.push(reply(), sse(DONE));
    const { result } = setup();

    await act(() => result.current.send("첫 질문"));
    expect(state().isStreaming).toBe(false);

    await act(() => result.current.send("다음 질문"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("[F] 진행 표시 중에 응답이 끊겨도 진행 문구가 남지 않는다 — 이 경로는 finally 만이 정리한다", async () => {
    // 종결 이벤트(done·error)가 없으니 이벤트 핸들러는 progress 를 지우지 않는다.
    replies.push(sse(frame("progress", { stage: "searching" })));
    const seen: (string | null)[] = [];
    const unsubscribe = useChatStore.subscribe((s) => seen.push(s.progress));
    const { result } = setup();

    await act(() => result.current.send("질문"));
    unsubscribe();

    // 전제 — 진행 문구가 실제로 화면에 떴었다. 없으면 아래 단언은 처음부터 null 이라 공허하다.
    expect(seen.some((p) => p !== null)).toBe(true);
    expect(state().progress).toBeNull();
    expect(state().isStreaming).toBe(false);
  });

  it("[S1] 메시지도 칩 제거도 없으면 보내지 않는다 — 계약상 400", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.send("   ");
    });

    expect(ensureSession).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state().messages).toHaveLength(0);
  });

  it("[S2] 칩 제거 턴은 검색으로 수집하지 않고, 말풍선 없이 conditionActions 만 보낸다", async () => {
    useChatStore.setState({
      conditions: [{ field: "category", label: "카테고리 · 상의", value: "상의" }],
    });
    replies.push(sse(DONE));
    const { result } = setup();

    await act(async () => {
      result.current.removeCondition("category", "상의");
      await waitFor(() => expect(state().isStreaming).toBe(false));
    });

    expect(track).not.toHaveBeenCalled();
    expect(requestBody(0)).toMatchObject({
      message: "",
      conditionActions: [{ op: "remove", field: "category", value: "상의" }],
    });
    expect(state().messages.filter((m) => m.role === "user")).toHaveLength(0);
    expect(state().conditions).toHaveLength(0);
  });

  it("[S2] 일반 발화는 검색으로 수집한다", async () => {
    replies.push(sse(DONE));
    const { result } = setup();

    await act(() => result.current.send("  여름 셔츠  "));

    expect(track).toHaveBeenCalledWith("search", {
      properties: { query: "여름 셔츠" },
    });
  });

  it("[S3] 실패한 턴을 다시 시도하면 첨부 이미지까지 같이 보낸다 — 빠지면 초안이 사진 없이 만들어진다", async () => {
    replies.push(rejected(500), sse(DONE));
    const { result } = setup({ channel: "SELLER" });
    const imageUrls = ["https://img.example/1.jpg"];

    await act(() =>
      result.current.send("이 사진으로 등록해줘", undefined, { imageUrls }),
    );
    expect(lastMessage().error).toBeDefined();

    await act(async () => {
      result.current.retry(lastMessage().id);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(state().isStreaming).toBe(false));
    });

    expect(requestBody(1)).toMatchObject({
      message: "이 사진으로 등록해줘",
      imageUrls,
    });
    expect(state().messages.filter((m) => m.role === "user")).toEqual([
      expect.objectContaining({ text: "이 사진으로 등록해줘", imageUrls }),
    ]);
  });

  it("[N1] 새 대화는 저장된 대화까지 비우고 방을 새로 판다 — 새로고침해도 이전 대화가 되살아나지 않는다", async () => {
    replies.push(sse(token("답"), DONE));
    const { result } = setup();
    await act(() => result.current.send("안녕"));
    saveChat({ messages: state().messages, sessionId: "session-1", results: [] });
    const previousThread = state().threadId;

    act(() => result.current.startNewChat());

    expect(loadChat()).toBeNull();
    expect(state().messages).toHaveLength(0);
    expect(state().threadId).not.toBeNull();
    expect(state().threadId).not.toBe(previousThread);
  });
});

describe("useChat — 마운트 생명주기", () => {
  it("[U1] StrictMode 의 가짜 언마운트가 마운트 직후 시작한 전송을 끊지 않는다 — ?q= 진입 경로", async () => {
    replies.push(sse(token("안녕하세요"), DONE));
    // 홈에서 ?q= 로 진입하면 화면이 마운트 이펙트에서 새 대화를 열고 1회 전송한다(ref 가드).
    // features/chat/index.tsx 와 같은 순서(startNewChat → send)로 만든다.
    const once = { sent: false };
    const lifecycle: string[] = [];

    // StrictMode 는 RTL 옵션으로 **루트에** 건다. wrapper 로 감싸면 이 환경(React 19.2)에서
    // 이펙트 이중 실행이 일어나지 않아, 재현하려던 가짜 언마운트 없이 테스트가 통과했다(변이 M15 생존).
    renderHook(
      () => {
        const chat = useChat({ channel: "SHOPPING" });
        useEffect(() => {
          lifecycle.push("mount");
          return () => {
            lifecycle.push("cleanup");
          };
        }, []);
        useEffect(() => {
          if (once.sent) return;
          once.sent = true;
          chat.startNewChat();
          void chat.send("첫 질문");
        }, [chat]);
        return chat;
      },
      { reactStrictMode: true },
    );

    // 전제 — 가짜 언마운트가 실제로 일어났는가. 없으면 이 테스트는 아무것도 검증하지 않는다.
    expect(lifecycle).toEqual(["mount", "cleanup", "mount"]);
    await waitFor(() => expect(lastMessage()?.text).toBe("안녕하세요"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastMessage().error).toBeUndefined();
    await waitFor(() => expect(state().isStreaming).toBe(false));
  });
});

/**
 * 재시도는 "마지막 실패 턴"에만 — 개발자 시나리오 B(재시도 연속 클릭)에서 나온 결함 B1~B4.
 * 종전 retry() 는 대상을 모른 채 "마지막 교환"을 지우고 다시 보내서, 연타·응답 중 재시도·
 * 위쪽 실패 말풍선의 재시도가 엉뚱한 턴을 지우거나 재전송했다.
 */
describe("useChat — 재시도 대상", () => {
  it("[B1] 같은 실패를 연달아 재시도해도 한 번만 다시 보내고, 다시 보낸 턴의 말풍선을 지우지 않는다", async () => {
    replies.push(rejected(500), sse(token("다시 받은 답"), DONE));
    const { result } = setup();
    await act(() => result.current.send("질문"));
    const failedId = lastMessage().id;

    await act(async () => {
      result.current.retry(failedId);
      result.current.retry(failedId);
      await waitFor(() => expect(state().isStreaming).toBe(false));
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state().messages.map((m) => [m.role, m.text, m.error])).toEqual([
      ["user", "질문", undefined],
      ["assistant", "다시 받은 답", undefined],
    ]);
  });

  it("[B2·B3] 재시도한 턴이 응답 중일 때 다시 눌러도 아무 일 없다 — 진행 중 말풍선이 지워지거나 답이 이전 말풍선에 붙지 않는다", async () => {
    const stream = openStream();
    replies.push(sse(token("첫 답"), DONE), rejected(500), stream.reply);
    const { result } = setup();
    await act(() => result.current.send("첫 질문"));
    await act(() => result.current.send("둘째 질문"));
    const failedId = lastMessage().id;

    act(() => result.current.retry(failedId));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const inFlightId = lastMessage().id;
    // 이미 사라진 실패 말풍선 id 로도, 응답 중인 말풍선 id 로도 다시 눌러 본다
    act(() => {
      result.current.retry(failedId);
      result.current.retry(inFlightId);
    });
    stream.push(token("둘째 답"));
    stream.push(DONE);
    stream.close();
    await waitFor(() => expect(state().isStreaming).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(state().messages.map((m) => m.text)).toEqual([
      "첫 질문",
      "첫 답",
      "둘째 질문",
      "둘째 답",
    ]);
  });

  it("[B4] 위쪽 실패 말풍선의 재시도는 아무것도 보내지 않는다 — 마지막 성공 질문이 대신 재전송되면 담기가 두 번 된다", async () => {
    replies.push(rejected(500), sse(token("둘째 답"), DONE));
    const { result } = setup();
    await act(() => result.current.send("첫 질문"));
    const oldFailedId = lastMessage().id;
    await act(() => result.current.send("둘째 질문"));
    const before = state().messages;

    await act(async () => {
      result.current.retry(oldFailedId);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 위쪽 실패 말풍선도 지우지 않는다 — 실패했다는 사실은 화면에 남아야 한다
    expect(state().messages).toEqual(before);
  });

  it("[B1] 실패가 표시됐어도 턴이 아직 끝나지 않았으면(카드 조회 대기) 재시도하지 않는다", async () => {
    // SSE error 로 말풍선은 이미 실패인데, 앞서 온 products.ready 의 카드 조회를 기다리느라
    // 턴은 아직 열려 있다 — 이 구간에도 마지막 실패 말풍선이라 버튼이 보인다.
    let resolveGroup!: (g: ProductGroup) => void;
    vi.mocked(fetchChatListGroup).mockReturnValue(
      new Promise((r) => {
        resolveGroup = r;
      }),
    );
    replies.push(
      sse(
        frame("products.ready", { listIds: ["list-1"] }),
        frame("error", { code: "INTERNAL", message: "", retryable: true }),
      ),
    );
    const { result } = setup();
    act(() => {
      void result.current.send("질문");
    });
    await waitFor(() => expect(lastMessage().error).toBeDefined());
    expect(state().isStreaming).toBe(true); // 전제 — 실패 표시와 진행 중이 겹친 구간

    act(() => result.current.retry(lastMessage().id));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state().messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    resolveGroup({
      title: "추천",
      items: [],
      recommendation: { listType: "PICK_ONE", itemsDropped: 1 },
    });
    await waitFor(() => expect(state().isStreaming).toBe(false));
  });

  it("[B4] 실패가 연달아 있을 때 위쪽 실패의 id 로 재시도하면 아무것도 보내지 않는다 — 마지막 실패가 대신 나가면 안 된다", async () => {
    replies.push(rejected(500), rejected(500));
    const { result } = setup();
    await act(() => result.current.send("첫 질문"));
    const oldFailedId = lastMessage().id;
    await act(() => result.current.send("둘째 질문"));
    const before = state().messages;

    await act(async () => {
      result.current.retry(oldFailedId);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state().messages).toEqual(before);
  });

  it("[B] dropLastExchange 는 마지막 말풍선이 실패가 아니면 아무것도 지우지 않는다 — 응답 중인 턴을 지키는 마지막 방어선", () => {
    state().addMessage({ id: "u", role: "user", text: "질문" });
    state().addMessage({ id: "a", role: "assistant", text: "응답 중" });

    expect(state().dropLastExchange()).toBeNull();
    expect(state().messages.map((m) => m.id)).toEqual(["u", "a"]);
  });
});

/**
 * 결함 의심 H1 — 수정 전 **현재 동작**을 기록한다(정답으로 고정하는 것이 아니다).
 * 사용자 말풍선이 없는 턴(칩 제거·판매자 승인)이 실패하면 재시도 버튼이 보이지만,
 * 눌러도 재전송 없이 실패 말풍선만 사라진다. 수정 여부는 별도 결정 —
 * 고치면 이 테스트를 "다시 보낸다"로 뒤집는다.
 */
describe("[H1 재현] 말풍선 없는 턴의 재시도 — 현재 동작", () => {
  it("칩 제거 턴이 실패한 뒤 다시 시도하면 재전송 없이 실패 말풍선만 사라진다", async () => {
    replies.push(sse(token("추천 결과"), DONE), rejected(500));
    useChatStore.setState({
      conditions: [{ field: "category", label: "카테고리 · 상의", value: "상의" }],
    });
    const { result } = setup();
    await act(() => result.current.send("셔츠 추천"));

    await act(async () => {
      result.current.removeCondition("category", "상의");
      await waitFor(() => expect(state().isStreaming).toBe(false));
    });
    // 재시도 버튼이 보이는 상태다(MessageList 는 retryable !== false 일 때 버튼을 그린다)
    expect(lastMessage()).toMatchObject({ role: "assistant", retryable: true });
    expect(lastMessage().error).toBeDefined();

    act(() => result.current.retry(lastMessage().id));

    expect(fetchMock).toHaveBeenCalledTimes(2); // 재전송 없음
    expect(state().messages.map((m) => m.text)).toEqual(["셔츠 추천", "추천 결과"]);
    expect(state().conditions).toHaveLength(0); // 서버엔 적용 안 됐는데 화면에선 지워진 채
  });

  it("판매자 승인 턴이 실패한 뒤 다시 시도하면 재전송 없이 실패 말풍선만 사라진다", async () => {
    replies.push(sse(token("초안입니다"), DONE), rejected(500));
    const { result } = setup({ channel: "SELLER" });
    await act(() => result.current.send("상품 등록해줘"));

    await act(() => result.current.confirm("draft-1"));
    expect(lastMessage()).toMatchObject({ role: "assistant", retryable: true });

    act(() => result.current.retry(lastMessage().id));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state().messages.map((m) => m.text)).toEqual([
      "상품 등록해줘",
      "초안입니다",
    ]);
  });
});
