import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SellerMetric } from "../types";
import { formatMetric } from "../utils/formatMetric";

/** 매출·주문 요약 카드 행 */
export function MetricCards({ items }: { items: SellerMetric[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((m) => {
        // deltaRate 3-state: undefined=줄 숨김 / null=비교 데이터 없음("—") / number=정상 증감률
        const hasRate = m.deltaRate !== undefined; // null은 "표시"에 포함
        const noCompare = m.deltaRate === null;
        const up = (m.deltaRate ?? 0) >= 0;
        const Arrow = up ? TrendingUp : TrendingDown;

        return (
          <div
            key={m.key}
            className="flex flex-col gap-3 rounded-sm border bg-background p-4 sm:p-5"
          >
            <span className="text-sm font-medium text-muted-foreground">
              {m.label}
            </span>
            <span className="text-2xl font-bold tracking-tight">
              {formatMetric(m.value, m.unit)}
            </span>
            {hasRate &&
              (noCompare ? (
                // 비교할 이전 데이터가 없음(어제 0 등) — 화살표 없이 "— 어제 대비"
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="font-semibold">—</span>
                  {m.caption && <span>{m.caption}</span>}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm">
                  <Arrow
                    className={cn(
                      "size-4",
                      up ? "text-brand" : "text-destructive",
                    )}
                  />
                  <span
                    className={cn(
                      "font-semibold",
                      up ? "text-brand" : "text-destructive",
                    )}
                  >
                    {up ? "+" : ""}
                    {m.deltaRate}%
                  </span>
                  {m.caption && (
                    <span className="text-muted-foreground">{m.caption}</span>
                  )}
                </span>
              ))}
          </div>
        );
      })}
    </div>
  );
}
