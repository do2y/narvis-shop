"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { ApiError } from "@/shared/api/client";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";

import { fetchSellerReport } from "./reportsApi";
import { TRIGGER_LABEL, formatPeriod } from "./reportLabels";
import { AnalysisReport } from "./components/AnalysisReport";
import { SellerErrorState } from "./components/SellerErrorState";
import { hoverMuted, numeric, pressable } from "./interaction";

/**
 * 판매자 분석 보고서 상세 (계약 R-2).
 *
 * 본문은 S-4 report 이벤트와 **같은 조립기**가 만들어 스키마가 같다 —
 * 그래서 채팅 패널이 쓰는 AnalysisReport 를 무수정으로 재사용한다(확정 6:
 * 채팅과 보고서 페이지가 구조적으로 어긋날 수 없게 한 설계).
 *
 * ⚠️ 조회가 곧 읽음 각인이다. 성공하면 목록의 unreadCount 가 이미 달라져 있으므로
 * 돌아가기 전에 목록 쿼리를 무효화한다.
 */
export default function ReportDetailPage({ reportId }: { reportId: string }) {
  const isAuthReady = useAuthStore(selectIsAuthReady);
  const queryClient = useQueryClient();

  const { data, isPending, isError, error, refetch, isSuccess } = useQuery({
    queryKey: ["seller", "reports", reportId],
    queryFn: () => fetchSellerReport(reportId),
    staleTime: 0,
    enabled: isAuthReady,
    // 각인은 멱등이라 재시도가 안전하지만, 404(없는·남의 보고서)는 재시도해도 같다.
    retry: (count, err) =>
      err instanceof ApiError && err.status === 404 ? false : count < 1,
  });

  // 읽음 각인이 서버에서 일어났으므로 목록의 배지·읽음 표시를 새로 받아야 한다.
  useEffect(() => {
    if (!isSuccess) return;
    void queryClient.invalidateQueries({
      queryKey: ["seller", "reports"],
      // 이 상세 쿼리까지 무효화하면 조회가 한 번 더 나가 각인 로그가 중복된다.
      predicate: (q) => q.queryKey.length === 3 && typeof q.queryKey[2] === "object",
    });
  }, [isSuccess, queryClient]);

  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="flex flex-col gap-5 pb-20 pt-8 sm:pb-24">
      <Link
        href="/seller/reports"
        className={cn(
          "-ml-2 inline-flex h-9 w-fit items-center gap-1 rounded-full pl-1.5 pr-3 text-sm font-medium text-muted-foreground",
          pressable,
          hoverMuted,
          "hover:[@media(hover:hover)]:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <ChevronLeft className="size-4" />
        보고서 목록
      </Link>

      {isError ? (
        notFound ? (
          <div className="flex flex-col items-center gap-3 border-y py-20 text-center">
            <p className="text-sm text-muted-foreground">
              보고서를 찾을 수 없어요.
            </p>
            <Link
              href="/seller/reports"
              className="text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              목록으로 돌아가기
            </Link>
          </div>
        ) : (
          <SellerErrorState
            error={error}
            fallbackMessage="보고서를 불러오지 못했어요."
            onRetry={() => void refetch()}
          />
        )
      ) : (
        <>
          {/* 유형·기간은 리포트 본문(AnalysisReport)에 없는 보고서 전용 맥락이라
              페이지 머리에 둔다. 본문 헤더의 제목·생성시각과 겹치지 않는다. */}
          {data && (
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground",
                numeric,
              )}
            >
              <span className="font-semibold text-foreground">
                {TRIGGER_LABEL[data.triggerType] ?? data.triggerType}
              </span>
              <span aria-hidden>·</span>
              <span>
                분석 기간 {formatPeriod(data.period.from, data.period.to)}
              </span>
              {data.comparedPeriod && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    비교{" "}
                    {formatPeriod(
                      data.comparedPeriod.from,
                      data.comparedPeriod.to,
                    )}
                  </span>
                </>
              )}
            </div>
          )}

          {/* 채팅 패널과 같은 컴포넌트 — loading 이면 자체 스켈레톤을 그린다 */}
          <AnalysisReport report={data ?? null} loading={isPending} />

          {/* 세그먼트는 R-2 에만 있는 보고서 전용 자료라 본문 밖에 둔다 */}
          {data && data.segments.length > 0 && <SegmentTable data={data.segments} />}
        </>
      )}
    </div>
  );
}

/**
 * 고객 세그먼트 표 — R-2 전용(S-4 report 이벤트에는 없다).
 *
 * AnalysisReport 안에 넣지 않은 이유: 그 컴포넌트는 채팅 패널과 공유하는데
 * 채팅 쪽엔 이 필드가 오지 않아 분기가 생긴다. 여기서 그리면 둘 다 손대지 않는다.
 */
function SegmentTable({
  data,
}: {
  data: { segmentId: number; size: number; llmLabel: string; llmDesc: string }[];
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="ml-1 text-xs font-semibold text-muted-foreground">
        고객 세그먼트
      </h3>
      <div className="overflow-x-auto rounded-sm border bg-background">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">
                세그먼트
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                설명
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                규모
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((s) => (
              <tr key={s.segmentId}>
                <td className="px-4 py-3 font-medium">{s.llmLabel}</td>
                <td className="px-4 py-3 leading-relaxed text-muted-foreground">
                  {s.llmDesc}
                </td>
                <td className={cn("px-4 py-3 text-right", numeric)}>
                  {s.size.toLocaleString("ko-KR")}명
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
