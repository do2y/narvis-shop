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
import { useAuthStore } from "@/shared/stores/authStore";
import type {
  ChatResult,
  ChatSession,
  ProductGroup,
  SellerDraft,
} from "@/shared/types/chat";
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
  useChatStore.setState({ unresolvedApprovals: [] }); // 새 대화(reset)가 일부러 지우지 않는 값
  useAuthStore.setState({ user: null });
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

/**
 * 턴 소유권 — 개발자 시나리오 A(스트리밍 중 새 대화)에서 나온 결함 A1·A2.
 * 끝난 턴(새 대화로 버려진 턴)은 새 대화의 메시지·카드·세션·로딩 상태를 바꾸면 안 된다.
 * abort 는 네트워크만 끊고 이미 시작된 비동기 작업(세션 확보 await·카드 조회)은 막지 못하므로,
 * "지금도 현재 턴인가"를 쓰기 직전에 확인하는 것으로 격리한다 — 타이밍에 기대지 않는다.
 */
describe("useChat — 턴 소유권", () => {
  it("[A·수명] 전송하면 첫 await 전에 턴 id 가 생기고, 턴이 끝나면 비워진다 — isStreaming 과 같이 움직인다", async () => {
    const stream = openStream();
    replies.push(stream.reply);
    const { result } = setup();

    act(() => {
      void result.current.send("질문");
    });
    expect(state().activeTurnId).toEqual(expect.any(String));
    expect(state().isStreaming).toBe(true);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    stream.push(DONE);
    stream.close();
    await waitFor(() => expect(state().isStreaming).toBe(false));
    expect(state().activeTurnId).toBeNull();
  });

  it("[A·수명] 티켓 401 재시도는 같은 턴이고, 다음 전송은 새 턴이다", async () => {
    const seen: (string | null)[] = [];
    const observe = (reply: Response) => () => {
      seen.push(state().activeTurnId);
      return reply;
    };
    replies.push(observe(rejected(401)), observe(sse(DONE)), observe(sse(DONE)));
    const { result } = setup();

    await act(() => result.current.send("첫 질문"));
    await act(() => result.current.send("둘째 질문"));

    expect(seen).toHaveLength(3);
    expect(seen[0]).toEqual(expect.any(String));
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).not.toBe(seen[0]);
  });

  it("[A·reset] 새 대화를 누르면 그 순간 이전 턴의 소유권이 사라진다", async () => {
    const stream = openStream();
    replies.push(stream.reply);
    const { result } = setup();
    act(() => {
      void result.current.send("질문");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => result.current.startNewChat());

    expect(state().activeTurnId).toBeNull();
    expect(state().isStreaming).toBe(false);
  });

  it("[A·언마운트] 응답 도중 화면을 떠나면 그 턴이 스스로 정리한다 — 소유권이 남아 입력이 잠기지 않는다", async () => {
    const stream = openStream();
    replies.push(stream.reply);
    const { result, unmount } = setup();
    act(() => {
      void result.current.send("질문");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    unmount();

    await waitFor(() => expect(state().isStreaming).toBe(false));
    expect(state().activeTurnId).toBeNull();
    expect(lastMessage().error).toBeUndefined();
  });

  it("[A1] 추천 카드 조회 중 새 대화를 시작하면, 늦게 온 카드는 새 대화에 들어오지 않는다", async () => {
    let resolveGroup!: (g: ProductGroup) => void;
    vi.mocked(fetchChatListGroup).mockReturnValue(
      new Promise((r) => {
        resolveGroup = r;
      }),
    );
    replies.push(
      sse(token("이전 답"), frame("products.ready", { listIds: ["list-1"] }), DONE),
    );
    const { result } = setup();
    act(() => {
      void result.current.send("이전 질문");
    });
    await waitFor(() => expect(fetchChatListGroup).toHaveBeenCalled());

    act(() => result.current.startNewChat());
    resolveGroup({
      title: "이전 추천",
      items: [],
      recommendation: { listType: "PICK_ONE", itemsDropped: 1 },
    });
    await new Promise((r) => setTimeout(r, 20));

    expect(state().results).toEqual([]);
    expect(state().messages).toEqual([]);
    expect(state().isStreaming).toBe(false);
  });

  it("[A2] 세션 확보 중 새 대화 후 새 질문 → 이전 턴이 뒤늦게 끝나도 새 턴의 응답 중 상태·말풍선을 건드리지 않는다", async () => {
    let resolveOld!: (s: ChatSession) => void;
    vi.mocked(ensureSession)
      .mockReturnValueOnce(
        new Promise((r) => {
          resolveOld = r;
        }),
      )
      .mockResolvedValue(session());
    const stream = openStream();
    replies.push(stream.reply);
    const { result } = setup();

    act(() => {
      void result.current.send("이전 질문");
    });
    act(() => result.current.startNewChat());
    act(() => {
      void result.current.send("새 질문");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const newTurnId = state().activeTurnId;

    // 이전 턴의 세션 확보가 이제야 끝난다
    resolveOld(session());
    await new Promise((r) => setTimeout(r, 20));

    expect(state().isStreaming).toBe(true);
    expect(state().activeTurnId).toBe(newTurnId);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 이전 턴은 요청을 보내지 않았다

    // 새 턴이 응답 중이므로 또 보내도 나가지 않는다(중복 전송 가드가 살아 있다)
    act(() => {
      void result.current.send("또 보냄");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    stream.push(token("새 답"));
    stream.push(DONE);
    stream.close();
    await waitFor(() => expect(state().isStreaming).toBe(false));
    expect(state().messages.map((m) => m.text)).toEqual(["새 질문", "새 답"]);
  });

  it("[A2] 이전 턴의 세션 확보가 새 대화 뒤에 실패해도, 그 실패가 새 턴의 말풍선에 찍히지 않는다", async () => {
    // 최초 발급은 404 를 던지지 않는다(코디네이터가 폴백) — 실제로 올라오는 건 네트워크·5xx 실패다
    let rejectOld!: (e: unknown) => void;
    vi.mocked(ensureSession)
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectOld = reject;
        }),
      )
      .mockResolvedValue(session());
    const stream = openStream();
    replies.push(stream.reply);
    const { result } = setup();

    act(() => {
      void result.current.send("이전 질문");
    });
    act(() => result.current.startNewChat());
    act(() => {
      void result.current.send("새 질문");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rejectOld(new ApiError({ code: "INTERNAL", message: "" }, 500));
    await new Promise((r) => setTimeout(r, 20));

    expect(lastMessage().error).toBeUndefined(); // 새 턴의 응답 중 말풍선
    expect(state().isStreaming).toBe(true);

    stream.push(token("새 답"));
    stream.push(DONE);
    stream.close();
    await waitFor(() => expect(state().isStreaming).toBe(false));
    expect(state().messages.map((m) => [m.text, m.error])).toEqual([
      ["새 질문", undefined],
      ["새 답", undefined],
    ]);
  });

  it("[A2] 티켓 재발급을 기다리는 사이 새 대화를 시작하면, 이전 턴의 재발급 결과가 새 대화의 세션에 쓰이지 않는다", async () => {
    // 같은 탭의 재발급은 subscribeSession 으로 돌아오지 않는다(BroadcastChannel 은 보낸 객체에 전달하지 않음).
    // 그래서 새 대화(reset → sessionId null)에 세션 값을 쓰는 주체는 이전 턴 자신뿐이다.
    let resolveFresh!: (s: ChatSession) => void;
    vi.mocked(refreshTicket).mockReturnValueOnce(
      new Promise((r) => {
        resolveFresh = r;
      }),
    );
    replies.push(rejected(401, "TOKEN_EXPIRED"));
    const { result } = setup();

    act(() => {
      void result.current.send("이전 질문");
    });
    await waitFor(() => expect(refreshTicket).toHaveBeenCalledTimes(1));
    act(() => result.current.startNewChat());
    expect(state().sessionId).toBeNull(); // 전제 — 새 대화는 세션 표시값을 비운다

    resolveFresh(session("ticket-2"));
    await new Promise((r) => setTimeout(r, 20));

    expect(state().sessionId).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // 이전 턴은 다시 열려고 시도하지도 않는다
    expect(state().isStreaming).toBe(false);
  });

  it("[A2] 새 대화 뒤 이전 턴이 세션 만료(404)를 알게 되면, 대화에는 아무것도 쓰지 않되 만료된 세션 캐시는 비운다", async () => {
    // 세션 캐시는 대화 상태가 아니라 탭이 공유하는 접속 정보다 — 서버 상태 동기화 쪽(개발자 결정).
    // 비우지 않으면 새 대화의 다음 전송이 만료된 세션을 캐시에서 집어 한 번 더 실패한다.
    let rejectFresh!: (e: unknown) => void;
    vi.mocked(refreshTicket).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectFresh = reject;
      }),
    );
    replies.push(rejected(401, "TOKEN_EXPIRED"));
    const { result } = setup();

    act(() => {
      void result.current.send("이전 질문");
    });
    await waitFor(() => expect(refreshTicket).toHaveBeenCalledTimes(1));
    act(() => result.current.startNewChat());

    rejectFresh(new ApiError({ code: "SESSION_NOT_FOUND", message: "" }, 404));
    await new Promise((r) => setTimeout(r, 20));

    expect(clearCachedSession).toHaveBeenCalledWith("SHOPPING");
    expect(state().messages).toEqual([]); // 실패 말풍선을 새 대화에 남기지 않는다
    expect(state().sessionId).toBeNull();
  });

  it("[A3] 답변 수신 중 새 대화 + 곧바로 새 질문 → 이전 턴 정리가 새 턴을 풀지 않고, 새 대화를 다시 누르면 새 턴이 끊긴다", async () => {
    const old = openStream();
    const fresh = openStream();
    replies.push(old.reply, fresh.reply);
    const { result } = setup();
    act(() => {
      void result.current.send("이전 질문");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    old.push(token("이전 답 일부"));
    await waitFor(() => expect(lastMessage().text).toBe("이전 답 일부"));

    act(() => {
      result.current.startNewChat();
      void result.current.send("새 질문");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 20)); // 이전 턴의 abort·finally 가 끝날 시간

    expect(state().isStreaming).toBe(true);
    expect(state().messages.map((m) => m.text)).toEqual(["새 질문", ""]);

    // 새 턴의 컨트롤러가 살아 있어야 "새 대화"가 그 턴을 끊을 수 있다
    const freshSignal = fetchMock.mock.calls[1][1].signal as AbortSignal;
    act(() => result.current.startNewChat());
    expect(freshSignal.aborted).toBe(true);
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
 * H1 — 사용자 말풍선이 없는 턴(칩 제거·판매자 승인)의 재시도.
 *
 * 재시도는 "무엇을 다시 보낼지"가 있을 때만 가능하다. 말풍선 없는 턴은 실패한 말풍선에
 * 최소 재전송 정보(resend)를 남기고, 요청 유형별로 다시 보내도 안전할 때만 남긴다:
 * - 판매자 승인: 요청을 **시작하지 않았음이 확실한 실패**에서만. fetch 를 한 번이라도 불렀으면
 *   서버 처리 여부를 알 수 없으므로 재전송하지 않고 확인을 안내한다(개발자 결정 2026-10-31).
 * - 칩 제거: 조건 제거는 계약상 멱등이라 retryable 이 거짓이 아니면 남긴다.
 * 버튼 노출과 실제 재시도 가능 여부는 같은 조건을 쓴다(I-4).
 */
const CONFIRM_UNKNOWN =
  "요청이 처리됐는지 확인하지 못했어요. 상품 목록에서 반영 여부를 확인한 뒤 다시 진행해 주세요.";

describe("useChat — 말풍선 없는 턴의 재시도 (H1)", () => {
  const chip = { field: "category" as const, label: "카테고리 · 상의", value: "상의" };
  const otherChip = { field: "brand" as const, label: "브랜드 · 무명", value: "무명" };

  /** 이전 턴 하나를 성공시키고, 그 뒤 칩 제거 턴을 실행한다 */
  async function chipTurn(result: { current: ReturnType<typeof useChat> }) {
    await act(() => result.current.send("셔츠 추천"));
    useChatStore.setState({ conditions: [chip, otherChip] });
    await act(async () => {
      result.current.removeCondition("category", "상의");
      await waitFor(() => expect(state().isStreaming).toBe(false));
    });
  }

  it("[H1] 칩 제거가 요청 전에 실패하면(세션 확보 실패) 다시 시도로 같은 조건 제거를 보낸다 — 말풍선·수집 없이, 다른 칩은 그대로", async () => {
    replies.push(sse(token("추천 결과"), DONE), sse(DONE));
    vi.mocked(ensureSession)
      .mockResolvedValueOnce(session())
      .mockRejectedValueOnce(new ApiError({ code: "INTERNAL", message: "" }, 500))
      .mockResolvedValue(session());
    const { result } = setup();
    await chipTurn(result);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 전제 — 칩 제거 요청은 나가지 못했다
    const failedId = lastMessage().id;
    vi.mocked(track).mockClear();

    await act(async () => {
      result.current.retry(failedId);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(state().isStreaming).toBe(false));
    });

    expect(requestBody(1)).toMatchObject({
      message: "",
      conditionActions: [{ op: "remove", field: "category", value: "상의" }],
    });
    expect(state().messages.map((m) => m.role)).toEqual(["user", "assistant", "assistant"]);
    expect(state().messages.some((m) => m.error)).toBe(false);
    expect(state().conditions).toEqual([otherChip]);
    expect(track).not.toHaveBeenCalled();
  });

  it("[H1] 칩 제거는 요청이 나간 뒤 실패해도(500) 다시 보낸다 — 조건 제거는 멱등", async () => {
    replies.push(sse(token("추천 결과"), DONE), rejected(500), sse(DONE));
    const { result } = setup();
    await chipTurn(result);

    await act(async () => {
      result.current.retry(lastMessage().id);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    });

    expect(requestBody(2)).toMatchObject({
      conditionActions: [{ op: "remove", field: "category", value: "상의" }],
    });
  });

  it("[H1] 칩 제거가 다시 해도 같은 결과인 실패(409)면 재시도하지 않는다", async () => {
    replies.push(sse(token("추천 결과"), DONE), rejected(409));
    const { result } = setup();
    await chipTurn(result);
    const before = state().messages;

    act(() => result.current.retry(lastMessage().id));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state().messages).toEqual(before);
  });

  it("[H1] 판매자 승인이 요청 전에 실패하면(세션 확보 실패) 다시 시도로 같은 초안을 승인한다", async () => {
    replies.push(sse(token("초안입니다"), DONE), sse(DONE));
    vi.mocked(ensureSession)
      .mockResolvedValueOnce(session())
      .mockRejectedValueOnce(new ApiError({ code: "INTERNAL", message: "" }, 500))
      .mockResolvedValue(session());
    const { result } = setup({ channel: "SELLER" });
    await act(() => result.current.send("상품 등록해줘"));
    await act(() => result.current.confirm("draft-1"));
    expect(fetchMock).toHaveBeenCalledTimes(1); // 전제 — 승인 요청은 나가지 못했다
    expect(lastMessage().retryable).not.toBe(false);

    await act(async () => {
      result.current.retry(lastMessage().id);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(state().isStreaming).toBe(false));
    });

    expect(requestBody(1)).toMatchObject({ action: "confirm", draftId: "draft-1" });
    expect(state().messages.map((m) => m.text)).toEqual(["상품 등록해줘", "초안입니다", ""]);
  });

  it.each([
    ["시작 거부 500", () => [rejected(500)]],
    ["시작 거부 403", () => [rejected(403)]],
    ["시작 거부 401", () => [rejected(401)]],
    ["종결 없이 끊김", () => [sse(token("처리 중…"))]],
    [
      "SSE error (서버가 retryable:true 라고 해도)",
      () => [sse(frame("error", { code: "INTERNAL", message: "", retryable: true }))],
    ],
  ])(
    "[H1] 판매자 승인이 요청을 보낸 뒤 실패하면(%s) 다시 보내지 않고 반영 여부 확인을 안내한다",
    async (_label, failure) => {
      replies.push(sse(token("초안입니다"), DONE), ...failure());
      const { result } = setup({ channel: "SELLER" });
      await act(() => result.current.send("상품 등록해줘"));
      await act(() => result.current.confirm("draft-1"));
      const calls = fetchMock.mock.calls.length;

      expect(lastMessage()).toMatchObject({ error: CONFIRM_UNKNOWN, retryable: false });
      expect(lastMessage().resend).toBeUndefined();

      act(() => result.current.retry(lastMessage().id));
      expect(fetchMock).toHaveBeenCalledTimes(calls);
    },
  );

  it("[H1] 판매자 승인이 요청을 보낸 뒤 네트워크 오류로 실패해도 다시 보내지 않는다", async () => {
    replies.push(sse(token("초안입니다"), DONE));
    const { result } = setup({ channel: "SELLER" });
    await act(() => result.current.send("상품 등록해줘"));
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("Failed to fetch");
    });

    await act(() => result.current.confirm("draft-1"));

    expect(lastMessage()).toMatchObject({ error: CONFIRM_UNKNOWN, retryable: false });
    expect(lastMessage().resend).toBeUndefined();
  });

  it("[H1] 판매자 승인이 성공하면 실패 표시도 재전송 정보도 남지 않는다 — 요청을 보낸 턴이라도 성공은 성공이다", async () => {
    replies.push(
      sse(token("초안입니다"), DONE),
      sse(
        frame("action", { type: "PRODUCT_UPDATED", message: "등록됐어요", productId: "7" }),
        frame("done", { finishReason: "stop", panel: "refresh" }),
      ),
    );
    const { result } = setup({ channel: "SELLER" });
    await act(() => result.current.send("상품 등록해줘"));

    await act(() => result.current.confirm("draft-1"));

    expect(lastMessage()).toMatchObject({ role: "assistant", text: "\n\n등록됐어요" });
    expect(lastMessage().error).toBeUndefined();
    expect(lastMessage().resend).toBeUndefined();
  });

  it("[H1] 재전송 정보는 다시 시도할 수 있는 실패에만 남긴다 — 409 처럼 버튼이 없는 실패엔 저장하지 않는다", async () => {
    replies.push(sse(token("추천 결과"), DONE), rejected(409));
    const { result } = setup();
    await chipTurn(result);

    expect(lastMessage()).toMatchObject({ retryable: false });
    expect(lastMessage().resend).toBeUndefined();
  });

  it("[H1·A] 새 대화로 버려진 칩 제거 턴이 뒤늦게 끝나도, 새 대화의 실패 말풍선에 재전송 정보를 붙이지 않는다", async () => {
    // 이전 턴: 칩 제거 → products.ready → 카드 조회를 기다리는 중(턴이 아직 안 끝남)
    let resolveGroup!: (g: ProductGroup) => void;
    vi.mocked(fetchChatListGroup).mockReturnValue(
      new Promise((r) => {
        resolveGroup = r;
      }),
    );
    replies.push(
      sse(token("추천 결과"), DONE),
      sse(frame("products.ready", { listIds: ["list-1"] }), DONE),
      rejected(500), // 새 대화의 질문은 실패한다
      sse(DONE),
    );
    const { result } = setup();
    await act(() => result.current.send("셔츠 추천"));
    useChatStore.setState({ conditions: [chip] });
    act(() => result.current.removeCondition("category", "상의"));
    await waitFor(() => expect(fetchChatListGroup).toHaveBeenCalled());

    act(() => result.current.startNewChat());
    await act(() => result.current.send("새 질문"));
    expect(lastMessage().error).toBeDefined(); // 전제 — 새 대화의 마지막 말풍선이 실패

    resolveGroup({
      title: "이전 추천",
      items: [],
      recommendation: { listType: "PICK_ONE", itemsDropped: 1 },
    });
    await new Promise((r) => setTimeout(r, 20));

    expect(lastMessage().resend).toBeUndefined();
    await act(async () => {
      result.current.retry(lastMessage().id);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    });
    expect(requestBody(3)).toMatchObject({ message: "새 질문" });
    expect(requestBody(3).conditionActions).toBeUndefined();
  });

  it("[H1] 성공한 턴에는 재전송 정보를 남기지 않는다", async () => {
    replies.push(sse(token("추천 결과"), DONE), sse(DONE));
    const { result } = setup();
    await chipTurn(result);

    expect(state().messages.every((m) => m.resend === undefined)).toBe(true);
  });

  it("[H1] 새로고침으로 복원된 재전송 정보로도 다시 시도할 수 있다", async () => {
    replies.push(sse(DONE));
    useChatStore.setState({
      messages: [
        { id: "u", role: "user", text: "셔츠 추천" },
        { id: "a1", role: "assistant", text: "추천 결과" },
        {
          id: "a2",
          role: "assistant",
          text: "",
          error: "응답을 받지 못했어요.",
          retryable: true,
          resend: { kind: "conditions", actions: [{ op: "remove", field: "category", value: "상의" }] },
        },
      ],
    });
    const { result } = setup();

    await act(async () => {
      result.current.retry("a2");
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });

    expect(requestBody(0)).toMatchObject({
      conditionActions: [{ op: "remove", field: "category", value: "상의" }],
    });
  });

  it.each([
    ["재전송 정보가 없는 옛 저장분", undefined],
    ["형식이 깨진 재전송 정보", { kind: "confirm" }],
  ])("[H1] %s 이면 다시 보내지도, 실패 말풍선을 지우지도 않는다", (_label, resend) => {
    const messages = [
      { id: "u", role: "user" as const, text: "상품 등록해줘" },
      { id: "a1", role: "assistant" as const, text: "초안입니다" },
      {
        id: "a2",
        role: "assistant" as const,
        text: "",
        error: "응답을 받지 못했어요.",
        retryable: true,
        ...(resend ? { resend } : {}),
      },
    ];
    useChatStore.setState({ messages: messages as never });
    const { result } = setup({ channel: "SELLER" });

    act(() => result.current.retry("a2"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(state().messages.map((m) => m.id)).toEqual(["u", "a1", "a2"]);
  });
});

/**
 * I-6 — 판매자 승인은 전송 직전에 새 티켓을 확보하고, 401 이어도 자동으로 다시 보내지 않는다.
 * 새 티켓은 401 가능성을 줄일 뿐 없애지 못한다(서버 키 교체·시계 차이 등). 그래서 401 뒤의 처리가 본체다.
 * 일반 발화·칩 제거의 자동 재발급·재전송은 그대로다.
 */
describe("useChat — 판매자 승인의 티켓과 401 (I-6)", () => {
  const CONFIRM_MESSAGE =
    "요청이 처리됐는지 확인하지 못했어요. 상품 목록에서 반영 여부를 확인한 뒤 다시 진행해 주세요.";

  async function draftTurn() {
    replies.push(sse(token("초안입니다"), DONE));
    const hook = setup({ channel: "SELLER" });
    await act(() => hook.result.current.send("상품 등록해줘"));
    vi.mocked(ensureSession).mockClear();
    fetchMock.mockClear();
    return hook;
  }

  it("[I-6] 승인은 캐시를 건너뛰고 기존 세션의 티켓을 새로 받은 뒤, 요청을 정확히 한 번 보낸다", async () => {
    const { result } = await draftTurn();
    vi.mocked(ensureSession).mockResolvedValueOnce(session("fresh-ticket"));
    replies.push(sse(token("반영했습니다"), DONE));

    await act(() => result.current.confirm("draft-1"));

    expect(ensureSession).toHaveBeenCalledTimes(1);
    expect(ensureSession).toHaveBeenCalledWith("SELLER", "session-1", true, {
      fresh: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestAuth(0)).toBe("Bearer fresh-ticket");
    expect(vi.mocked(ensureSession).mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0],
    );
  });

  it("[I-6] 승인이 401 을 받으면 재발급·재전송 없이 끝나고, 처리 여부를 단정하지 않고 안내한다", async () => {
    const { result } = await draftTurn();
    replies.push(rejected(401, "TOKEN_EXPIRED"), sse(DONE));

    await act(() => result.current.confirm("draft-1"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshTicket).not.toHaveBeenCalled();
    expect(lastMessage()).toMatchObject({
      error: CONFIRM_MESSAGE,
      retryable: false,
    });
    expect(lastMessage().resend).toBeUndefined();

    act(() => result.current.retry(lastMessage().id));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("[I-6] 새 티켓 확보가 실패하면 요청을 보내지 않고, 다시 시도하면 또 새 티켓으로 시작한다", async () => {
    const { result } = await draftTurn();
    vi.mocked(ensureSession).mockRejectedValueOnce(
      new ApiError({ code: "INTERNAL", message: "" }, 500),
    );

    await act(() => result.current.confirm("draft-1"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastMessage().resend).toEqual({ kind: "confirm", draftId: "draft-1" });

    replies.push(sse(DONE));
    await act(async () => {
      result.current.retry(lastMessage().id);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });
    expect(ensureSession).toHaveBeenLastCalledWith("SELLER", "session-1", true, {
      fresh: true,
    });
    expect(requestBody(0)).toMatchObject({ action: "confirm", draftId: "draft-1" });
  });

  it("[I-6] 승계 실패가 미해결이면 승인에서도 새 세션 생성을 막으라고 알린다", async () => {
    const { result } = await draftTurn();
    useChatStore.setState({
      sessionId: null,
      claimFailure: { sessionId: "guest-1", retrying: false },
    });
    vi.mocked(ensureSession).mockRejectedValueOnce(new SessionClaimPendingError());

    await act(() => result.current.confirm("draft-1"));

    expect(ensureSession).toHaveBeenCalledWith("SELLER", null, false, { fresh: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastMessage().retryable).toBe(false);
  });

  it("[I-6] 일반 발화는 캐시 경로를 쓰고 401 이면 종전대로 재발급 후 다시 보낸다", async () => {
    replies.push(rejected(401), sse(token("답"), DONE));
    const { result } = setup();

    await act(() => result.current.send("이거 담아줘"));

    expect(ensureSession).toHaveBeenCalledWith("SHOPPING", null, true);
    expect(refreshTicket).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(1)).toEqual(requestBody(0));
    expect(lastMessage().error).toBeUndefined();
  });

  it("[I-6] 칩 제거도 캐시 경로를 쓰고 401 이면 종전대로 재발급 후 다시 보낸다", async () => {
    replies.push(rejected(401), sse(DONE));
    const { result } = setup();

    await act(async () => {
      result.current.removeCondition("category", "상의");
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(state().isStreaming).toBe(false));
    });

    expect(ensureSession).toHaveBeenCalledWith("SHOPPING", null, true);
    expect(refreshTicket).toHaveBeenCalledTimes(1);
    expect(requestBody(1)).toEqual(requestBody(0));
    expect(lastMessage().error).toBeUndefined();
  });
});

/**
 * I-5 · I-7 — 판매자 승인 상태는 초안(draftId)별로 추적한다.
 * 현재 계약의 action 에는 draftId 가 없고 서버 발행도 확인되지 않아, 어떤 이벤트도 "이 초안의 성공"을
 * 보장하지 못한다 → 성공(settled)으로 표시하지 않고, 결과를 확인할 수 없으면 같은 초안을 다시 승인하지 못한다.
 */
describe("useChat — 초안별 승인 상태 (I-5 · I-7)", () => {
  const createDraft: SellerDraft = { draftId: "d-create", op: "create", productId: null, changes: [], summary: "" };
  const updateDraft: SellerDraft = { draftId: "d-update", op: "update", productId: "7", changes: [], summary: "" };
  const deleteDraft: SellerDraft = { draftId: "d-delete", op: "delete", productId: "7", changes: [], summary: "" };
  const CONFIRM_MESSAGE =
    "요청이 처리됐는지 확인하지 못했어요. 상품 목록에서 반영 여부를 확인한 뒤 다시 진행해 주세요.";

  function seed(...drafts: SellerDraft[]) {
    useChatStore.setState({
      results: drafts.map((draft) => ({ kind: "draft" as const, draft })),
      messages: [
        { id: "u", role: "user", text: "초안 만들어 줘" },
        { id: "a", role: "assistant", text: "초안입니다" },
      ],
    });
  }
  const resultOf = (draftId: string) =>
    state().results.find((r) => r.kind === "draft" && r.draft.draftId === draftId) as
      | Extract<ChatResult, { kind: "draft" }>
      | undefined;
  const unresolvedIds = () => state().unresolvedApprovals.map((u) => u.draftId);
  const updated = (productId: string) =>
    frame("action", { type: "PRODUCT_UPDATED", message: "처리됐어요", productId });

  it.each([
    ["등록", createDraft, "1"],
    ["수정", updateDraft, "7"],
    ["삭제", deleteDraft, "7"],
  ] as const)(
    "[I-5] %s 승인은 진행 중 pending 이고, 성공 action 을 받아도 성공으로 확정하지 않는다 — 이벤트가 이 초안을 보장하지 못한다",
    async (_label, draft, productId) => {
      seed(draft);
      const stream = openStream();
      replies.push(stream.reply);
      const { result } = setup({ channel: "SELLER" });

      act(() => {
        void result.current.confirm(draft.draftId);
      });
      expect(resultOf(draft.draftId)?.approval).toBe("pending");

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      stream.push(updated(productId));
      stream.push(frame("done", { finishReason: "stop", panel: "refresh" }));
      stream.close();
      await waitFor(() => expect(state().isStreaming).toBe(false));

      expect(resultOf(draft.draftId)).toMatchObject({ approval: "closed" });
      expect(resultOf(draft.draftId)?.settled).toBeUndefined();
      expect(unresolvedIds()).toEqual([draft.draftId]);
      expect(lastMessage().text).toContain("처리됐어요"); // 서버 문구는 그대로 보인다
    },
  );

  it("[I-5] 요청을 보내기 전에 실패하면 상태를 지워 다시 승인할 수 있다", async () => {
    seed(updateDraft);
    vi.mocked(ensureSession).mockRejectedValueOnce(
      new ApiError({ code: "INTERNAL", message: "" }, 500),
    );
    replies.push(sse(DONE));
    const { result } = setup({ channel: "SELLER" });

    await act(() => result.current.confirm("d-update"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(resultOf("d-update")?.approval).toBeUndefined();
    expect(unresolvedIds()).toEqual([]);

    await act(() => result.current.confirm("d-update"));
    expect(requestBody(0)).toMatchObject({ action: "confirm", draftId: "d-update" });
  });

  it.each([
    ["500", () => rejected(500)],
    ["401", () => rejected(401)],
    ["끊김", () => sse(token("처리 중"))],
    ["SSE error", () => sse(frame("error", { code: "INTERNAL", message: "", retryable: true }))],
  ])(
    "[I-5] 요청을 보낸 뒤 실패하면(%s) unknown 이고, 같은 초안은 다시 승인되지 않는다",
    async (_label, failure) => {
      seed(updateDraft);
      replies.push(failure(), sse(DONE));
      const { result } = setup({ channel: "SELLER" });

      await act(() => result.current.confirm("d-update"));
      expect(resultOf("d-update")?.approval).toBe("unknown");
      expect(unresolvedIds()).toEqual(["d-update"]);

      await act(async () => {
        await result.current.confirm("d-update");
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("[I-5] 요청을 보낸 뒤 네트워크 오류로 실패해도 unknown 이다", async () => {
    seed(updateDraft);
    const { result } = setup({ channel: "SELLER" });
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("Failed to fetch");
    });

    await act(() => result.current.confirm("d-update"));

    expect(resultOf("d-update")?.approval).toBe("unknown");
  });

  it.each([
    ["keep", { finishReason: "stop", panel: "keep" }],
    ["refresh", { finishReason: "stop", panel: "refresh" }],
    ["패널 없음", { finishReason: "stop" }],
  ])(
    "[I-5] action 없이 정상 종료(%s)하면 closed 다 — 성공으로 표시하지 않고 다시 승인되지 않는다",
    async (_label, done) => {
      seed(createDraft);
      replies.push(sse(token("이미 처리된 승인 요청입니다"), frame("done", done)), sse(DONE));
      const { result } = setup({ channel: "SELLER" });

      await act(() => result.current.confirm("d-create"));

      expect(resultOf("d-create")?.approval).toBe("closed");
      expect(resultOf("d-create")?.settled).toBeUndefined();
      expect(lastMessage().error).toBeUndefined();
      expect(unresolvedIds()).toEqual(["d-create"]);

      await act(async () => {
        await result.current.confirm("d-create");
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("[I-5] 결과 action 뒤에 error 가 와도 서버 오류 문구를 '확인하지 못했어요'로 덮지 않고, 성공으로 표시하지도 않는다", async () => {
    seed(createDraft);
    replies.push(
      sse(updated("1"), frame("error", { code: "INTERNAL", message: "", retryable: true })),
    );
    const { result } = setup({ channel: "SELLER" });

    await act(() => result.current.confirm("d-create"));

    expect(lastMessage().error).toBeDefined();
    expect(lastMessage().error).not.toBe(CONFIRM_MESSAGE);
    expect(lastMessage()).toMatchObject({ retryable: false });
    expect(lastMessage().resend).toBeUndefined();
    expect(resultOf("d-create")?.approval).toBe("closed");
    expect(resultOf("d-create")?.settled).toBeUndefined();
  });

  it("[I-5] 서버가 실패 action 을 보내면 rejected 이고 문구를 남기며, 미해결로 세지 않고 다시 승인되지 않는다", async () => {
    seed(updateDraft);
    replies.push(
      sse(
        frame("action", { type: "PRODUCT_UPDATE_FAILED", message: "반영하지 못했어요", productId: "7" }),
        frame("done", { finishReason: "stop", panel: "keep" }),
      ),
      sse(DONE),
    );
    const { result } = setup({ channel: "SELLER" });

    await act(() => result.current.confirm("d-update"));

    expect(resultOf("d-update")).toMatchObject({
      approval: "rejected",
      approvalMessage: "반영하지 못했어요",
    });
    expect(resultOf("d-update")?.settled).toBeUndefined();
    expect(unresolvedIds()).toEqual([]);

    await act(async () => {
      await result.current.confirm("d-update");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("[I-7] 일반 턴에서 온 다른 상품의 성공 action 은 등록 초안을 바꾸지 않는다", async () => {
    seed(createDraft);
    replies.push(sse(updated("999"), DONE));
    const { result } = setup({ channel: "SELLER" });

    await act(() => result.current.send("다른 질문"));

    expect(resultOf("d-create")?.approval).toBeUndefined();
    expect(resultOf("d-create")?.settled).toBeUndefined();
    expect(unresolvedIds()).toEqual([]);
  });

  it("[I-7] 초안이 둘일 때 승인 턴의 결과는 승인한 초안에만 기록된다", async () => {
    seed(createDraft, updateDraft);
    replies.push(sse(updated("999"), DONE));
    const { result } = setup({ channel: "SELLER" });

    await act(() => result.current.confirm("d-update"));

    expect(resultOf("d-update")?.approval).toBe("closed");
    expect(resultOf("d-create")?.approval).toBeUndefined();
    expect(resultOf("d-create")?.settled).toBeUndefined();
  });

  it("[I-5] 같은 초안을 연달아 눌러도 승인 요청은 한 번만 나간다", async () => {
    seed(updateDraft);
    const stream = openStream();
    replies.push(stream.reply);
    const { result } = setup({ channel: "SELLER" });

    act(() => {
      void result.current.confirm("d-update");
      void result.current.confirm("d-update");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    stream.push(DONE);
    stream.close();
    await waitFor(() => expect(state().isStreaming).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state().messages.filter((m) => m.role === "assistant")).toHaveLength(2);
  });

  it("[I-5] 다른 초안의 승인이 진행 중이면 이 초안은 상태가 바뀌지 않고, 끝난 뒤 독립적으로 승인된다", async () => {
    seed(createDraft, updateDraft);
    const stream = openStream();
    replies.push(stream.reply, rejected(500));
    const { result } = setup({ channel: "SELLER" });

    act(() => {
      void result.current.confirm("d-create");
    });
    act(() => {
      void result.current.confirm("d-update");
    });
    expect(resultOf("d-update")?.approval).toBeUndefined();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    stream.push(frame("done", { finishReason: "stop", panel: "keep" }));
    stream.close();
    await waitFor(() => expect(state().isStreaming).toBe(false));
    expect(resultOf("d-create")?.approval).toBe("closed");
    expect(resultOf("d-update")?.approval).toBeUndefined();

    await act(() => result.current.confirm("d-update"));

    expect(requestBody(1)).toMatchObject({ draftId: "d-update" });
    expect(resultOf("d-update")?.approval).toBe("unknown");
    expect(resultOf("d-create")?.approval).toBe("closed");
  });

  it("[I-5] 요청을 보낸 뒤 새 대화를 시작하면 초안은 사라져도 미해결 기록은 남는다 — 처리 여부가 확인된 게 아니다", async () => {
    seed(updateDraft);
    const stream = openStream();
    replies.push(stream.reply);
    const { result } = setup({ channel: "SELLER" });
    act(() => {
      void result.current.confirm("d-update");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => result.current.startNewChat());
    await new Promise((r) => setTimeout(r, 20));

    expect(state().results).toEqual([]);
    expect(state().messages).toEqual([]);
    expect(unresolvedIds()).toEqual(["d-update"]);
  });

  it("[I-5] 요청을 보내기 전에 새 대화로 멈춘 승인은 미해결로 남기지 않는다", async () => {
    seed(updateDraft);
    let resolveTicket!: (s: ChatSession) => void;
    vi.mocked(ensureSession).mockReturnValueOnce(
      new Promise((r) => {
        resolveTicket = r;
      }),
    );
    const { result } = setup({ channel: "SELLER" });
    act(() => {
      void result.current.confirm("d-update");
    });

    act(() => result.current.startNewChat());
    resolveTicket(session());
    await new Promise((r) => setTimeout(r, 20));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(unresolvedIds()).toEqual([]);
  });

  it("[I-5] 승인 중 화면을 떠나면 unknown 으로 남고, 재진입의 새 대화 뒤에도 미해결 기록은 유지된다", async () => {
    seed(updateDraft);
    const stream = openStream();
    replies.push(stream.reply);
    const first = setup({ channel: "SELLER" });
    act(() => {
      void first.result.current.confirm("d-update");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    first.unmount();
    await waitFor(() => expect(state().isStreaming).toBe(false));
    expect(resultOf("d-update")?.approval).toBe("unknown");

    const second = setup({ channel: "SELLER" });
    act(() => second.result.current.startNewChat());
    expect(unresolvedIds()).toEqual(["d-update"]);
  });

  it("[I-5] 초안과 무관한 질문이 실패해도 초안은 잠기지 않는다 — 말풍선이 아니라 초안 상태로 판단한다", async () => {
    seed(updateDraft);
    replies.push(rejected(500), sse(DONE));
    const { result } = setup({ channel: "SELLER" });

    await act(() => result.current.send("오늘 주문 몇 건이야?"));
    expect(lastMessage().error).toBeDefined(); // 전제 — 마지막 말풍선은 실패

    expect(resultOf("d-update")?.approval).toBeUndefined();
    expect(unresolvedIds()).toEqual([]);
    await act(() => result.current.confirm("d-update"));
    expect(requestBody(1)).toMatchObject({ action: "confirm", draftId: "d-update" });
  });

  it("[I-5] 미해결 기록에는 소유자가 남는다", async () => {
    useAuthStore.setState({ user: { id: "seller-a" } as never });
    seed(updateDraft);
    replies.push(rejected(500));
    const { result } = setup({ channel: "SELLER" });

    await act(() => result.current.confirm("d-update"));

    expect(state().unresolvedApprovals).toEqual([
      { draftId: "d-update", op: "update", productId: "7", ownerId: "seller-a" },
    ]);
  });
});
