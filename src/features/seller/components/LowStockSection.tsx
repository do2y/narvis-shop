"use client";

import { useState } from "react";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/shared/ui/ProductImage";
import { numeric } from "../interaction";
import type { SellerLowStockItem } from "../types";
import { Pagination } from "./Pagination";

/** 한 페이지에 보여줄 줄 수 */
const PAGE_SIZE = 10;

/**
 * 재고 부족 상품 — 페이지 단위로 끊어 보여준다.
 *
 * 종전에는 서버가 준 items 를 전량 렌더해 대시보드가 재고 목록으로 뒤덮였다
 * (43개면 43줄). 한 페이지 분량만 그려 대시보드의 다른 구역을 밀어내지 않게 한다.
 *
 * ⚠️ 페이지네이션은 **클라이언트에서 한다**. S-1 응답의 lowStock 에는 page·size·limit
 * 파라미터가 없어(계약: threshold 만 받는다) 서버 페이징을 요청할 방법이 없다.
 * items 는 서버가 이미 상위 일부로 자른 배열이라 규모가 작고, 정렬도 재고 오름차순으로
 * 와 있으므로 그대로 잘라 쓰는 것이 안전하다.
 *
 * 펼치기·접기·품절 필터를 두지 않는 이유는 같다 — 목록이 이미 재고 오름차순이라
 * 급한 것이 맨 앞에 모이고, 페이지 이동 말고 다른 조작이 붙으면 "지금 몇 개 중
 * 몇 번째인지"가 여러 축으로 갈려 오히려 읽기 어려워진다.
 * 걸러 보는 일은 상품 관리 화면의 품절 탭이 맡는다.
 *
 * 경고색은 "실제로 주의가 필요한 곳"에만 쓴다 — 목록 전체에 붉은 배경을 깔면
 * 어느 줄이 급한지 구분되지 않아 경고가 무뎌진다.
 */
export function LowStockSection({
  items,
  threshold,
}: {
  items: SellerLowStockItem[];
  threshold: number;
}) {
  const [page, setPage] = useState(1);

  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Check className="size-4 shrink-0" aria-hidden />
        재고가 부족한 상품이 없어요. (기준 {threshold}개 이하)
      </p>
    );
  }

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const visible = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y border-t">
        {visible.map((p) => {
          const soldOut = p.stockQuantity === 0;
          return (
            <li
              key={`${p.productId}:${p.optionId ?? "-"}`}
              className="flex items-center gap-3 py-2.5"
            >
              <ProductImage
                src={p.imageUrl}
                alt=""
                className="size-9 shrink-0 rounded-sm bg-muted object-cover"
              />

              {/* 상품명과 옵션을 세로로 나눈다 — 한 줄에 섞으면 어디까지가
                  이름이고 어디부터 옵션인지 눈으로 갈리지 않는다 */}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{p.name}</span>
                {p.optionName && (
                  <span className="truncate text-xs text-muted-foreground">
                    {p.optionName}
                  </span>
                )}
              </div>

              {/* 수량 — 품절만 배지로, 나머지는 숫자로. "0개 남음"을 반복하지 않는다 */}
              {soldOut ? (
                <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                  품절
                </span>
              ) : (
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold text-destructive",
                    numeric,
                  )}
                >
                  {p.stockQuantity}
                  <span className="ml-0.5 text-xs font-medium text-muted-foreground">
                    개
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* totalPages <= 1 이면 Pagination 이 스스로 null 을 반환한다 —
          그때는 목록 아래에 빈 줄이 남지 않는다(바깥 flex 의 gap 도 함께 사라진다). */}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
