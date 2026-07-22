import { useSearchParams } from "react-router-dom";
import type { SellerProductSort, SellerProductTab } from "./types";
import { ProductList } from "./components/ProductList";

/**
 * 판매자 상품 관리 페이지(단독). 목록은 ProductList로 공통화 — 챗 워크스페이스와 공유한다.
 * 상품 등록·수정은 챗봇(HITL) 경유 — FE 직접 등록/수정 화면은 미채택.
 */
export default function ProductsPage() {
  // URL page는 사람이 보는 1-base, API는 0-base라 호출 시점에만 변환한다.
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") ?? "ALL") as SellerProductTab;
  const sort = (params.get("sort") ?? "latest") as SellerProductSort;
  const page = Math.max(0, Number(params.get("page") ?? 1) - 1);

  const update = (next: {
    tab?: SellerProductTab;
    sort?: SellerProductSort;
    page?: number;
  }) => {
    const p = new URLSearchParams(params);
    if (next.tab !== undefined) {
      p.set("tab", next.tab);
      p.delete("page");
    }
    if (next.sort !== undefined) {
      p.set("sort", next.sort);
      p.delete("page");
    }
    if (next.page !== undefined) p.set("page", String(next.page + 1));
    setParams(p, { replace: true });
  };

  return (
    <div className="flex flex-col gap-5 pb-16 pt-8">
      <h1 className="text-2xl font-bold tracking-tight">상품 목록</h1>
      <ProductList
        tab={tab}
        sort={sort}
        page={page}
        onTabChange={(t) => update({ tab: t })}
        onSortChange={(s) => update({ sort: s })}
        onPageChange={(p) => update({ page: p })}
      />
    </div>
  );
}
