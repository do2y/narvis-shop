import { BarChart3, Plus, X } from "lucide-react";
import { ChatConversation } from "@/shared/chat/ChatConversation";
import { SuggestedQuestions } from "@/shared/chat/SuggestedQuestions";
import { useChatStore } from "@/shared/chat/store";
import { useScreenContext } from "../useScreenContext";

// 화면별 추천 질문 — 지금 보는 목록에서 바로 물어볼 만한 것
const QUESTIONS: Record<string, string[]> = {
  "/seller": ["이번주 판매 전략 알려줘", "재고 부족 상품 정리해줘"],
  "/seller/orders": ["이 주문들 왜 늘었어?", "오늘 발송할 주문 정리해줘"],
  "/seller/products": ["전환율 낮은 상품 진단해줘", "재고 부족 상품 정리해줘"],
};

interface SellerChatPanelProps {
  /** 셸이 잡은 useChat — 결과가 본문에 렌더되므로 send를 공유해야 한다 */
  chat: { retry: () => void; startNewChat: () => void; isStreaming: boolean };
  onSend: (message: string) => void;
  onClose: () => void;
  /** 결과를 접어두고 목록을 보는 중일 때만 전달됨 — 결과로 되돌아가는 길 */
  onShowResults?: () => void;
  /** 모바일 전용 — 오버레이가 본문을 덮어 결과를 보여줄 곳이 여기뿐 */
  mobileResults?: React.ReactNode;
}

/**
 * 목록을 보면서 대화하는 사이드 채팅 — 대화만 담당.
 * 결과(차트·표·diff)는 넓은 본문 영역이 렌더한다(좁은 패널에선 차트가 읽히지 않음).
 * 전체 화면 챗봇(/seller/chat)과 같은 스토어를 쓰므로 대화가 이어진다.
 */
export function SellerChatPanel({
  chat,
  onSend,
  onClose,
  onShowResults,
  mobileResults,
}: SellerChatPanelProps) {
  const { screen } = useScreenContext();
  const messages = useChatStore((s) => s.messages);
  const suggestions = QUESTIONS[screen.path] ?? QUESTIONS["/seller"];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 지금 어떤 화면을 보며 대화 중인지 — AI에 전달되는 맥락을 사용자에게도 보여줌 */}
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{screen.label}</span>
          {screen.filters?.["상태"] && screen.filters["상태"] !== "전체" && (
            <> · {screen.filters["상태"]}</>
          )}
          <> 화면을 보는 중</>
        </span>

        <div className="flex shrink-0 items-center gap-1">
          {/* 결과를 접어둔 상태 — 대화의 산출물이므로 되돌아가는 길도 대화 옆에 둔다 */}
          {onShowResults && (
            <button
              type="button"
              onClick={onShowResults}
              className="flex h-7 items-center gap-1 rounded-full border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
            >
              <BarChart3 className="size-3" />
              결과 보기
            </button>
          )}
          <button
            type="button"
            onClick={chat.startNewChat}
            aria-label="새 대화"
            title="새 대화"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="채팅 닫기"
            title="채팅 닫기"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <ChatConversation
        onSend={onSend}
        onRetry={chat.retry}
        isStreaming={chat.isStreaming}
        placeholder="이 화면에 대해 물어보세요."
        aboveInput={
          messages.length === 0 ? (
            <SuggestedQuestions
              questions={suggestions}
              onSelect={onSend}
              disabled={chat.isStreaming}
            />
          ) : null
        }
      />

      {/* 모바일에서만 — 데스크탑은 본문 영역이 결과를 맡는다 */}
      {mobileResults && (
        <div className="max-h-[45%] shrink-0 overflow-y-auto border-t bg-muted/30">
          {mobileResults}
        </div>
      )}
    </div>
  );
}
