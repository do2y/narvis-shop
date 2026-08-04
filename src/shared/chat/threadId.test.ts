import { beforeEach, describe, expect, it } from "vitest";
import { getThreadId, newThreadId } from "./threadId";

/**
 * thread_id — 대화 방(탭) 식별자.
 *
 * 회귀 방지 대상: sessionId 는 탭 간 공유되므로 방 구분은 이쪽이 맡는다.
 * threadId = sessionId 로 되돌리거나 저장소를 localStorage 로 옮기면
 * 여러 탭이 같은 방을 쓰게 되어 대화가 서로 덮인다.
 */
describe("threadId", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("같은 탭에서는 한 번 만든 방 id 를 계속 돌려준다", () => {
    const first = getThreadId("SHOPPING");
    expect(getThreadId("SHOPPING")).toBe(first);
  });

  it("탭 단위 저장소(sessionStorage)에 둔다 — localStorage 가 아니다", () => {
    const id = getThreadId("SHOPPING");
    expect(sessionStorage.getItem("jarvis:chat:thread:SHOPPING")).toBe(id);
    expect(localStorage.getItem("jarvis:chat:thread:SHOPPING")).toBeNull();
  });

  it("채널이 다르면 방도 다르다 — 구매자·판매자는 서로 다른 접속이다", () => {
    expect(getThreadId("SHOPPING")).not.toBe(getThreadId("SELLER"));
  });

  it("새 대화는 방만 새로 판다", () => {
    const before = getThreadId("SHOPPING");
    const after = newThreadId("SHOPPING");

    expect(after).not.toBe(before);
    // 새로 판 방이 곧바로 이 탭의 방으로 고정된다
    expect(getThreadId("SHOPPING")).toBe(after);
  });

  it("새 대화가 다른 채널의 방을 건드리지 않는다", () => {
    const seller = getThreadId("SELLER");
    newThreadId("SHOPPING");
    expect(getThreadId("SELLER")).toBe(seller);
  });
});
