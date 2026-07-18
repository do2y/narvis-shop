import { useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchSellerOrders } from "./api";
import type { SellerOrderStatus } from "./types";
import { StatusTabs } from "./components/StatusTabs";
import { Pagination } from "./components/Pagination";

type Tab = SellerOrderStatus | "ALL";

const TABS: { key: Tab; label: string; alert?: boolean }[] = [
  { key: "ALL", label: "전체" },
  { key: "NEW", label: "신규주문" },
  { key: "PREPARING", label: "배송준비" },
  { key: "SHIPPING", label: "배송중" },
  { key: "DELIVERED", label: "배송완료" },
  { key: "CLAIM", label: "취소·반품", alert: true },
];

const STATUS_LABEL: Record<SellerOrderStatus, string> = {
  NEW: "신규주문",
  PREPARING: "배송준비",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CLAIM: "반품요청",
};

const STATUS_CLASS: Record<SellerOrderStatus, string> = {
  NEW: "bg-foreground text-background",
  PREPARING: "bg-muted text-foreground",
  SHIPPING: "bg-brand/10 text-brand",
  DELIVERED: "bg-muted text-muted-foreground",
  CLAIM: "bg-destructive/10 text-destructive",
};

export default function OrdersPage() {
  // 탭·페이지를 URL에 두어 대시보드 카드에서 딥링크(?status=NEW)로 진입 가능
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") ?? "ALL") as Tab;
  const page = Number(params.get("page") ?? 1);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["seller", "orders", { status, page }],
    queryFn: () => fetchSellerOrders({ status, page }),
    staleTime: 0,
    placeholderData: keepPreviousData, // 탭 전환 시 표가 깜빡이지 않게 이전 결과 유지
  });

  const update = (next: { status?: Tab; page?: number }) => {
    const p = new URLSearchParams(params);
    if (next.status !== undefined) {
      p.set("status", next.status);
      p.delete("page"); // 탭 바뀌면 1페이지로
    }
    if (next.page !== undefined) p.set("page", String(next.page));
    setParams(p, { replace: true });
  };

  return (
    <div className="flex flex-col gap-5 pb-16 pt-8">
      <h1 className="text-2xl font-bold tracking-tight">주문 목록</h1>

      <StatusTabs
        tabs={TABS.map((t) => ({ ...t, count: data?.counts[t.key] }))}
        value={status}
        onChange={(key) => update({ status: key })}
      />

      {/* 검색·필터는 UI만 — 백엔드 계약 확정 후 연결 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-11 min-w-60 flex-1 items-center gap-2 rounded-full border bg-background px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            disabled
            placeholder="주문번호, 주문자명, 상품명 검색 (준비 중)"
            aria-label="주문 검색"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-sm border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            주문을 불러오지 못했어요.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="h-11 rounded-full border px-5 text-sm font-medium transition-all hover:bg-muted active:scale-95"
          >
            다시 시도
          </button>
        </div>
      )}

      {isPending && <TableSkeleton />}

      {data && data.orders.length === 0 && (
        <div className="rounded-sm border py-16 text-center text-sm text-muted-foreground">
          해당 상태의 주문이 없어요.
        </div>
      )}

      {data && data.orders.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-sm border bg-background">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-semibold">주문번호</th>
                  <th className="px-4 py-3 text-left font-semibold">상품</th>
                  <th className="px-4 py-3 text-left font-semibold">주문자</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    결제금액
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">결제수단</th>
                  <th className="px-4 py-3 text-left font-semibold">주문일시</th>
                  <th className="px-4 py-3 text-left font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.orderId} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {o.orderId}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={o.productImageUrl}
                          alt=""
                          loading="lazy"
                          className="size-9 shrink-0 rounded-sm bg-muted object-cover"
                        />
                        <span className="font-medium">
                          {o.productName}
                          {o.extraItemCount > 0 && (
                            <span className="ml-1 font-normal text-muted-foreground">
                              외 {o.extraItemCount}건
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {o.ordererName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      {o.amount.toLocaleString("ko-KR")}원
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {o.payMethod}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {o.orderedAt}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
                          STATUS_CLASS[o.status],
                        )}
                      >
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(p) => update({ page: p })}
          />
        </>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-sm border p-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-sm" />
      ))}
    </div>
  );
}
