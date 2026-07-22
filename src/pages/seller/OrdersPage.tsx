import { useSearchParams } from "react-router-dom";
import type { SellerOrderTab } from "./types";
import { OrderList } from "./components/OrderList";

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

/**
 * 판매자 주문 관리 페이지(단독). 목록은 OrderList로 공통화 — 챗 워크스페이스와 공유한다.
 * 탭·페이지를 URL에 두어 대시보드 카드에서 딥링크(?status=ORDERED)로 진입 가능.
 */
export default function OrdersPage() {
  // URL page는 사람이 보는 1-base, API는 0-base라 호출 시점에만 변환한다.
  const [params, setParams] = useSearchParams();
  const tab = normalizeTab(params.get("status"));
  const page = Math.max(0, Number(params.get("page") ?? 1) - 1);

  const update = (next: { tab?: SellerOrderTab; page?: number }) => {
    const p = new URLSearchParams(params);
    if (next.tab !== undefined) {
      p.set("status", next.tab);
      p.delete("page"); // 탭 바뀌면 1페이지로
    }
    if (next.page !== undefined) p.set("page", String(next.page + 1));
    setParams(p, { replace: true });
  };

  return (
    <div className="flex flex-col gap-5 pb-16 pt-8">
      <h1 className="text-2xl font-bold tracking-tight">주문 목록</h1>
      <OrderList
        tab={tab}
        page={page}
        onTabChange={(t) => update({ tab: t })}
        onPageChange={(p) => update({ page: p })}
      />
    </div>
  );
}
