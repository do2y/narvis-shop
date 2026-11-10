import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveChat } from "./chatPersistence";
import { useChatStore, type ChatMessage } from "./store";
import { useChatPersistence } from "./useChatPersistence";

/**
 * 대화 복원(T2-C3) — 응답 중으로 저장된 답변은 중단으로 복원하되, 살아 있는 턴은 덮어쓰지 않는다.
 *
 * 살아 있는 턴을 지켜야 하는 이유: 복원은 마운트마다 돈다. StrictMode 의 가짜 재마운트(?q= 로 막 시작한 전송)나
 * 카드 조회를 기다리는 턴이 있는 채로 화면에 돌아온 경우, 저장값으로 덮어쓰면 응답 중 말풍선이 "중단"이 된다.
 */

const saved = (messages: ChatMessage[]) =>
  saveChat({ messages, sessionId: "session-1", results: [] });

describe("useChatPersistence — 복원 정규화", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useChatStore.getState().reset();
  });
  afterEach(cleanup);

  it("응답 중으로 저장된 답변은 중단으로 복원한다 — 받은 텍스트는 남기고 error 는 두지 않는다", () => {
    saved([
      { id: "u", role: "user", text: "질문" },
      { id: "a", role: "assistant", text: "받은 데까지", status: "streaming" },
    ]);

    renderHook(() => useChatPersistence());

    const last = useChatStore.getState().messages.at(-1);
    expect(last).toMatchObject({ text: "받은 데까지", status: "interrupted" });
    expect(last?.error).toBeUndefined();
  });

  it("상태가 없는 이전 저장 형식은 그대로 복원한다 — 완료로 본다", () => {
    saved([
      { id: "u", role: "user", text: "질문" },
      { id: "a", role: "assistant", text: "이전 형식 답변" },
    ]);

    renderHook(() => useChatPersistence());

    expect(useChatStore.getState().messages.at(-1)?.status).toBeUndefined();
  });

  it("이 문서에서 응답 중인 턴이 살아 있으면 복원하지 않는다 — 스토어가 정본이다", () => {
    saved([
      { id: "u", role: "user", text: "질문" },
      { id: "a", role: "assistant", text: "저장된 일부", status: "streaming" },
    ]);
    const live: ChatMessage[] = [
      { id: "u", role: "user", text: "질문" },
      { id: "a", role: "assistant", text: "저장된 일부 이어서 받는 중", status: "streaming" },
    ];
    useChatStore.setState({ messages: live });
    useChatStore.getState().beginTurn("turn-1");

    renderHook(() => useChatPersistence());

    expect(useChatStore.getState().messages).toEqual(live);
    expect(useChatStore.getState().messages.at(-1)?.status).toBe("streaming");
  });

  it("복원을 건너뛰어도 이후 변경은 저장한다", () => {
    useChatStore.getState().beginTurn("turn-1");
    renderHook(() => useChatPersistence());

    useChatStore
      .getState()
      .addMessage({ id: "u", role: "user", text: "새 질문" });

    expect(sessionStorage.getItem("chat:session")).toContain("새 질문");
  });
});
