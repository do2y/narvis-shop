"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryParams } from "@/shared/hooks/useQueryParams";

import { useQueryClient } from "@tanstack/react-query";
import { ChatConversation } from "@/shared/chat/ChatConversation";
import { NewChatButton } from "@/shared/chat/NewChatButton";
import { acknowledgeUnresolved, hasDuplicateRisk } from "@/shared/chat/draftApproval";
import { canRetry } from "@/shared/chat/retryPolicy";
import { SuggestedQuestions } from "@/shared/chat/SuggestedQuestions";
import { useChatStore } from "@/shared/chat/store";
import { useChat } from "@/shared/chat/useChat";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import { cn } from "@/lib/utils";
import type { SellerDraft, SellerPanel } from "@/shared/types/chat";
import { DraftEntryButton } from "./components/DraftEntryButton";
import { SellerHeader } from "./components/SellerHeader";
import { SellerWorkspace } from "./components/SellerWorkspace";
import { SELLER_SUGGESTED_QUESTIONS } from "./suggestedQuestions";
import { useSellerScreenContext } from "./useSellerScreenContext";
import type {
  SellerOrderTab,
  SellerProductPage,
  SellerProductSort,
  SellerProductTab,
  SellerWorkspaceTab,
} from "./types";

// 추천 질문은 대시보드 히어로와 같은 정본을 쓴다(suggestedQuestions) —
// 화면마다 다른 예시를 보여주면 무엇이 되는 기능인지 판단할 수 없다.

// 모바일 3분할 대신 탭 전환(요청: 좁은 화면에서 세 영역 동시 표시 금지).
// "results" 는 탭이 아니라 작업 영역에 초안 결과를 띄운 상태다 — 어느 탭도 현재 화면이 아니다.
type MobileView = "chat" | "results" | SellerWorkspaceTab;

export default function SellerChatPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useQueryParams();
  const q = params.get("q");

  const [workspaceTab, setWorkspaceTab] =
    useState<SellerWorkspaceTab>("orders");
  // 우측 패널: 목록 vs AI 결과(diff/리포트).
  //
  // 3-상태인 이유: 결과 노출은 "수동/draft 전환(state)"과 "분석 로딩·리포트(파생)"의
  // OR 인데, 분석 리포트는 다음 분석 전까지 스토어에 남는다. state 를 boolean 으로 두면
  // "목록으로"가 state 만 내리고 파생 항이 계속 true 라 화면이 그대로였다.
  // 그래서 사용자가 목록을 고른 것을 "list" 로 명시해 파생을 이긴다.
  //   "auto"    — 파생(분석 로딩·리포트)에 맡김
  //   "results" — 결과 강제(draft 도착)
  //   "list"    — 목록 강제(사용자가 "목록으로")
  const [panelIntent, setPanelIntent] = useState<"auto" | "results" | "list">(
    "auto",
  );
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
    // 새 초안이 오면 우측을 결과 영역으로 전환한다. 렌더 후 이펙트로 감지하면 done 과의 실행 순서가
    // 네트워크 청크 경계에 따라 뒤바뀌고(I-3), 초안 수로 판단하면 교체된 새 초안을 놓친다.
    // 모바일에서는 작업 영역으로 넘어간다 — 채팅에 남으면 카드에 닿을 길이 없었다(I-8).
    onDraft: () => {
      setPanelIntent("results");
      setMobileView("results");
    },
    onDone: (panel: SellerPanel | undefined, { draftArrived }) => {
      if (panel === "refresh") {
        queryClient.invalidateQueries({ queryKey: ["seller"] });
      }
      // 이 턴의 산출물은 초안이다. 패널은 onDraft 가 정했으니 건드리지 않는다 —
      // 그 뒤 사용자가 목록을 골랐다면 그 선택도 유지된다.
      if (draftArrived) return;
      // refresh: 쓰기 반영 → 목록 재조회 후 목록으로 복귀
      if (panel === "refresh") {
        setPanelIntent("list");
        return;
      }
      // keep: 되묻기·거절·일반대화 — 이번 턴의 우측 산출물이 없으니 목록으로 복귀.
      // 분석 되묻기(analysis+keep)면 리포트는 meta에서 이미 비워졌다. 남은 리포트가
      // 있더라도 "list"가 파생을 이겨야 한다 — 이번 턴 결과가 아닌 옛 리포트를
      // 산출물처럼 다시 띄우면 안 된다.
      if (panel === "keep") {
        setPanelIntent("list");
        return;
      }
      // replace: 분석 리포트는 파생("auto")으로 표시.
      // 여기서 "auto"로 되돌려야 직전 턴의 "list"가 이번 리포트를 가리지 않는다.
      setPanelIntent("auto");
    },
  });

  const messages = useChatStore((s) => s.messages);
  const results = useChatStore((s) => s.results);
  // 결과 패널이 그리는 초안 카드 수 — 초안 입구의 표시 여부와 개수가 이 값을 따른다
  const draftCount = results.filter((r) => r.kind === "draft").length;
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

  // 우측 결과 영역 노출 여부 — "list"가 켜져 있으면 무조건 목록이다.
  //
  // analysisReport 는 다음 분석 전까지 스토어에 남으므로, 이걸 그냥 OR 하면
  // "목록으로"를 눌러도 파생 항이 계속 true 라 화면이 그대로였다(이번 버그).
  // 스트리밍 중에도 사용자의 선택을 이기지 않는다 — 분석 도중 목록을 보겠다는 것도
  // 유효한 의사다. 대신 새 턴이 시작되면 onDone/draft 가 intent 를 다시 풀어준다.
  const showResults =
    panelIntent === "list"
      ? false
      : panelIntent === "results" || analysisLoading || !!analysisReport;

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
  // 이전 승인의 처리 여부가 불명확하면 경고한다. 같은 계정의 기록만 본다.
  // 알리는 절차일 뿐 중복 실행을 막지 못한다 — 사용자가 확인하면 그대로 나간다.
  const unresolvedApprovals = useChatStore((s) => s.unresolvedApprovals);
  const ownerId = useAuthStore((s) => s.user?.id ?? null);
  const acknowledgeDraft = (draft: SellerDraft) => {
    acknowledgeUnresolved(draft);
    confirm(draft.draftId);
  };
  const cancelDraft = (draftId: string) => {
    dropDraft(draftId);
    // 취소한 것이 검토 중이던 등록 초안이면 입력창도 평상시로 되돌린다
    if (activeDraft?.draftId === draftId) setActiveDraft(null);
    if (results.filter((r) => r.kind === "draft").length <= 1) {
      setPanelIntent("list"); // 마지막 카드였으면 목록으로 복귀
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

  // 남은 초안으로 돌아가는 입구(채팅의 "초안 보기"·목록의 입구가 함께 쓴다).
  // 특정 초안이 아니라 결과 패널 전체를 연다 — 패널이 남은 초안을 모두 그린다.
  // 누를 때만 열린다: 사용자가 닫은 패널을 상태 변화가 다시 열지 않는다.
  const openDrafts = () => {
    setPanelIntent("results");
    setMobileView("results");
  };

  // "새 대화"는 헤더로 옮겼다 — 대화 영역 우상단 floating 은 스크롤되는 메시지 위에
  // 겹쳐 첫 줄을 가렸고, 구매자 챗(/chat)과 자리가 달라 같은 동작이 다른 곳에 있었다.
  const handleNewChat = () => {
    startNewChat();
    setPanelIntent("list");
    // 모바일 초안 결과 화면에서 새 대화를 시작하면 비워진 결과 대신 채팅으로 돌아간다.
    // 작업 탭(주문·상품)을 보던 중이면 그대로 둔다
    setMobileView((v) => (v === "results" ? "chat" : v));
  };

  // 새 질문을 보내면 직전 턴의 "목록으로"를 놓아준다. 이게 없으면 리포트를 닫아 둔 뒤
  // 다시 분석시켰을 때 done 전까지 우측이 목록에 묶여 스켈레톤이 뜨지 않는다.
  // 검토 중인 초안은 가리지 않는다 — 수정 요청이 실패하면 카드로 돌아올 길이 없다.
  const reviewingDraft = draftCount > 0;
  const sendFromInput: typeof send = (message, conditionActions, opts) => {
    setPanelIntent((prev) =>
      prev === "results" && reviewingDraft ? "results" : "auto",
    );
    return send(message, conditionActions, opts);
  };

  const conversation = (
    // min-w-0: 안쪽 추천 질문 줄이 가로 스크롤되려면 이 칸이 패널 폭으로 줄어들 수
    // 있어야 한다. 기본 min-width:auto 면 내용 폭만큼 벌어져 넘칠 것이 없어진다.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ChatConversation
        // 입력창은 (message, imageUrls) 로 주지만 send 의 2번째 자리는 조건 칩이다 —
        // 구매자 전용이라 판매자 챗에서는 넘길 값이 없다
        onSend={(message, imageUrls) =>
          sendFromInput(message, undefined, { imageUrls })
        }
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
        // 초안 안내만 있는 데스크톱과 달리, 모바일은 작업 영역이 가려져 있어 초안으로 가는 입구가 필요하다.
        // 등록 초안이 아니면 데스크톱에 보일 것이 없으므로 감싸는 칸째 숨긴다(레이아웃 유지).
        aboveInputClassName={
          !activeDraft && draftCount > 0 ? "mb-1 lg:hidden" : undefined
        }
        aboveInput={
          activeDraft ? (
            // 상태("검토 중")는 실제 작업이 일어나는 우측 패널 제목이 말한다.
            // 여기서는 지금 이 입력창으로 무엇을 할 수 있는지만 짧게 알린다 —
            // 좌우에 같은 상태를 두 번 적으면 어느 쪽이 진짜인지 모호해진다.
            <div className="flex flex-wrap items-center gap-2">
              <p className="px-1 text-xs text-muted-foreground">
                {/* 수정 요청은 기존 초안을 고치지 않는다 — 새 draftId 의 초안이 오면 교체되고
                    (수정 턴마다 재발급 — architecture/chat.md), 되묻기로 끝나면 초안이 오지 않는다.
                    그래서 결과를 단정하지 않는다. 모바일엔 "오른쪽"이 없다 */}
                <span className="hidden lg:inline">
                  채팅으로 수정을 요청하면 오른쪽에 새 초안이 만들어질 수 있어요.
                  검토한 뒤 등록해 주세요.
                </span>
                <span className="lg:hidden">
                  채팅으로 수정을 요청하면 새 초안이 만들어질 수 있어요. 검토한 뒤
                  등록해 주세요.
                </span>
              </p>
              <DraftEntryButton
                count={draftCount}
                onClick={openDrafts}
                className="lg:hidden"
              />
            </div>
          ) : draftCount > 0 ? (
            <DraftEntryButton count={draftCount} onClick={openDrafts} />
          ) : !started ? (
            // 대화 시작 전에만 추천 질문 노출
            <SuggestedQuestions         
              onSelect={sendFromInput}
              questions={SELLER_SUGGESTED_QUESTIONS}
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
      onBackToList={() => setPanelIntent("list")}
      onOpenDrafts={openDrafts}
      onConfirmDraft={confirmDraft}
      onCancelDraft={cancelDraft}
      hasDuplicateRisk={(draft) =>
        hasDuplicateRisk(unresolvedApprovals, draft, ownerId)
      }
      onAcknowledgeDraft={acknowledgeDraft}
      streamError={streamError}
      // 카드의 오류 상태는 마지막 말풍선의 error 에서 나온다(streamError) — 대상도 그 말풍선이다.
      // 재시도할 수 없으면 버튼 자체를 주지 않는다(카드는 onRetry 가 있으면 버튼을 그린다, I-4)
      onRetry={
        canRetry(messages, isStreaming, lastMessage?.id)
          ? () => retry(lastMessage.id)
          : undefined
      }
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
      <nav
        aria-label="화면 전환"
        className="flex items-center gap-1 border-b px-3 lg:hidden"
      >
        {(
          [
            { key: "chat", label: "AI 채팅" },
            { key: "orders", label: "주문 관리" },
            { key: "products", label: "상품 관리" },
          ] as const
        ).map((t) => {
          // 결과(초안·리포트)를 보는 동안에는 작업 탭이 현재 화면이 아니다 — 목록을 보일 때만 강조한다
          const active =
            t.key === "chat"
              ? mobileView === "chat"
              : mobileView !== "chat" && !showResults && workspaceTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (t.key === "chat") {
                  setMobileView("chat");
                } else {
                  setMobileView(t.key);
                  setWorkspaceTab(t.key);
                  setPanelIntent("list");
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
      </nav>

      <div className="flex min-h-0 flex-1">
        {/* 좌측: 대화 — 데스크톱 고정폭, 모바일은 mobileView=chat일 때만 */}
        <div
          role="region"
          aria-label="AI 채팅"
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
          role="region"
          // 지금 이 영역이 무엇을 보여 주는지 — 모바일 결과 화면에선 어느 탭도 현재가 아니라 이 이름이 알린다
          aria-label={
            showResults
              ? draftCount > 0
                ? "초안 검토"
                : "AI 결과"
              : "작업 목록"
          }
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

