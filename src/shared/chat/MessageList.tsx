"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "./store";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  /** 진행 상태 문구(progress 이벤트, 구매자·판매자 공용). 답변 전 로딩 표시용 */
  progress?: string | null;
  onRetry: () => void;
}

function TypingIndicator() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="입력 중">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

export function MessageList({
  messages,
  isStreaming,
  progress,
  onRetry,
}: MessageListProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* 비휴지 안내는 대화 시작 전에만 — 대화가 시작되면 공간을 비워 대화에 집중 */}
      {messages.length === 0 && (
        <p className="text-xs text-muted-foreground">
          · 이 대화는 이 탭에서만 유지돼요 · 탭을 닫으면 사라집니다
        </p>
      )}

      {messages.map((msg, i) => {
        const isLast = i === messages.length - 1;
        const showTyping =
          isStreaming && isLast && msg.role === "assistant" && !msg.text;

        return msg.role === "user" ? (
          <div
            key={msg.id}
            className="flex animate-in items-start justify-end gap-2 duration-300 fade-in slide-in-from-bottom-2 slide-in-from-right-2"
          >
            <span className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm leading-relaxed tracking-tight text-primary-foreground">
              {msg.text}
            </span>
            <Avatar />
          </div>
        ) : (
          <div
            key={msg.id}
            className="flex animate-in items-start gap-2 duration-300 fade-in slide-in-from-bottom-2 slide-in-from-left-2"
          >
            <Avatar />
            {msg.error ? (
              <div className="flex max-w-[80%] flex-col items-start gap-2 rounded-2xl rounded-tl-sm bg-destructive/10 px-4 py-2.5">
                <span className="text-sm text-destructive">{msg.error}</span>
                {/* 재시도해도 같은 결과가 뻔한 실패(권한·과다 요청 등)에는 버튼을 주지 않는다 —
                    누를수록 상황이 나빠지거나 무의미하다. 판단은 서버 retryable 을 따른다. */}
                {msg.retryable !== false && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-full border border-destructive/30 px-3 py-1 text-sm text-destructive transition-all hover:bg-destructive/10 active:scale-95"
                  >
                    다시 시도
                  </button>
                )}
                {/* 문의 시 서버 로그에서 이 요청을 찾는 키. 눈에 띄지 않게 두되
                    사용자가 복사해 전달할 수 있어야 한다. */}
                {msg.requestId && (
                  <span className="select-all text-[11px] text-destructive/60">
                    오류 코드 {msg.requestId}
                  </span>
                )}
              </div>
            ) : (
              <span
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed",
                  showTyping && "py-3",
                )}
              >
                {showTyping ? (
                  // 진행 텍스트(analysis progress)가 있으면 로딩 문구로, 없으면 점 애니메이션
                  progress ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <TypingIndicator />
                      {progress}
                    </span>
                  ) : (
                    <TypingIndicator />
                  )
                ) : (
                  msg.text
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Avatar() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      J
    </span>
  );
}
