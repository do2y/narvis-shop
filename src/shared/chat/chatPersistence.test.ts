import { beforeEach, describe, expect, it } from "vitest";
import { clearChat, loadChat, saveChat } from "./chatPersistence";
import type { ChatMessage } from "./store";

const messages: ChatMessage[] = [
  { id: "1", role: "user", text: "안녕" },
  { id: "2", role: "assistant", text: "안녕하세요" },
];

/**
 * 대화 보관 — 같은 탭 새로고침으로 대화가 돌아와야 한다.
 *
 * 회귀 방지 대상: 저장소를 sessionStorage 로 잡은 건 서버 맥락 TTL(10분)과
 * 어긋나는 구간을 줄이기 위해서다. localStorage 로 옮기면 탭을 닫아도 남아
 * "화면엔 대화가 있는데 AI 는 기억 못 하는" 상태가 길어진다.
 */
describe("chatPersistence", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("저장한 대화를 그대로 복원한다", () => {
    saveChat({ messages, sessionId: "s1", results: [] });

    const loaded = loadChat();
    expect(loaded?.messages).toEqual(messages);
    expect(loaded?.sessionId).toBe("s1");
  });

  it("탭 단위 저장소(sessionStorage)를 쓴다 — 탭을 닫으면 사라져야 한다", () => {
    saveChat({ messages, sessionId: "s1", results: [] });

    expect(sessionStorage.getItem("chat:session")).not.toBeNull();
    expect(localStorage.getItem("chat:session")).toBeNull();
  });

  it("읽어도 지우지 않는다 — 새로고침이 반복돼도 계속 복원돼야 한다", () => {
    saveChat({ messages, sessionId: "s1", results: [] });

    expect(loadChat()?.messages).toHaveLength(2);
    expect(loadChat()?.messages).toHaveLength(2);
  });

  it("빈 대화는 저장하지 않는다 — 다른 탭이 시작한 대화를 덮어쓰지 않게", () => {
    saveChat({ messages, sessionId: "s1", results: [] });
    saveChat({ messages: [], sessionId: null, results: [] });

    expect(loadChat()?.messages).toEqual(messages);
  });

  it("형태가 깨진 값은 없는 것으로 친다(구버전 키·수동 편집)", () => {
    sessionStorage.setItem("chat:session", "{{ not json");
    expect(loadChat()).toBeNull();
  });

  it("새 대화는 저장소를 비운다", () => {
    saveChat({ messages, sessionId: "s1", results: [] });
    clearChat();
    expect(loadChat()).toBeNull();
  });

  /**
   * 승계 실패 재시도 대상은 sessionId 와 따로 보관한다.
   * 실패 시 sessionId 는 null 이어야 하지만(구 게스트 티켓으로 스트림을 열면
   * AI 가 403 으로 막는다) 재시도하려면 그 값을 알아야 하기 때문이다.
   */
  it("승계 실패 sessionId 는 sessionId 와 별도로 살아남는다", () => {
    saveChat({
      messages,
      sessionId: null,
      results: [],
      claimFailedSessionId: "guest-1",
    });

    const loaded = loadChat();
    expect(loaded?.sessionId).toBeNull();
    expect(loaded?.claimFailedSessionId).toBe("guest-1");
  });
});
