import { useState } from "react";
import { Skeleton } from "@/shared/ui/skeleton";
import { PackageOpen } from "lucide-react";
import { useOrders } from "./useOrders";
import { OrderCard } from "./components/OrderCard";
import { PageTitle, ErrorState, EmptyState } from "./components/PageState";

function OrdersSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-sm border bg-background">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex gap-4 px-5 py-4">
            <Skeleton className="size-16 rounded-sm sm:size-20" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const [page, setPage] = useState(0);
  const { data, isPending, isError, refetch } = useOrders(page);
  const orders = data?.content ?? [];

  return (
    <div>
      <PageTitle>주문 내역</PageTitle>

      <div className="mt-5">
        {isPending ? (
          <OrdersSkeleton />
        ) : isError ? (
          <ErrorState
            message="주문 내역을 불러오지 못했어요."
            onRetry={() => refetch()}
          />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="아직 주문 내역이 없어요"
            description="마음에 드는 상품을 찾아 첫 주문을 시작해보세요."
            actionLabel="쇼핑하러 가기"
            actionTo="/"
          />
        ) : (
          <div className="flex flex-col gap-5">
            {orders.map((order) => (
              <OrderCard key={order.orderId} order={order} />
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
