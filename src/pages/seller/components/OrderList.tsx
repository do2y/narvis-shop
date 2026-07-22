import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/lib/utils";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import { fetchSellerOrders } from "../api";
import type { SellerOrder, SellerOrderTab } from "../types";
import { StatusTabs } from "./StatusTabs";
import { Pagination } from "./Pagination";

// 목록 탭 4종 + 전체 (취소·반품은 CLAIM 한 탭으로 접음)
const TABS: { key: SellerOrderTab; label: string; alert?: boolean }[] = [
  { key: "ALL", label: "전체" },
  { key: "ORDERED", label: "신규주문" },
  { key: "SHIPPING", label: "배송중" },
  { key: "DELIVERED", label: "배송완료" },
  { key: "CLAIM", label: "취소·반품", alert: true },
];

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

/** "ORD-20260716-0342" → "20260716-0342" (계약: 화면에서만 ORD- 제거) */
function displayOrderNo(orderNo: string): string {
  return orderNo.replace(/^ORD-/, "");
}

/** "2026-07-16T09:42:00+09:00" → "07-16 09:42" */
function formatOrderedAt(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]} ${m[3]}:${m[4]}` : iso;
}

interface OrderListProps {
  tab: SellerOrderTab;
  page: number; // 0-base (API 기준)
  onTabChange: (tab: SellerOrderTab) => void;
  onPageChange: (page: number) => void;
}

/**
 * 판매자 주문 목록 — 표 + 상태 탭 + 페이지네이션 + 상태 처리(조회 전용).
 * 단독 페이지(OrdersPage)와 챗 워크스페이스가 공유한다. 상태는 부모가 제어한다.
 * 대상 선택은 채팅 자연어로 처리하므로 목록에 선택 UI는 두지 않는다.
 */
export function OrderList({
  tab,
  page,
  onTabChange,
  onPageChange,
}: OrderListProps) {
  // 복원 완료 전에 보내면 AT 없이 나가 401 → 로그인으로 튕긴다
  const isAuthReady = useAuthStore(selectIsAuthReady);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["seller", "orders", { tab, page }],
    queryFn: () => fetchSellerOrders({ tab, page }),
    staleTime: 0,
    placeholderData: keepPreviousData, // 탭 전환 시 표가 깜빡이지 않게 이전 결과 유지
    enabled: isAuthReady,
  });

  return (
    <div className="flex flex-col gap-4">
      <StatusTabs
        tabs={TABS.map((t) => ({ ...t, count: data?.tabCounts[t.key] }))}
        value={tab}
        onChange={onTabChange}
      />

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-sm border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            목록을 불러오지 못했습니다.
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

      {isPending && <OrderTableSkeleton />}

      {data && data.content.length === 0 && (
        <div className="rounded-sm border py-16 text-center text-sm text-muted-foreground">
          등록된 주문이 없습니다.
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
                  <th className="px-4 py-3 text-right font-semibold">결제금액</th>
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
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">
                              {o.representativeProduct.name}
                              {extra > 0 && (
                                <span className="ml-1 font-normal text-muted-foreground">
                                  외 {extra}건
                                </span>
                              )}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {o.representativeProduct.optionName}
                            </span>
                          </div>
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
            onChange={(p) => onPageChange(p - 1)} // UI 1-base → API 0-base
          />
        </>
      )}
    </div>
  );
}

function OrderTableSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-sm border p-4">
      <p className="pb-1 text-sm text-muted-foreground">
        주문 목록을 불러오는 중입니다.
      </p>
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-sm" />
      ))}
    </div>
  );
}
