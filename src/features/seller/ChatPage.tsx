"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryParams } from "@/shared/hooks/useQueryParams";

import { useQueryClient } from "@tanstack/react-query";
import { ChatConversation } from "@/shared/chat/ChatConversation";
import { NewChatButton } from "@/shared/chat/NewChatButton";
import { SuggestedQuestions } from "@/shared/chat/SuggestedQuestions";
import { useChatStore } from "@/shared/chat/store";
import { useChat } from "@/shared/chat/useChat";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import { cn } from "@/lib/utils";
import type { SellerPanel } from "@/shared/types/chat";
import { SellerHeader } from "./components/SellerHeader";
import { SellerWorkspace } from "./components/SellerWorkspace";
import { useSellerScreenContext } from "./useSellerScreenContext";
import type {
  SellerOrderTab,
  SellerProductPage,
  SellerProductSort,
  SellerProductTab,
  SellerWorkspaceTab,
} from "./types";

// 주문·상품 관리 관련 추천 질문 — 첫 진입 시 사용법 안내 역할
const SELLER_QUESTIONS = [
  "이번주 판매 전략 알려줘",
  "전환율 낮은 상품 진단해줘",
  "재고 부족 상품 정리해줘",
  "오늘 주문 요약해줘",
];

// 모바일 3분할 대신 탭 전환(요청: 좁은 화면에서 세 영역 동시 표시 금지)
type MobileView = "chat" | SellerWorkspaceTab;

export default function SellerChatPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useQueryParams();
  const q = params.get("q");

  const [workspaceTab, setWorkspaceTab] =
    useState<SellerWorkspaceTab>("orders");
  // 우측 패널: 목록 vs AI 결과(diff). done.panel 과 draft 도착으로 전환된다.
  // 분석 로딩·리포트는 아래에서 파생으로 OR 하므로 여기엔 수동/draft 전환만 담는다.
  const [showResultsState, setShowResults] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("chat");

  // 목록 필터·페이지 — 워크스페이스가 아니라 여기서 들고 있다. 전송 시점에
  // "무엇이 어떤 필터로 떠 있는지"를 screen 으로 실어야 하기 때문이다(S-4).
  const [orderTab, setOrderTab] = useState<SellerOrderTab>("ALL");
  const [orderPage, setOrderPage] = useState(0);
  const [productTab, setProductTab] = useState<SellerProductTab>("ALL");
  const [productSort, setProductSort] = useState<SellerProductSort>("latest");
  const [productPage, setProductPage] = useState(0);

  // 화면에 그려진 상품 줄 — "1번 상품"의 근거. ProductList 와 같은 쿼리 키를 읽어
  // 재조회 없이 캐시에서 꺼낸다(키가 어긋나면 조용히 빈 배열이 되므로 주의).
  const visibleProducts = queryClient.getQueryData<SellerProductPage>([
    "seller",
    "products",
    { tab: productTab, sort: productSort, page: productPage },
  ]);

  const getScreenContext = useSellerScreenContext({
    tab: workspaceTab,
    orderTab,
    orderPage,
    productTab,
    productSort,
    productPage,
    products: (visibleProducts?.content ?? []).map((p) => ({
      productId: p.productId,
      name: p.name,
    })),
  });

  const { send, confirm, retry, startNewChat, isStreaming } = useChat({
    channel: "SELLER",
    getScreenContext,
    onDone: (panel: SellerPanel | undefined) => {
      // refresh: 쓰기 반영 → 목록 재조회 후 목록으로 복귀
      if (panel === "refresh") {
        queryClient.invalidateQueries({ queryKey: ["seller"] });
        setShowResults(false);
        return;
      }
      // keep: 되묻기·거절·일반대화 — 우측 산출물 없음 → 목록으로 복귀.
      // 분석 되묻기(analysis+keep)면 리포트는 meta에서 이미 비워졌고, 남은 스켈레톤은
      // isStreaming 종료로 사라진다. diff 카드가 있으면 파생값(showResults)이 유지한다.
      if (panel === "keep") {
        setShowResults(false);
        return;
      }
      // replace: diff는 draft 도착 시 이미 켜짐 / 분석 리포트는 analysisReport로 우측에 표시됨
    },
  });

  const messages = useChatStore((s) => s.messages);
  const results = useChatStore((s) => s.results);
  // 마지막 응답이 실패로 끝났으면 그 문구를 우측 검토 패널에도 전달한다.
  // 스트림 실패는 settled(=confirm 결과)에 담기지 않아, 이걸 넘기지 않으면
  // 좌측엔 "통신 실패"인데 우측엔 [등록]이 살아 있는 모순된 화면이 된다.
  const lastMessage = messages[messages.length - 1];
  const streamError =
    lastMessage?.role === "assistant" ? lastMessage.error : undefined;
  const dropDraft = useChatStore((s) => s.dropDraft);
  // 등록 초안 검토 중 — 입력창 안내를 바꾸고 TTL 타이머를 건다
  const activeDraft = useChatStore((s) => s.activeDraft);
  const setActiveDraft = useChatStore((s) => s.setActiveDraft);
  // 판매자 화면 전환 신호 — lane(즉시 로딩 준비)·analysisReport(분석 리포트 본문)
  const lane = useChatStore((s) => s.lane);
  const analysisReport = useChatStore((s) => s.analysisReport);

  // 분석 레인이면 스트림 도는 동안 우측에 로딩 스켈레톤(계약 §3.3: meta.lane 즉시 준비)
  const analysisLoading = isStreaming && lane === "analysis";

  // draft 도착 시 우측을 결과 영역으로 전환(증가 감지라 effect 필요)
  const draftCount = results.filter((r) => r.kind === "draft").length;
  const prevDraftCount = useRef(0);
  useEffect(() => {
    if (draftCount > prevDraftCount.current) {
      setShowResults(true);
      setMobileView("chat");
    }
    prevDraftCount.current = draftCount;
  }, [draftCount]);

  // 우측 결과 영역 노출 여부 — showResults(수동/draft) OR 분석 로딩·리포트(파생).
  // 분석은 meta 즉시 스켈레톤을 띄워야 해 effect 대신 렌더 중 파생으로 계산한다.
  const showResults = showResultsState || analysisLoading || !!analysisReport;

  // 진입 시 새 대화(새 방) — 스토어가 채널 공용이라 이전 쇼핑 대화가 화면에 남아있을 수 있음.
  // 세션(접속)은 채널별로 분리 보관되므로 여기서 끊기지 않는다 — 화면 상태만 비운다.
  // 대시보드 히어로에서 넘어온 첫 메시지(?q=)가 있으면 초기화 직후 이어서 전송.
  //
  // ?q= 는 "한 번 쓰고 버리는" 값이라 소비 여부를 ref 로 기록한다. deps 를 [q] 로 두고
  // URL 에서 q 를 지우면(replaceState → useSearchParams 갱신) 이 이펙트가 q=null 로 다시 돌아
  // startNewChat() 이 방금 띄운 스트림을 abort·reset 해 메시지가 사라진다.
  // (대시보드에서 전송 → 채팅 화면에서 말풍선이 떴다 사라지던 원인)
  //
  // 전송은 인증이 준비된 뒤에만 한다(selectIsAuthReady = 복원완료 + user 보유).
  // RequireRole 은 persist 된 `user`만 보므로 새로고침 직후엔 "가드는 통과했지만
  // 세션 복원(refresh)은 아직 안 끝난" 구간이 있다. 그때 세션 발급을 보내면
  // 만료된 AT 쿠키로 나가 401 → 로그인으로 튕긴다(CLAUDE.md 인증 규칙).
  const isAuthReady = useAuthStore(selectIsAuthReady);
  const consumedQRef = useRef(false);
  useEffect(() => {
    if (consumedQRef.current) return;
    // q 가 있으면 보낼 수 있을 때까지 기다린다. q 가 없으면 초기화만 하면 되므로
    // 인증을 기다릴 이유가 없다(빈 화면에서 이전 쇼핑 대화를 즉시 걷어내야 한다).
    if (q && !isAuthReady) return;
    consumedQRef.current = true;

    startNewChat();
    if (q) {
      send(q);
      // 새로고침·뒤로가기로 같은 질문이 재전송되지 않게 URL 에서만 지운다.
      // 위 ref 가드 덕분에 이 갱신은 이펙트를 다시 돌리지 않는다.
      params.delete("q");
      setParams(params, { replace: true });
    }
    // q·인증 준비 시점에만 반응 — 실제 1회 실행은 위 ref 가드가 보장한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, isAuthReady]);

  // draft 승인/취소 — confirm은 최상위 action/draftId로, 취소는 서버 호출 없이 카드만 닫음
  const confirmDraft = (draftId: string) => confirm(draftId);
  const cancelDraft = (draftId: string) => {
    dropDraft(draftId);
    // 취소한 것이 검토 중이던 등록 초안이면 입력창도 평상시로 되돌린다
    if (activeDraft?.draftId === draftId) setActiveDraft(null);
    if (results.filter((r) => r.kind === "draft").length <= 1) {
      setShowResults(false); // 마지막 카드였으면 목록으로 복귀
    }
  };

  // 초안 TTL — 서버는 10분 뒤 초안을 버리는데 그 시점엔 SSE 가 끝나 있어
  // 알려줄 경로가 없다. FE 가 재서 스스로 풀지 않으면 판매자가 죽은 초안에 갇힌다.
  //
  // deps 가 draftId 인 것이 중요하다. 객체를 넣으면 렌더마다 재실행되고,
  // 정리(clearTimeout)를 빠뜨리면 수정 턴에서 새 초안이 첫 초안 기준 10분에 사라진다.
  const activeDraftId = activeDraft?.draftId;
  const activeDraftExpiresAt = activeDraft?.expiresAt;
  useEffect(() => {
    if (!activeDraftId || !activeDraftExpiresAt) return;
    const timer = setTimeout(
      () => {
        setActiveDraft(null);
        dropDraft(activeDraftId);
      },
      Math.max(0, activeDraftExpiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [activeDraftId, activeDraftExpiresAt, setActiveDraft, dropDraft]);

  const started = messages.length > 0;

  // "새 대화"는 헤더로 옮겼다 — 대화 영역 우상단 floating 은 스크롤되는 메시지 위에
  // 겹쳐 첫 줄을 가렸고, 구매자 챗(/chat)과 자리가 달라 같은 동작이 다른 곳에 있었다.
  const handleNewChat = () => {
    startNewChat();
    setShowResults(false);
  };

  const conversation = (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatConversation
        // 입력창은 (message, imageUrls) 로 주지만 send 의 2번째 자리는 조건 칩이다 —
        // 구매자 전용이라 판매자 챗에서는 넘길 값이 없다
        onSend={(message, imageUrls) => send(message, undefined, { imageUrls })}
        onRetry={retry}
        isStreaming={isStreaming}
        showUserAvatar={false}
        // 사진을 올려 상품 등록 초안을 받는 경로 — 판매자 챗에만 연다
        allowImage
        // 초안 검토 중에도 입력창은 활성이다 — 수정 요청("카테고리가 틀렸어")을
        // 받아야 하고, 딴 주제인지 아닌지는 서버가 가른다. 안내만 바꾼다.
        placeholder={
          activeDraft
            ? "수정할 내용을 입력해 주세요 — 예: 재고를 30개로 바꿔줘"
            : "상품 수정, 주문 조회, 판매 전략 등 무엇이든 물어보세요."
        }
        aboveInput={
          activeDraft ? (
            // 상태("검토 중")는 실제 작업이 일어나는 우측 패널 제목이 말한다.
            // 여기서는 지금 이 입력창으로 무엇을 할 수 있는지만 짧게 알린다 —
            // 좌우에 같은 상태를 두 번 적으면 어느 쪽이 진짜인지 모호해진다.
            <p className="px-1 text-xs text-muted-foreground">
              채팅으로 고치면 오른쪽 초안에 바로 반영돼요.
            </p>
          ) : !started ? (
            // 대화 시작 전에만 추천 질문 노출
            <SuggestedQuestions
              questions={SELLER_QUESTIONS}
              onSelect={send}
              disabled={isStreaming}
            />
          ) : null
        }
      />
    </div>
  );

  const workspace = (
    <SellerWorkspace
      tab={workspaceTab}
      onTabChange={setWorkspaceTab}
      filters={{
        orderTab,
        orderPage,
        productTab,
        productSort,
        productPage,
        // 탭·정렬을 바꾸면 첫 페이지로 되돌린다 — 2페이지에서 필터를 바꾸면
        // 빈 목록이 될 수 있다(워크스페이스에 있던 동작 그대로).
        onOrderTabChange: (t) => {
          setOrderTab(t);
          setOrderPage(0);
        },
        onOrderPageChange: setOrderPage,
        onProductTabChange: (t) => {
          setProductTab(t);
          setProductPage(0);
        },
        onProductSortChange: (s) => {
          setProductSort(s);
          setProductPage(0);
        },
        onProductPageChange: setProductPage,
      }}
      results={results}
      showResults={showResults}
      isStreaming={isStreaming}
      analysisReport={analysisReport}
      analysisLoading={analysisLoading}
      onBackToList={() => setShowResults(false)}
      onConfirmDraft={confirmDraft}
      onCancelDraft={cancelDraft}
      streamError={streamError}
      onRetry={retry}
    />
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 이 화면은 우측에서 주문·상품을 다루므로 헤더 네비를 숨겨 워크스페이스에 집중시킨다.
          "새 대화"는 구매자 챗과 같이 로고 옆에 둔다 */}
      <SellerHeader
        showNav={false}
        leftSlot={<NewChatButton onClick={handleNewChat} />}
      />

      {/* 모바일·태블릿: 세 영역 동시 표시 금지 → 탭 전환 */}
      <div className="flex items-center gap-1 border-b px-3 lg:hidden">
        {(
          [
            { key: "chat", label: "AI 채팅" },
            { key: "orders", label: "주문 관리" },
            { key: "products", label: "상품 관리" },
          ] as const
        ).map((t) => {
          const active =
            t.key === "chat" ? mobileView === "chat" : mobileView === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                if (t.key === "chat") {
                  setMobileView("chat");
                } else {
                  setMobileView(t.key);
                  setWorkspaceTab(t.key);
                  setShowResults(false);
                }
              }}
              className={cn(
                "flex h-12 items-center whitespace-nowrap border-b-2 px-3 text-sm",
                "transition-[color,border-color] duration-150 ease-out-strong",
                active
                  ? "border-foreground font-bold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:[@media(hover:hover)]:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 좌측: 대화 — 데스크톱 고정폭, 모바일은 mobileView=chat일 때만 */}
        <div
          className={cn(
            "min-h-0 flex-col border-r",
            "lg:flex lg:w-[330px] lg:flex-none xl:w-[450px]",
            mobileView === "chat"
              ? "flex flex-1 lg:flex-none"
              : "hidden lg:flex",
          )}
        >
          {conversation}
        </div>

        {/* 우측: 작업 영역 — 데스크탑 항상, 모바일은 orders/products일 때만.
            min-w-0: 넓은 표(min-w-*)가 이 flex 칸을 밀어내 탭마다 폭이 변하지 않도록 */}
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 lg:flex",
            mobileView === "chat" ? "hidden" : "flex",
          )}
        >
          {workspace}
        </div>
      </div>
    </div>
  );
}
