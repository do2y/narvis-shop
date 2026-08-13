"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { useChatStore } from "./store";

interface ChatConversationProps {
  onSend: (message: string, imageUrls?: string[]) => void;
  onRetry: () => void;
  isStreaming: boolean;
  placeholder?: string;
  /** 이미지 첨부 허용(판매자 상품 등록). 구매자 챗은 쓸 곳이 없어 기본 꺼짐 */
  allowImage?: boolean;
  /** 대화 입력창 위 영역(조건 칩·추천 질문 등) — 채널별 주입 */
  aboveInput?: React.ReactNode;
  /**
   * 대화 영역 상단 바 — 없으면 렌더하지 않는다.
   * "새 대화" 버튼 위치가 화면마다 달라서(사용자 챗봇은 헤더) 부모가 정한다.
   */
  headerSlot?: React.ReactNode;
  /**
   * 메시지 목록 위 고정 안내(승계 실패 배너 등) — 스크롤과 함께 밀리지 않는다.
   * 채널별로 필요 여부가 달라 부모가 주입한다.
   */
  noticeSlot?: React.ReactNode;
  showUserAvatar?: boolean;
  className?: string;
  scrollAreaClassName?: string;
  inputAreaClassName?: string;
  aboveInputClassName?: string;
  onInputFocus?: () => void;
  onInputAreaPointerDown?: () => void;
}

/**
 * 대화 컬럼 — 메시지 목록 + 입력창.
 * 전체 화면(ChatLayout)과 사이드 패널이 이걸 공유한다. 배치는 부모가 정한다.
 */
export function ChatConversation({
  onSend,
  onRetry,
  isStreaming,
  placeholder,
  allowImage,
  aboveInput,
  headerSlot,
  noticeSlot,
  showUserAvatar = true,
  className,
  scrollAreaClassName,
  inputAreaClassName,
  aboveInputClassName,
  onInputFocus,
  onInputAreaPointerDown,
}: ChatConversationProps) {
  const messages = useChatStore((s) => s.messages);
  // 분석 진행 상태(판매자) — 최종 답변(token) 전 로딩 텍스트로 표시, token 오면 소멸
  const progress = useChatStore((s) => s.progress);

  // 새 메시지·스트리밍·진행 표시 변화 시 대화 영역 하단으로 스크롤
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isStreaming, progress]);


  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      {headerSlot}

      {/* 대화 영역과 그 위에 떠 있는 안내를 겹치기 위한 기준면 —
          안내는 흐름을 밀어내지 않고 얹힌다(§12 floating layer) */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className={cn(
            // pb 를 키운다 — 마지막 말풍선이 입력창 경계에 딱 붙으면 잘린 것처럼
            // 보이고, 스트리밍으로 줄이 늘 때 읽을 여유가 없다.
            "min-h-0 flex-1 overflow-y-auto p-4 pb-8 sm:p-6 sm:pb-10",
            scrollAreaClassName,
          )}
        >
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            progress={progress}
            showUserAvatar={showUserAvatar}
            onRetry={onRetry}
          />
        </div>

        {/* 안내는 대화를 가린 채 덮는다 — 미해결 동안은 전송이 막혀 있어
            뒤의 대화가 지금 손댈 수 있는 상태가 아니다. 나란히 두면 공존하는
            것처럼 보이지만 실제로는 결정을 먼저 해야 하는 관문이다(§12 dim to focus). */}
        <div className="absolute inset-x-0 top-0">{noticeSlot}</div>
      </div>

      <div
        className={cn(
          "shrink-0 flex min-w-0 flex-col gap-3 border-t p-4",
          // iOS 홈 인디케이터 영역만큼 아래를 더 띄운다 — 없으면 전송 버튼이
          // 제스처 바에 닿아 눌리지 않는다. 지원하지 않는 브라우저에선 0 이다.
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
          inputAreaClassName,
        )}
        onPointerDown={onInputAreaPointerDown}
      >
        {/* 입력창과의 간격은 여기서 준다(바깥 gap-3 보다 넓게) — 붙어 있으면
            추천 질문과 입력창이 하나의 큰 버튼 묶음처럼 읽힌다.
            aboveInputClassName 을 준 화면(구매자)은 그쪽 값이 이긴다. */}
        {/* min-w-0 이 없으면 flex 자식의 기본 min-width:auto 때문에 이 칸이 내용
            (칩 4개)의 고유 너비만큼 벌어진다. 그러면 안쪽 overflow-x-auto 가
            넘칠 것이 없어 스크롤이 아예 생기지 않는다. */}
        {aboveInput ? (
          <div className={cn("min-w-0", aboveInputClassName ?? "mb-1")}>
            {aboveInput}
          </div>
        ) : null}
        <ChatInput
          onSend={onSend}
          disabled={isStreaming}
          placeholder={placeholder}
          allowImage={allowImage}
          onFocus={onInputFocus}
        />
      </div>
    </div>
  );
}
