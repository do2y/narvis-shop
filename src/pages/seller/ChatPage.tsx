import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { ChatConversation } from "@/shared/chat/ChatConversation";
import { SuggestedQuestions } from "@/shared/chat/SuggestedQuestions";
import { useChatStore } from "@/shared/chat/store";
import { useChat } from "@/shared/chat/useChat";
import { cn } from "@/lib/utils";
import type { SellerPanel } from "@/shared/types/chat";
import { SellerHeader } from "./components/SellerHeader";
import { SellerWorkspace } from "./components/SellerWorkspace";
import type { SellerWorkspaceTab } from "./types";

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
  const [params, setParams] = useSearchParams();
  const q = params.get("q");

  const [workspaceTab, setWorkspaceTab] =
    useState<SellerWorkspaceTab>("orders");
  // 우측 패널: 목록 vs AI 결과(diff). done.panel 과 draft 도착으로 전환된다.
  const [showResults, setShowResults] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("chat");

  const { send, confirm, retry, startNewChat, isStreaming } = useChat({
    channel: "SELLER",
    onDone: (panel: SellerPanel | undefined) => {
      // refresh: 쓰기 반영 → 목록 재조회 후 목록으로 복귀
      if (panel === "refresh") {
        queryClient.invalidateQueries({ queryKey: ["seller"] });
        setShowResults(false);
      }
      // replace: diff → 우측 패널을 결과로 (draft 도착 시 이미 켜짐) / keep: 현재 패널 유지
    },
  });

  const messages = useChatStore((s) => s.messages);
  const results = useChatStore((s) => s.results);
  const dropDraft = useChatStore((s) => s.dropDraft);

  // draft 결과가 새로 도착하면 우측을 결과로 전환
  const draftCount = results.filter((r) => r.kind === "draft").length;
  const prevDraftCount = useRef(0);
  useEffect(() => {
    if (draftCount > prevDraftCount.current) {
      setShowResults(true);
      setMobileView("chat");
    }
    prevDraftCount.current = draftCount;
  }, [draftCount]);

  // 진입 시 새 대화 — 스토어가 채널 공용이라 이전 쇼핑 대화가 남아있을 수 있음.
  // 대시보드 히어로에서 넘어온 첫 메시지(?q=)가 있으면 초기화 직후 이어서 전송.
  useEffect(() => {
    startNewChat();
    if (q) {
      send(q);
      params.delete("q");
      setParams(params, { replace: true });
    }
    // 마운트 시 1회 + q 변화에만 반응
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // draft 승인/취소 — confirm은 최상위 action/draftId로, 취소는 서버 호출 없이 카드만 닫음
  const confirmDraft = (draftId: string) => confirm(draftId);
  const cancelDraft = (draftId: string) => {
    dropDraft(draftId);
    if (results.filter((r) => r.kind === "draft").length <= 1) {
      setShowResults(false); // 마지막 카드였으면 목록으로 복귀
    }
  };

  const started = messages.length > 0;

  const conversation = (
    // 대화 영역과 하나로 보이도록 별도 헤더 바 없이, "새 대화"만 우상단에 floating
    <div className="relative flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={() => {
          startNewChat();
          setShowResults(false);
        }}
        aria-label="새 대화"
        title="새 대화"
        className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-background/70 text-muted-foreground backdrop-blur transition-colors hover:bg-muted hover:text-foreground active:scale-95"
      >
        <Plus className="size-4" />
      </button>
      <ChatConversation
        onSend={send}
        onRetry={retry}
        isStreaming={isStreaming}
        placeholder="상품 수정, 주문 조회, 판매 전략 등 무엇이든 물어보세요."
        aboveInput={
          // 대화 시작 전에만 추천 질문 노출
          !started ? (
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
      results={results}
      showResults={showResults}
      isStreaming={isStreaming}
      onBackToList={() => setShowResults(false)}
      onConfirmDraft={confirmDraft}
      onCancelDraft={cancelDraft}
    />
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 이 화면은 우측에서 주문·상품을 다루므로 헤더 네비를 숨겨 워크스페이스에 집중시킨다 */}
      <SellerHeader showNav={false} />

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
                "flex h-12 items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors",
                active
                  ? "border-foreground font-bold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground",
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
