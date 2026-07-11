import { ChevronRight, Star } from "lucide-react";

interface ReviewItem {
  author: string;
  rating: number;
  option: string;
  date: string;
  content: string;
  helpful: number;
}

// 별점 분포는 5→1 순, 각 단계 개수. 평균/총평가수는 상위에서 주입.
export function ReviewSummary({
  average,
  total,
  distribution,
  reviews,
}: {
  average: number;
  total: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  reviews: ReviewItem[];
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          리뷰 <span className="text-muted-foreground">{total.toLocaleString("ko-KR")}</span>
        </h2>
        <button
          type="button"
          className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground"
        >
          최신순 <ChevronRight className="size-4" />
        </button>
      </div>

      {/* 평균 + 분포 바 */}
      <div className="flex flex-col gap-6 rounded-xl bg-muted/40 p-6 sm:flex-row sm:items-center">
        <div className="flex shrink-0 flex-col items-center gap-1 sm:w-32">
          <p className="text-4xl font-bold">{average.toFixed(1)}</p>
          <Stars value={average} />
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString("ko-KR")}개 평가
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          {([5, 4, 3, 2, 1] as const).map((score) => {
            const count = distribution[score] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={score} className="flex items-center gap-3 text-xs">
                <span className="w-3 text-muted-foreground">{score}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-yellow-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-right text-muted-foreground">
                  {count.toLocaleString("ko-KR")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 리뷰 리스트 */}
      <ul className="flex flex-col divide-y">
        {reviews.map((r, i) => (
          <li key={i} className="flex flex-col gap-2 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} size="sm" />
                <span className="text-sm font-medium">{r.author}</span>
                <span className="text-xs text-muted-foreground">
                  {r.option} 구매
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{r.date}</span>
            </div>
            <p className="text-sm leading-relaxed">{r.content}</p>
            <button
              type="button"
              className="w-fit rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground hover:bg-muted/70"
            >
              도움이 됐어요 {r.helpful}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stars({
  value,
  size = "md",
}: {
  value: number;
  size?: "sm" | "md";
}) {
  const cls = size === "sm" ? "size-3.5" : "size-4";
  return (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={
            i < Math.round(value)
              ? `${cls} fill-yellow-400 text-yellow-400`
              : `${cls} fill-muted text-muted`
          }
        />
      ))}
    </div>
  );
}
