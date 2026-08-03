"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Plus } from "lucide-react";
import { ChatLayout } from "@/shared/chat/ChatLayout";
import { useChatStore } from "@/shared/chat/store";
import { useChat } from "@/shared/chat/useChat";
import { useChatPersistence } from "@/shared/chat/useChatPersistence";
import { useScreenContext } from "./useScreenContext";
import { AppHeader } from "@/shared/ui/AppHeader";
import { fetchPopularAsCards } from "./api";
import { ConditionChips } from "./components/ConditionChips";
import { ProductPanel } from "./components/ProductPanel";
import { SuggestionChips } from "./components/SuggestionChips";

export default function ChatPage() {
  const queryClient = useQueryClient();

  // 홈에서 넘어온 첫 질문(?q=)을 한 번만 처리했는지 표시.
  // useSearchParams를 쓰지 않는 이유: 그 훅은 이 컴포넌트를 Suspense 경계에 묶어
  // SSR에서 화면 전체(헤더 포함)가 비워진다. 마운트 후 window에서 직접 읽는다.
  const sentInitialQuery = useRef(false);

  // 대화를 탭에 살려 둔다 — 새로고침·탭 복구로 돌아온다.
  // 아래 ?q= 이펙트보다 먼저 선언해 복원이 앞서게 한다(홈에서 온 새 질문은
  // startNewChat 이 저장소까지 비우므로 복원분과 섞이지 않는다).
  useChatPersistence();

  const { messages, results, setResults, conditions, suggestions } =
    useChatStore();
  const hasResults = results.length > 0;

  // 전송 시점의 우측 패널을 실어 "이거 담아줘" 같은 지시어를 AI 가 풀 수 있게 한다.
  // 인기상품만 대상이다 — 추천 카드는 서버가 listId 로 이미 안다(계약 CH-2 §screen).
  const getScreenContext = useScreenContext(results);

  const { send, retry, removeCondition, applySuggestion, startNewChat, isStreaming } =
    useChat({
      channel: "SHOPPING",
      getScreenContext,
      // 챗봇 장바구니 담기 → 헤더 뱃지 전역 동기화 (CLAUDE.md)
      onAction: (action) => {
        if (action.type === "CART_ADDED") {
          queryClient.invalidateQueries({ queryKey: ["cart"] });
        }
      },
    });

  // 초기 인기상품 — 명세(P-4)에 카테고리 필터가 없어 항상 전체 인기상품이다.
  // (카테고리별로 보여주려면 백엔드에 categoryId 파라미터 추가가 선행되어야 함)
  const { data: popularCards } = useQuery({
    queryKey: ["chat", "popular"],
    queryFn: () => fetchPopularAsCards(),
    staleTime: 30 * 60 * 1000,
  });

  const popularTitle = "지금 인기 상품";

  // 대화 시작 전(메시지 없음)에는 인기상품을 표시.
  // hasResults에 의존해야 "새 대화"로 패널이 비워졌을 때도 다시 시딩된다
  // (messages.length는 새 대화 전후 모두 0이라 deps가 변하지 않음).
  useEffect(() => {
    if (messages.length === 0 && !hasResults && popularCards?.length) {
      setResults([
        {
          kind: "products",
          groups: [{ title: popularTitle, items: popularCards }],
        },
      ]);
    }
  }, [messages.length, hasResults, popularCards, popularTitle, setResults]);

  // 홈에서 넘어온 첫 메시지(?q=)는 "새 질문" → 기존 대화 초기화 후 시작.
  // 마운트 시 1회만 실행한다(ref 가드) — StrictMode의 이펙트 2회 실행과
  // 리렌더에 의한 중복 전송을 함께 막는다.
  //
  // 처리 후 q를 URL에서 지운다 — 새로고침하면 같은 질문이 다시 전송되기 때문.
  // history.replaceState를 쓰는 이유: router.replace는 라우트 이동이라 이 시점에
  // 부르면 방금 시작한 스트리밍이 끊긴다. 주소창만 정리하면 되므로 History API가 맞다.
  useEffect(() => {
    if (sentInitialQuery.current) return;

    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (!q) return;

    sentInitialQuery.current = true;
    startNewChat();
    send(q);

    params.delete("q");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/chat?${qs}` : "/chat");
    // 마운트 시 1회 — send/startNewChat은 매 렌더 재생성되므로 의존성에 넣지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ChatLayout
      onSend={send}
      onRetry={retry}
      isStreaming={isStreaming}
      /* "새 대화"는 헤더 로고 옆에 — 대화 영역을 차지하지 않게(기존 배치 유지) */
      header={
        <AppHeader
          leftSlot={
            <button
              type="button"
              onClick={startNewChat}
              className="flex items-center gap-1 border-l pl-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-95"
            >
              <Plus className="size-4" />새 대화
            </button>
          }
        />
      }
      /* AI 추출 조건 칩(제거 가능) + 완화·되돌리기 제안 칩. 스트리밍 중엔 왕복 비활성 */
      aboveInput={
        (conditions.length > 0 || suggestions.length > 0) && (
          <div className="flex flex-col gap-2">
            <ConditionChips
              conditions={conditions}
              onRemove={removeCondition}
              disabled={isStreaming}
            />
            <SuggestionChips
              suggestions={suggestions}
              onApply={applySuggestion}
              disabled={isStreaming}
            />
          </div>
        )
      }
      resultPanel={<ProductPanel results={results} isStreaming={isStreaming} />}
    />
  );
}
