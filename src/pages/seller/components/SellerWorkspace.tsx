import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatResult } from "@/shared/types/chat";
import type {
  SellerOrderTab,
  SellerProductSort,
  SellerProductTab,
  SellerWorkspaceTab,
} from "../types";
import { OrderList } from "./OrderList";
import { ProductList } from "./ProductList";
import { ProductDiffCard } from "./ProductDiffCard";

interface SellerWorkspaceProps {
  tab: SellerWorkspaceTab;
  onTabChange: (tab: SellerWorkspaceTab) => void;
  /** AI 결과(diff) — 있고 showResults가 true면 목록 대신 결과를 보여준다 */
  results: ChatResult[];
  showResults: boolean;
  isStreaming: boolean;
  onBackToList: () => void;
  onConfirmDraft: (draftId: string) => void;
  onCancelDraft: (draftId: string) => void;
}

const WORKSPACE_TABS: { key: SellerWorkspaceTab; label: string }[] = [
  { key: "orders", label: "주문 관리" },
  { key: "products", label: "상품 관리" },
];

/**
 * 채팅 화면 우측 작업 영역 — 주문/상품 목록(조회) + AI 결과(diff) 패널.
 * 상단(탭·필터)은 고정, 목록만 스크롤된다. 대상 선택은 채팅 자연어로 한다.
 */
export function SellerWorkspace({
  tab,
  onTabChange,
  results,
  showResults,
  isStreaming,
  onBackToList,
  onConfirmDraft,
  onCancelDraft,
}: SellerWorkspaceProps) {
  // 목록 필터·페이지는 워크스페이스 로컬 상태(URL과 분리 — 채팅 화면은 딥링크 대상이 아님)
  const [orderTab, setOrderTab] = useState<SellerOrderTab>("ALL");
  const [orderPage, setOrderPage] = useState(0);
  const [productTab, setProductTab] = useState<SellerProductTab>("ALL");
  const [productSort, setProductSort] = useState<SellerProductSort>("latest");
  const [productPage, setProductPage] = useState(0);

  const draftResults = results.filter((r) => r.kind === "draft");

  return (
    // min-w-0: 내부 표가 넓어도 이 컬럼 폭을 고정(가로 스크롤은 표 래퍼가 처리)
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* 상단 고정 바 — 탭 또는 "목록으로" 복귀 */}
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b bg-background px-3 sm:px-4">
        {showResults ? (
          <button
            type="button"
            onClick={onBackToList}
            className="flex h-12 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-95"
          >
            <ArrowLeft className="size-4" />
            목록으로
          </button>
        ) : (
          WORKSPACE_TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onTabChange(t.key)}
                aria-current={active ? "page" : undefined}
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
          })
        )}
      </div>

      {/* 스크롤 영역 — 목록 또는 AI 결과. min-w-0으로 폭 고정, 세로만 스크롤 */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-muted/30 p-4 sm:p-6">
        {showResults ? (
          <div className="flex flex-col gap-6">
            {draftResults.map((r, i) =>
              r.kind === "draft" ? (
                <div
                  key={r.draft.draftId ?? i}
                  className="animate-in duration-300 fade-in slide-in-from-bottom-2"
                >
                  <ProductDiffCard
                    draft={r.draft}
                    settled={r.settled}
                    onConfirm={onConfirmDraft}
                    onCancel={onCancelDraft}
                    disabled={isStreaming}
                  />
                </div>
              ) : null,
            )}
          </div>
        ) : tab === "orders" ? (
          <OrderList
            tab={orderTab}
            page={orderPage}
            onTabChange={(t) => {
              setOrderTab(t);
              setOrderPage(0);
            }}
            onPageChange={setOrderPage}
          />
        ) : (
          <ProductList
            tab={productTab}
            sort={productSort}
            page={productPage}
            onTabChange={(t) => {
              setProductTab(t);
              setProductPage(0);
            }}
            onSortChange={(s) => {
              setProductSort(s);
              setProductPage(0);
            }}
            onPageChange={setProductPage}
          />
        )}
      </div>
    </div>
  );
}
