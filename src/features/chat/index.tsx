"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ChatLayout } from "@/shared/chat/ChatLayout";
import { NewChatButton } from "@/shared/chat/NewChatButton";
import { ClaimFailureBanner } from "@/shared/chat/ClaimFailureBanner";
import {
  dismissClaimFailure,
  retryClaimChatSession,
} from "@/shared/chat/claimOnLogin";
import { useChatStore } from "@/shared/chat/store";
import { useChat } from "@/shared/chat/useChat";
import { useChatPersistence } from "@/shared/chat/useChatPersistence";
import {
  isCartMutatingAction,
  isWishlistMutatingAction,
} from "@/shared/types/chat";
import { useScreenContext } from "./useScreenContext";
import { AppHeader } from "@/shared/ui/AppHeader";
import { fetchPopularAsCards } from "./api";
import { shouldSeedPopular } from "./popularSeed";
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

  // 필드별 선택자로 구독한다 — useChatStore() 를 통째로 구조분해하면 스토어 전체를
  // 구독해 token 마다 갱신되는 messages 까지 걸리고, 이 페이지가 매 토큰 리렌더된다.
  // (대화 말풍선은 ChatConversation 이 messages 를 따로 구독해 그린다.)
  const results = useChatStore((s) => s.results);
  const conditions = useChatStore((s) => s.conditions);
  const suggestions = useChatStore((s) => s.suggestions);
  const setResults = useChatStore((s) => s.setResults);
  const hasResults = results.length > 0;

  // 전송 시점의 우측 패널을 실어 "이거 담아줘" 같은 지시어를 AI 가 풀 수 있게 한다.
  // 기준은 "인기상품이냐"가 아니라 "서버가 아직 모르는 목록이냐"다 —
  // 추천 카드는 서버가 listId 로 이미 안다(계약 CH-2 §screen).
  // screen 은 현재 보이는 패널 자체를 뜻한다. 추천 카드만 떠 있어도 columns 는 보내고,
  // products 는 서버가 아직 모르는 목록에만 싣는다.
  const getScreenContext = useScreenContext(results);

  const { send, retry, removeCondition, applySuggestion, startNewChat, isStreaming } =
    useChat({
      channel: "SHOPPING",
      getScreenContext,
      // 챗봇이 서버 상태를 바꾸면 해당 쿼리를 무효화한다 — 헤더 뱃지·목록 화면이
      // 같은 캐시를 보므로 여기서 한 번 무효화하면 전역이 따라온다 (CLAUDE.md).
      // 실패 액션은 서버 상태가 그대로라 재조회하지 않는다.
      onAction: (action) => {
        if (isCartMutatingAction(action)) {
          queryClient.invalidateQueries({ queryKey: ["cart"] });
        }
        // 찜 이벤트는 productId 를 싣지 않는다(경로 B) — type 만 보고 목록을 재조회한다.
        if (isWishlistMutatingAction(action)) {
          queryClient.invalidateQueries({ queryKey: ["wishlist"] });
        }
      },
    });

  // 초기 인기상품 — 명세(P-4)에 카테고리 필터가 없어 항상 전체 인기상품이다.
  // (카테고리별로 보여주려면 백엔드에 categoryId 파라미터 추가가 선행되어야 함)
  const { data: popularCards } = useQuery({
    queryKey: ["chat", "popular"],
    queryFn: () => fetchPopularAsCards(),
    // 홈과 같은 P-4 데이터 — 값이 다르면 두 화면의 인기상품이 어긋나 보인다 (CLAUDE.md 5분)
    staleTime: 5 * 60 * 1000,
  });

  const popularTitle = "지금 인기 상품";

  // 패널이 비면 인기상품으로 채운다 — 대화 시작 전이든, "안녕" 같은 일반 질문이라
  // 상품 결과가 없는 턴이 끝난 뒤든 우측을 빈 채로 두지 않는다.
  //
  // messages.length === 0 조건을 두지 않는 이유: 그 조건이 있으면 대화가 한 번
  // 시작된 뒤에는 영영 다시 시딩되지 않아, 추천 없는 턴마다 우측이 비어 버린다.
  //
  // 스트리밍 중에는 시딩하지 않는다 — 그 사이 인기상품을 꽂으면 (1) 결과 대기
  // 스켈레톤이 사라지고 (2) 곧 도착할 추천이 이걸 덮어 화면이 두 번 튄다.
  // 대신 isStreaming 이 의존성에 있어 스트림이 끝나는 순간 이펙트가 다시 돌고,
  // 그때까지도 결과가 없으면(= 추천 없는 턴) 인기상품이 채워진다.
  // 홈에서 ?q= 로 바로 들어온 경우가 이 경로다 — 마운트 직후 전송이 시작돼
  // 인기상품 응답이 스트리밍 중에 도착하므로, 종료 시점에 한 번 더 봐야 한다.
  useEffect(() => {
    if (
      popularCards &&
      shouldSeedPopular({
        hasResults,
        isStreaming,
        popularCount: popularCards.length,
      })
    ) {
      setResults([
        {
          kind: "products",
          groups: [{ title: popularTitle, items: popularCards }],
        },
      ]);
    }
  }, [hasResults, isStreaming, popularCards, popularTitle, setResults]);

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
      showUserAvatar={false}
      /* "새 대화"는 헤더 로고 옆에 — 대화 영역을 차지하지 않게(기존 배치 유지).
         판매자 챗(/seller/chat)도 같은 컴포넌트를 같은 자리에 쓴다 */
      header={<AppHeader leftSlot={<NewChatButton onClick={startNewChat} />} />}
      /* 로그인 승계 실패 안내 — 미해결이면 전송이 막히므로 여기서 진로를 고른다 */
      notice={
        <ClaimFailureBanner
          onRetry={() => {
            void retryClaimChatSession("SHOPPING");
          }}
          onContinue={dismissClaimFailure}
          onStartNew={startNewChat}
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
