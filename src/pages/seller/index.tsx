import { useState } from "react";
import { Outlet, Route, Routes } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useChatStore } from "@/shared/chat/store";
import { useChat } from "@/shared/chat/useChat";
import { SellerHeader } from "./components/SellerHeader";
import { SellerChatPanel } from "./components/SellerChatPanel";
import { SellerResultPanel } from "./components/SellerResultPanel";
import { useScreenContext } from "./useScreenContext";
import DashboardPage from "./DashboardPage";
import OrdersPage from "./OrdersPage";
import ProductsPage from "./ProductsPage";
import SellerChatPage from "./ChatPage";

/**
 * 판매자 페이지 라우터.
 * 챗봇 전용 화면은 2단 레이아웃이라 셸 밖에 두고, 헤더는 스스로 렌더한다.
 */
export default function SellerPage() {
  return (
    <Routes>
      <Route path="chat" element={<SellerChatPage />} />
      <Route element={<SellerShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}

/**
 * 판매자 셸 — 본문(목록/결과) + 사이드 채팅.
 * useChat을 여기서 잡는 이유: 대화는 사이드 패널에, 결과는 넓은 본문에 렌더되므로
 * 양쪽이 같은 send를 써야 한다(수정 확인 버튼도 후속 메시지 전송이다).
 */
function SellerShell() {
  const queryClient = useQueryClient();
  const { getScreenContext } = useScreenContext();

  // 사이드 채팅 — 셸에 두어 페이지를 옮겨도 대화가 유지된다.
  const [chatOpen, setChatOpen] = useState(false);
  // 결과 도착 시 본문을 결과로 덮되, 사용자가 목록으로 돌아갈 수 있게 한다
  const [showList, setShowList] = useState(false);

  const chat = useChat({
    channel: "SELLER",
    getScreenContext,
    onAction: (action) => {
      if (action.type === "PRODUCT_UPDATED") {
        // 수정이 반영되면 지금 보고 있는 목록도 갱신되어야 함
        queryClient.invalidateQueries({ queryKey: ["seller"] });
        queryClient.invalidateQueries({
          queryKey: ["products", action.productId],
        });
      }
    },
  });

  const results = useChatStore((s) => s.results);
  const dropProductDiff = useChatStore((s) => s.dropProductDiff);

  // 새 질문을 보내면 결과를 다시 본문에 띄운다(목록을 보던 중이었어도)
  const send = (message: string) => {
    setShowList(false);
    chat.send(message);
  };

  const confirmDiff = (draftId: string) => send(`[수정 확인] ${draftId}`);
  const cancelDiff = (draftId: string) => {
    dropProductDiff(draftId);
    send(`[수정 취소] ${draftId}`);
  };

  const hasResults = chatOpen && results.length > 0;
  const showResults = hasResults && !showList;

  return (
    <div className="flex h-screen flex-col bg-background">
      <SellerHeader
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
      />

      <div className="flex min-h-0 flex-1">
        <main className="min-h-0 flex-1 overflow-y-auto">
          {showResults ? (
            <div className="flex min-h-full flex-col bg-muted/30">
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 px-4 py-2 backdrop-blur sm:px-6">
                <button
                  type="button"
                  onClick={() => setShowList(true)}
                  className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                >
                  <ArrowLeft className="size-4" />
                  목록으로
                </button>
                <span className="text-xs text-muted-foreground">
                  AI 분석 결과
                </span>
              </div>

              <div className="mx-auto w-full max-w-6xl flex-1">
                <SellerResultPanel
                  results={results}
                  isStreaming={chat.isStreaming}
                  onConfirmDiff={confirmDiff}
                  onCancelDiff={cancelDiff}
                />
              </div>
            </div>
          ) : (
            /* 결과를 접어둔 상태 — 다시 보는 길은 채팅 패널이 제공한다 */
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <Outlet />
            </div>
          )}
        </main>

        {chatOpen && (
          <>
            {/* 데스크탑: 우측 도킹 — 본문(목록·결과)과 대화를 동시에 */}
            <aside className="hidden min-h-0 w-[380px] shrink-0 flex-col border-l lg:flex">
              <SellerChatPanel
                chat={chat}
                onSend={send}
                onClose={() => setChatOpen(false)}
                /* 결과를 접어둔 상태일 때만 "결과 보기" 제공 */
                onShowResults={hasResults && showList ? () => setShowList(false) : undefined}
              />
            </aside>

            {/* 모바일: 좁아서 나란히 못 두므로 전체화면 오버레이 */}
            <div className="fixed inset-0 z-20 flex flex-col bg-background lg:hidden">
              <SellerChatPanel
                chat={chat}
                onSend={send}
                onClose={() => setChatOpen(false)}
                mobileResults={
                  hasResults ? (
                    <SellerResultPanel
                      results={results}
                      isStreaming={chat.isStreaming}
                      onConfirmDiff={confirmDiff}
                      onCancelDiff={cancelDiff}
                    />
                  ) : null
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
