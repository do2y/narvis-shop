import { useState } from "react";
import { Skeleton } from "@/shared/ui/skeleton";
import { RefreshCcw } from "lucide-react";
import { useClaims } from "./useClaims";
import { ClaimCard } from "./components/ClaimCard";
import { PageTitle, ErrorState, EmptyState } from "./components/PageState";

function ClaimsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-sm border bg-background px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Skeleton className="h-7 w-16 rounded-full" />
              <Skeleton className="h-7 w-14 rounded-full" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="mt-3 h-5 w-56" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
      ))}
    </div>
  );
}

export default function ClaimsPage() {
  const [page, setPage] = useState(0);
  const { data, isPending, isError, refetch } = useClaims(page);
  const claims = data?.content ?? [];

  return (
    <div>
      <PageTitle>취소·반품</PageTitle>

      <div className="mt-5">
        {isPending ? (
          <ClaimsSkeleton />
        ) : isError ? (
          <ErrorState
            message="신청 내역을 불러오지 못했어요."
            onRetry={() => refetch()}
          />
        ) : claims.length === 0 ? (
          <EmptyState
            icon={RefreshCcw}
            title="취소·반품 내역이 없어요"
            description="주문 내역에서 취소나 반품을 신청할 수 있어요."
            actionLabel="주문 내역 보기"
            actionTo="/mypage/orders"
          />
        ) : (
          <div className="flex flex-col gap-4">
            {claims.map((claim) => (
              <ClaimCard key={claim.claimId} claim={claim} />
            ))}
            {/* 페이지네이션 — 1페이지뿐이면 숨긴다 */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-11 rounded-full border px-5 text-sm font-medium disabled:opacity-40"
                >
                  이전
                </button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {data.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.min(data.totalPages - 1, p + 1))
                  }
                  disabled={page >= data.totalPages - 1}
                  className="h-11 rounded-full border px-5 text-sm font-medium disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
