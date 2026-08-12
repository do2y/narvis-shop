"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section } from "./Section";
import type {
  ProductReview,
  ReviewDistribution,
  ReviewSort,
} from "../types";

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "rating", label: "평점순" },
];

// "2026-07-01T12:00:00+09:00" → "2026.07.01"
// 앞 10자만 쓰므로 Date 파싱 없이 서버가 준 날짜(KST) 그대로 표시된다.
function formatDate(iso: string): string {
  return iso.slice(0, 10).replaceAll("-", ".");
}

// 별점 분포는 5→1 순, 각 단계 개수. 평균/총평가수는 상위에서 주입.
export function ReviewSummary({
  average,
  total,
  distribution,
  reviews,
  sort,
  onSortChange,
  isLoading,
}: {
  average: number;
  total: number;
  distribution: ReviewDistribution;
  reviews: ProductReview[];
  sort: ReviewSort;
  onSortChange: (sort: ReviewSort) => void;
  isLoading?: boolean;
}) {
  // 리뷰가 없으면 통계 UI를 통째로 감춘다.
  //
  // 종전에는 0개일 때도 큰 평균(0.0)과 5줄짜리 빈 분포 바가 그대로 떴다.
  // 빈 데이터를 큰 자리에 그리면 "리뷰가 없다"가 아니라 "평점이 0점인 상품"으로
  // 읽힌다 — 없는 정보를 강조해 오해를 만드는 쪽이 안 그리는 쪽보다 나쁘다.
  //
  // total 로 판정한다(reviews.length 아님) — 2페이지 이후나 로딩 중에는 목록이
  // 비어도 리뷰는 있다.
  const hasReviews = total > 0;

  return (
    <Section
      title={`리뷰 ${total.toLocaleString("ko-KR")}`}
      // 정렬할 것이 없으면 정렬 탭도 없다. disabled 로 남기면 "언젠가 쓸 수 있다"는
      // 신호라 빈 화면에 조작할 수 없는 컨트롤만 늘어난다.
      aside={
        hasReviews ? (
          // segmented control — 배경 트랙 위에서 활성 항목만 흰 판으로 떠오른다.
          // 종전엔 활성만 회색 배경이라 둘이 한 묶음으로 안 읽혔다.
          <div className="flex items-center gap-0.5 rounded-full bg-muted p-0.5">
            {SORTS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => onSortChange(s.value)}
                aria-pressed={sort === s.value}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs transition-colors duration-150 ease-out-strong",
                  sort === s.value
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {!hasReviews ? (
        // 빈 상태 — 일러스트·큰 회색 카드 없이 문장 둘. 높이도 과하게 잡지 않는다.
        <div className="flex flex-col items-center gap-1 border-t py-14 text-center">
          <p className="text-sm text-muted-foreground">
            아직 작성된 리뷰가 없어요.
          </p>
          <p className="text-sm text-muted-foreground">
            이 상품의 첫 번째 리뷰를 남겨보세요.
          </p>
        </div>
      ) : (
        <>
          {/* 평균 + 분포 — 회색 카드를 걷어내고 divider 로만 구분한다.
              면 배경이 있으면 이 블록이 상품 이미지 다음으로 무거운 요소가 된다. */}
          <div className="flex flex-col gap-8 border-y py-6 sm:flex-row sm:items-center sm:gap-12">
            <div className="flex shrink-0 items-center gap-4 sm:w-40 sm:flex-col sm:items-start sm:gap-1.5">
              <p className="text-[2.5rem] font-semibold leading-none tracking-[-0.02em] tabular-nums">
                {average.toFixed(1)}
              </p>
              <div className="flex flex-col gap-1">
                <Stars value={average} />
                <p className="text-xs text-muted-foreground">
                  {total.toLocaleString("ko-KR")}개 평가
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              {(["5", "4", "3", "2", "1"] as const).map((score) => {
                const count = distribution[score] ?? 0;
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={score} className="flex items-center gap-3 text-xs">
                    <span className="w-3 text-muted-foreground tabular-nums">
                      {score}
                    </span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      {/* 분포 바는 노랑 대신 중립 회색 — 별과 같은 노랑으로 칠하면
                          면적이 넓어 이 블록이 페이지에서 가장 강한 색면이 된다.
                          별점의 노랑은 별 아이콘에만 남긴다. */}
                      <div
                        className="h-full rounded-full bg-foreground/70 transition-[width] duration-500 ease-out-strong"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-muted-foreground tabular-nums">
                      {count.toLocaleString("ko-KR")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 리뷰 리스트 */}
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              리뷰를 불러오는 중이에요.
            </p>
          ) : reviews.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              표시할 리뷰가 없어요.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {reviews.map((r) => (
                <li key={r.reviewId} className="flex flex-col gap-2.5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Stars value={r.rating} size="sm" />
                      <span className="truncate text-sm font-medium">
                        {r.authorNickname}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatDate(r.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {r.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Section>
  );
}

function Stars({
  value,
  size = "md",
}: {
  value: number;
  size?: "sm" | "md";
}) {
  const cls = size === "sm" ? "size-3" : "size-3.5";
  return (
    <div className="flex gap-px">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden
          className={
            i < Math.round(value)
              ? `${cls} fill-yellow-400 text-yellow-400`
              : // 빈 별은 muted 면색이 아니라 옅은 테두리로 — 면으로 채우면
                // 5개가 늘 같은 무게로 보여 채워진 별과 구분이 약해진다.
                `${cls} fill-transparent text-border`
          }
        />
      ))}
    </div>
  );
}
