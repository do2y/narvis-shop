"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { useQueryParams } from "@/shared/hooks/useQueryParams";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import { Skeleton } from "@/shared/ui/skeleton";

import { REPORTS_PAGE_SIZE, fetchSellerReports } from "./reportsApi";
import {
  NO_REPORT_MESSAGE,
  TRIGGER_LABEL,
  formatPeriod,
  formatReportDate,
} from "./reportLabels";
import { Pagination } from "./components/Pagination";
import { SellerErrorState } from "./components/SellerErrorState";
import { StatusTabs } from "./components/StatusTabs";
import { hoverMuted, numeric } from "./interaction";

type ReportsTab = "ALL" | "UNREAD";

/**
 * 판매자 분석 보고서 목록 (계약 R-1).
 *
 * 무인 파이프라인이 저장한 보고서의 조회 경로다. 챗의 report 이벤트(S-4)와 달리
 * 새로고침해도 남아 있고, 여기가 그 보고서들의 유일한 소비 경로다(결정 6).
 */
export default function ReportsPage() {
  // URL page 는 사람이 보는 1-base. R-1 도 1-base 를 받아(내부에서 offset 변환)
  // 주문·상품 목록과 달리 여기서 -1 하지 않는다.
  const [params, setParams] = useQueryParams();
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const tab: ReportsTab = params.get("filter") === "UNREAD" ? "UNREAD" : "ALL";
  const unreadOnly = tab === "UNREAD";

  const isAuthReady = useAuthStore(selectIsAuthReady);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["seller", "reports", { page, unreadOnly }],
    queryFn: () => fetchSellerReports({ page, unreadOnly }),
    // 상세를 보고 돌아오면 읽음 각인으로 unreadCount 가 달라져 있다.
    staleTime: 0,
    placeholderData: keepPreviousData,
    enabled: isAuthReady,
  });

  const update = (next: { tab?: ReportsTab; page?: number }) => {
    const p = new URLSearchParams(params);
    if (next.tab !== undefined) {
      if (next.tab === "ALL") p.delete("filter");
      else p.set("filter", next.tab);
      p.delete("page"); // 필터가 바뀌면 1페이지로
    }
    if (next.page !== undefined) p.set("page", String(next.page));
    setParams(p, { replace: true });
  };

  const totalPages = data ? Math.ceil(data.total / REPORTS_PAGE_SIZE) : 0;

  return (
    <div className="flex flex-col gap-5 pb-20 pt-8 sm:pb-24">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-bold tracking-tight">분석 보고서</h1>
        <p className="text-sm text-muted-foreground">
          매일 새벽 자동 분석된 결과입니다
        </p>
      </div>

      <StatusTabs<ReportsTab>
        tabs={[
          { key: "ALL", label: "전체" },
          // 배지는 필터와 무관하게 항상 전량 기준이다(계약: total 과 기준이 다르다).
          { key: "UNREAD", label: "안 읽음", count: data?.unreadCount },
        ]}
        value={tab}
        onChange={(t) => update({ tab: t })}
      />

      {isError ? (
        <SellerErrorState
          error={error}
          fallbackMessage="보고서를 불러오지 못했어요."
          onRetry={() => void refetch()}
        />
      ) : isPending ? (
        <ReportListSkeleton />
      ) : data.items.length === 0 ? (
        <EmptyReports
          unreadOnly={unreadOnly}
          reason={data.noReportReason}
          onShowAll={() => update({ tab: "ALL" })}
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y border-y">
            {data.items.map((r) => (
              <li key={r.reportId}>
                <Link
                  href={`/seller/reports/${r.reportId}`}
                  className={cn(
                    "flex items-center gap-4 py-4 transition-colors duration-150 ease-out-strong",
                    hoverMuted,
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  )}
                >
                  {/* 안 읽음 표시 — 점 하나로. 자리를 항상 차지해 제목 왼쪽 선이 흔들리지 않는다 */}
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      r.readAt === null ? "bg-brand" : "bg-transparent",
                    )}
                  />

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h2
                        className={cn(
                          "truncate text-[15px]",
                          r.readAt === null ? "font-bold" : "font-medium",
                        )}
                      >
                        {r.title}
                      </h2>
                      {r.readAt === null && (
                        <span className="sr-only">안 읽음</span>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {r.summary}
                    </p>
                    {/* 생성일 · 분석 기간 · 유형 — 한 줄에 모아 스캔되게 */}
                    <div
                      className={cn(
                        "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground",
                        numeric,
                      )}
                    >
                      <span>{formatReportDate(r.createdAt)}</span>
                      <Dot />
                      <span>{formatPeriod(r.periodFrom, r.periodTo)}</span>
                      <Dot />
                      <span>{TRIGGER_LABEL[r.triggerType] ?? r.triggerType}</span>
                      {r.recommendationCount > 0 && (
                        <>
                          <Dot />
                          <span>제안 {r.recommendationCount}건</span>
                        </>
                      )}
                      {r.hasHolds && (
                        <>
                          <Dot />
                          <span>일부 판정 보류</span>
                        </>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={(p) => update({ page: p })}
          />
        </>
      )}
    </div>
  );
}

function Dot() {
  return <span aria-hidden>·</span>;
}

/**
 * 빈 상태 — 사유별 6분기(5종 + null).
 *
 * 사유를 모르면(null) 단정하지 않고 일반 문구를 쓴다.
 */
function EmptyReports({
  unreadOnly,
  reason,
  onShowAll,
}: {
  unreadOnly: boolean;
  reason: string | null;
  onShowAll: () => void;
}) {
  // "안 읽음" 필터라 비어 보이는 것은 보고서가 없는 것과 다르다.
  if (unreadOnly) {
    return (
      <EmptyShell title="안 읽은 보고서가 없어요">
        <button
          type="button"
          onClick={onShowAll}
          className="text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          전체 보고서 보기
        </button>
      </EmptyShell>
    );
  }

  const message =
    reason && reason in NO_REPORT_MESSAGE
      ? NO_REPORT_MESSAGE[reason as keyof typeof NO_REPORT_MESSAGE]
      : "아직 생성된 보고서가 없어요";

  return <EmptyShell title={message} />;
}

function EmptyShell({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 border-y py-20 text-center">
      <FileText className="size-5 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function ReportListSkeleton() {
  return (
    <ul className="flex flex-col divide-y border-y" aria-label="불러오는 중">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex items-center gap-4 py-4">
          <span className="size-1.5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}
