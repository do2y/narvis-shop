"use client";

import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalysisReportView } from "@/shared/chat/store";
import type { ChatResult } from "@/shared/types/chat";
import type {
  SellerOrderTab,
  SellerProductSort,
  SellerProductTab,
  SellerWorkspaceTab,
} from "../types";
import { hoverMuted, pressable } from "../interaction";
import { AnalysisReport } from "./AnalysisReport";
import { OrderList } from "./OrderList";
import { ProductList } from "./ProductList";
import { ProductDiffCard } from "./ProductDiffCard";
import { ProductCreateCard } from "./ProductCreateCard";

interface SellerWorkspaceProps {
  tab: SellerWorkspaceTab;
  onTabChange: (tab: SellerWorkspaceTab) => void;
  /**
   * 목록 필터·페이지 — 부모(챗 페이지)가 들고 있다.
   *
   * 워크스페이스 로컬 상태였으나 S-4 screen 전송을 위해 끌어올렸다. 전송 시점에
   * "지금 무엇이 어떤 필터로 떠 있는지"를 읽어야 하는데, 여기 갇혀 있으면
   * 채팅 입력부가 볼 수 없다. URL 과는 여전히 분리한다(채팅 화면은 딥링크 대상 아님).
   */
  filters: SellerWorkspaceFilters;
  /** AI 결과(diff) — 있고 showResults가 true면 목록 대신 결과를 보여준다 */
  results: ChatResult[];
  showResults: boolean;
  isStreaming: boolean;
  /** 분석 리포트(analysis+replace) — 있으면 결과 영역에 리포트를 표시 */
  analysisReport: AnalysisReportView | null;
  /** 분석 스트림 진행 중 — 리포트 확정 전 스켈레톤 표시(lane:analysis) */
  analysisLoading: boolean;
  onBackToList: () => void;
  onConfirmDraft: (draftId: string) => void;
  onCancelDraft: (draftId: string) => void;
  /**
   * 이번 턴이 오류로 끝났으면 그 문구. 좌측 말풍선의 실패를 우측 검토 패널에도
   * 반영한다 — 없으면 "통신 실패" 아래에서 [등록]이 눌리는 모순된 화면이 된다.
   */
  streamError?: string;
  onRetry?: () => void;
}

/** 목록 필터·페이지 상태 + 변경 핸들러. 소유자는 부모다(S-4 screen 전송 때문). */
export interface SellerWorkspaceFilters {
  orderTab: SellerOrderTab;
  orderPage: number;
  productTab: SellerProductTab;
  productSort: SellerProductSort;
  productPage: number;
  onOrderTabChange: (tab: SellerOrderTab) => void;
  onOrderPageChange: (page: number) => void;
  onProductTabChange: (tab: SellerProductTab) => void;
  onProductSortChange: (sort: SellerProductSort) => void;
  onProductPageChange: (page: number) => void;
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
  filters,
  results,
  showResults,
  isStreaming,
  analysisReport,
  analysisLoading,
  onBackToList,
  onConfirmDraft,
  onCancelDraft,
  streamError,
  onRetry,
}: SellerWorkspaceProps) {
  const {
    orderTab,
    orderPage,
    productTab,
    productSort,
    productPage,
    onOrderTabChange,
    onOrderPageChange,
    onProductTabChange,
    onProductSortChange,
    onProductPageChange,
  } = filters;

  const draftResults = results.filter((r) => r.kind === "draft");

  return (
    // 우측 콘텐츠 영역 — 별도 헤더 바 없이, 로컬 내비(세그먼트)를 콘텐츠 상단에 얹는다.
    // min-w-0: 내부 표가 넓어도 이 컬럼 폭을 고정(가로 스크롤은 표 래퍼가 처리)
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-muted/30">
      {/* 로컬 내비 — sticky + 반투명 배경, 하드 구분선 대신 스크롤 시 콘텐츠가 아래로 흐름.
          모바일에선 상단 3-탭(AI채팅/주문/상품)이 구획 전환을 담당하므로 세그먼트는 데스크탑만.
          단 결과 보기의 "목록으로" 복귀는 모바일에서도 필요해 항상 노출한다. */}
      {showResults ? (
        <div className="sticky top-0 z-10 flex items-center bg-muted/30 px-4 pb-2 pt-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={onBackToList}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground",
              pressable,
              hoverMuted,
              "hover:[@media(hover:hover)]:text-foreground",
            )}
          >
            <ArrowLeft className="size-4" />
            목록으로
          </button>
        </div>
      ) : (
        <div className="sticky top-0 z-10 hidden items-center bg-muted/30 px-4 pb-2 pt-4 backdrop-blur sm:px-6 lg:flex">
          <div className="inline-flex h-9 items-center gap-0.5 rounded-full bg-muted p-0.5">
            {WORKSPACE_TABS.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onTabChange(t.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center whitespace-nowrap rounded-full px-3.5 text-sm",
                    "transition-[color,background-color,box-shadow] duration-150 ease-out-strong",
                    active
                      ? "bg-background font-semibold text-foreground shadow-sm"
                      : "font-medium text-muted-foreground hover:[@media(hover:hover)]:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 목록 또는 AI 결과. 모바일은 세그먼트가 없으니 top 여백을 직접 준다 */}
      <div className="px-4 pb-6 pt-4 sm:px-6 lg:pt-2">
        {showResults ? (
          <div className="flex flex-col gap-6">
            {/* 분석 리포트(analysis+replace) — 스트림 중엔 스켈레톤, 확정되면 본문 */}
            {(analysisLoading || analysisReport) && (
              <div className="animate-in duration-200 fade-in slide-in-from-bottom-2 ease-out-strong motion-reduce:animate-none">
                <AnalysisReport
                  report={analysisReport}
                  loading={analysisLoading}
                />
              </div>
            )}
            {draftResults.map((r, i) =>
              r.kind === "draft" ? (
                <div
                  key={r.draft.draftId ?? i}
                  className="animate-in duration-200 fade-in slide-in-from-bottom-2 ease-out-strong motion-reduce:animate-none"
                >
                  {/* 등록은 before 가 전부 비어 있어 전·후 비교가 무의미하다 —
                      diff 카드에 태우면 취소선 친 빈 칸만 늘어선다 */}
                  {r.draft.op === "create" ? (
                    <ProductCreateCard
                      draft={r.draft}
                      settled={r.settled}
                      onConfirm={onConfirmDraft}
                      onCancel={onCancelDraft}
                      disabled={isStreaming}
                      streamError={streamError}
                      onRetry={onRetry}
                    />
                  ) : (
                    <ProductDiffCard
                      draft={r.draft}
                      settled={r.settled}
                      onConfirm={onConfirmDraft}
                      onCancel={onCancelDraft}
                      disabled={isStreaming}
                    />
                  )}
                </div>
              ) : null,
            )}
          </div>
        ) : tab === "orders" ? (
          <OrderList
            tab={orderTab}
            page={orderPage}
            onTabChange={onOrderTabChange}
            onPageChange={onOrderPageChange}
          />
        ) : (
          <ProductList
            tab={productTab}
            sort={productSort}
            page={productPage}
            onTabChange={onProductTabChange}
            onSortChange={onProductSortChange}
            onPageChange={onProductPageChange}
          />
        )}
      </div>
    </div>
  );
}
