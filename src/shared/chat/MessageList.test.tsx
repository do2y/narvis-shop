import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageList } from "./MessageList";
import type { ChatMessage } from "./store";

/**
 * 재시도 버튼 노출 — 결함 B4 의 UI 쪽 방어.
 *
 * 종전엔 실패 말풍선마다 버튼이 있었고 모두 대상 없이 같은 retry() 를 불렀다.
 * 그래서 위쪽 실패 말풍선을 누르면 그 질문이 아니라 마지막 질문이 다시 나갔다.
 * 재시도는 마지막 실패 턴에만 허용하고, 위쪽 실패는 사실만 남긴다(개발자 결정 2026-10-31).
 */

afterEach(cleanup);

const user = (id: string, text: string): ChatMessage => ({
  id,
  role: "user",
  text,
});
const failed = (id: string, error: string, retryable = true): ChatMessage => ({
  id,
  role: "assistant",
  text: "",
  error,
  retryable,
});
const answered = (id: string, text: string): ChatMessage => ({
  id,
  role: "assistant",
  text,
});

const retryButtons = () => screen.queryAllByRole("button", { name: "다시 시도" });

describe("MessageList — 재시도 버튼", () => {
  it("[MessageList] 마지막 실패 말풍선에만 버튼을 그리고, 누르면 그 말풍선의 id 를 넘긴다", () => {
    const onRetry = vi.fn();
    render(
      <MessageList
        messages={[
          user("u1", "첫 질문"),
          failed("a1", "첫 실패"),
          user("u2", "둘째 질문"),
          failed("a2", "둘째 실패"),
        ]}
        isStreaming={false}
        onRetry={onRetry}
      />,
    );

    expect(retryButtons()).toHaveLength(1);
    fireEvent.click(retryButtons()[0]);
    expect(onRetry).toHaveBeenCalledWith("a2");
  });

  it("[MessageList] 위쪽 실패 말풍선은 버튼 없이 실패 문구를 그대로 보여준다", () => {
    render(
      <MessageList
        messages={[
          user("u1", "첫 질문"),
          failed("a1", "첫 실패"),
          user("u2", "둘째 질문"),
          answered("a2", "둘째 답"),
        ]}
        isStreaming={false}
        onRetry={vi.fn()}
      />,
    );

    expect(retryButtons()).toHaveLength(0);
    expect(screen.getByText("첫 실패")).toBeTruthy();
  });

  it("[MessageList] 재시도해도 같은 결과인 실패(retryable:false)는 마지막이어도 버튼이 없다", () => {
    render(
      <MessageList
        messages={[user("u1", "질문"), failed("a1", "권한 없음", false)]}
        isStreaming={false}
        onRetry={vi.fn()}
      />,
    );

    expect(retryButtons()).toHaveLength(0);
    expect(screen.getByText("권한 없음")).toBeTruthy();
  });
});
