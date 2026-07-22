import { useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/lib/utils";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import { fetchSellerOrders } from "./api";
import type { SellerOrder, SellerOrderTab } from "./types";
import { StatusTabs } from "./components/StatusTabs";
import { Pagination } from "./components/Pagination";

// 목록 탭 4종 + 전체 (2026-07-21 개정: 취소·반품은 CLAIM 한 탭으로 접음)
const TABS: { key: SellerOrderTab; label: string; alert?: boolean }[] = [
  { key: "ALL", label: "전체" },
  { key: "ORDERED", label: "신규주문" },
  { key: "SHIPPING", label: "배송중" },
  { key: "DELIVERED", label: "배송완료" },
  { key: "CLAIM", label: "취소·반품", alert: true },
];

// 대시보드 딥링크(?status=CONFIRMED)나 옛 URL이 들어와도 4탭 안으로 접어준다.
// 응답 status(6종)와 탭(4종)이 다르므로 URL→탭 정규화가 필요.
function normalizeTab(raw: string | null): SellerOrderTab {
  switch (raw) {
    case "ORDERED":
    case "SHIPPING":
      return raw;
    case "DELIVERED":
    case "CONFIRMED": // 구매확정은 "배송완료" 탭에 흡수
      return "DELIVERED";
    case "CLAIM":
    case "CANCELLED":
    case "RETURNED":
      return "CLAIM";
    default:
      return "ALL";
  }
}

// 배지 문구·색: 활성 클레임이 있으면 claimStatus가 status를 덮어쓴다(계약 §대표 상태 규칙).
function badgeOf(o: SellerOrder): { label: string; className: string } {
  if (o.claimStatus === "CANCEL_REQUESTED")
    return { label: "취소요청", className: "bg-destructive/10 text-destructive" };
  if (o.claimStatus === "RETURN_REQUESTED")
    return { label: "반품요청", className: "bg-destructive/10 text-destructive" };

  switch (o.status) {
    case "ORDERED":
      return { label: "신규주문", className: "bg-foreground text-background" };
    case "SHIPPING":
      return { label: "배송중", className: "bg-brand/10 text-brand" };
    case "DELIVERED":
      return { label: "배송완료", className: "bg-muted text-muted-foreground" };
    case "CONFIRMED":
      return { label: "구매확정", className: "bg-muted text-foreground" };
    case "CANCELLED":
      return { label: "취소", className: "bg-destructive/10 text-destructive" };
    case "RETURNED":
      return { label: "반품", className: "bg-destructive/10 text-destructive" };
  }
}

/** "ORD-20260716-0342" → "20260716-0342" (계약: ORD- 접두사 떼고 표시) */
function displayOrderNo(orderNo: string): string {
  return orderNo.replace(/^ORD-/, "");
}

/** "2026-07-16T09:42:00+09:00" → "07-16 09:42" */
function formatOrderedAt(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]} ${m[3]}:${m[4]}` : iso;
}

export default function OrdersPage() {
  // 탭·페이지를 URL에 두어 대시보드 카드에서 딥링크(?status=ORDERED)로 진입 가능.
  // URL page는 사람이 보는 1-base, API는 0-base라 호출 시점에만 변환한다.
  const [params, setParams] = useSearchParams();
  const tab = normalizeTab(params.get("status"));
  const uiPage = Math.max(1, Number(params.get("page") ?? 1));

  // 복원 완료 전에 보내면 AT 없이 나가 401 → 로그인으로 튕긴다
  const isAuthReady = useAuthStore(selectIsAuthReady);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["seller", "orders", { tab, page: uiPage }],
    queryFn: () => fetchSellerOrders({ tab, page: uiPage - 1 }),
    staleTime: 0,
    placeholderData: keepPreviousData, // 탭 전환 시 표가 깜빡이지 않게 이전 결과 유지
    enabled: isAuthReady,
  });

  const update = (next: { tab?: SellerOrderTab; page?: number }) => {
    const p = new URLSearchParams(params);
    if (next.tab !== undefined) {
      p.set("status", next.tab);
      p.delete("page"); // 탭 바뀌면 1페이지로
    }
    if (next.page !== undefined) p.set("page", String(next.page));
    setParams(p, { replace: true });
  };

  return (
    <div className="flex flex-col gap-5 pb-16 pt-8">
      <h1 className="text-2xl font-bold tracking-tight">주문 목록</h1>

      <StatusTabs
        tabs={TABS.map((t) => ({ ...t, count: data?.tabCounts[t.key] }))}
        value={tab}
        onChange={(key) => update({ tab: key })}
      />

      {/* 검색·필터는 UI만 — keyword는 백엔드 예약 필드(MVP 미구현) */}
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

      {data && data.content.length === 0 && (
        <div className="rounded-sm border py-16 text-center text-sm text-muted-foreground">
          해당 상태의 주문이 없어요.
        </div>
      )}

      {data && data.content.length > 0 && (
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
                {data.content.map((o) => {
                  const badge = badgeOf(o);
                  const extra = o.myItemCount - 1;
                  return (
                    <tr key={o.orderId} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {displayOrderNo(o.orderNo)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={o.representativeProduct.imageUrl}
                            alt=""
                            loading="lazy"
                            className="size-9 shrink-0 rounded-sm bg-muted object-cover"
                          />
                          <span className="font-medium">
                            {o.representativeProduct.name}
                            {extra > 0 && (
                              <span className="ml-1 font-normal text-muted-foreground">
                                외 {extra}건
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {o.recipientName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                        {o.myItemsAmount.toLocaleString("ko-KR")}원
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {o.paymentMethod}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatOrderedAt(o.orderedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.page + 1} // API 0-base → UI 1-base
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
