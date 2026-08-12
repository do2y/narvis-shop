"use client";

import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";
import { track } from "@/shared/analytics/track";
import { useVisibleOnce } from "@/shared/analytics/useVisibleOnce";
import type { ChatResult, ProductGroup } from "@/shared/types/chat";
import { formatPrice } from "@/shared/utils/formatPrice";
import { ChatProductCard } from "./ChatProductCard";

interface ProductPanelProps {
  results: ChatResult[];
  isStreaming: boolean;
}

// 열 수를 바꾸면 useScreenContext 의 currentColumns 도 함께 고쳐야 한다 —
// CH-2 screen.columns 가 좌표 지시("3번째 줄 2번째")를 푸는 값이라 어긋나면 조용히 틀린다.
const GRID =
  "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-8 xl:grid-cols-3";

export function ProductPanel({ results, isStreaming }: ProductPanelProps) {
  // SHOPPING 채널은 상품 결과만 표시한다(다른 kind는 이 채널에 오지 않음)
  const groups = results.flatMap((r) =>
    r.kind === "products" ? r.groups : [],
  );
  const isEmpty = groups.length === 0;

  if (isEmpty && isStreaming) {
    return (
      <div className="pl-4 pr-3 pt-5 pb-[var(--mobile-chat-result-bottom-clearance)] sm:px-6 sm:pt-6 sm:pb-[var(--mobile-chat-result-bottom-clearance)] lg:p-6">
        <div className={GRID}>
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex h-full animate-in flex-col items-center justify-center gap-3 p-8 text-center duration-500 fade-in">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <MessagesSquare className="size-7" strokeWidth={1.5} />
        </span>
        <p className="text-sm text-muted-foreground">
          대화를 시작하면 조건에 맞는 상품이 여기에 표시돼요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pl-4 pr-3 pt-5 pb-[var(--mobile-chat-result-bottom-clearance)] sm:gap-8 sm:px-6 sm:pt-6 sm:pb-[var(--mobile-chat-result-bottom-clearance)] lg:p-6">
      {groups.map((group, i) => (
        // title 은 유일 키가 아니다 — label 이 선택 필드라(CH-5) 한 턴에 온 여러
        // RECOMMENDATION 묶음이 전부 "추천 상품"이 된다. 조건 칩에서 겪은 것과 같은
        // 함정으로, 중복 키는 리컨실리에이션을 어긋나게 해 묶음이 바뀔 때 이전 카드가
        // 남거나 impression 이 엉뚱한 묶음에 귀속된다.
        // listId 가 있으면 그것이 서버가 인정한 묶음 식별자다(인기상품 묶음은 없다).
        <ProductGroupSection
          key={
            group.items[0]?.recommendationContext?.listId ??
            `${group.title}:${i}`
          }
          group={group}
        />
      ))}
    </div>
  );
}

/**
 * 추천 묶음 하나. 영역이 화면에 들어오면 recommendation_impression 을 1회 발화한다 —
 * 추천 퍼널의 2단이라 "생성됐는데 노출은 안 됐다"(위치 문제)를 잡아낸다.
 *
 * 목록 단위 이벤트라 productId 가 없고, 인기상품 묶음은 recommendationContext 가
 * 없어 발화하지 않는다(귀속시킬 목록이 없다).
 *
 * 별도 컴포넌트로 뺀 이유: 훅은 map 콜백 안에서 호출할 수 없다.
 */
function ProductGroupSection({ group }: { group: ProductGroup }) {
  // 묶음의 추천 출처는 카드마다 동일하므로 첫 카드에서 읽는다(CH-5 가 목록 단위로 부여).
  const rec = group.items[0]?.recommendationContext;

  const sectionRef = useVisibleOnce<HTMLElement>(() => {
    if (!rec) return;
    track("recommendation_impression", { recommendation: rec });
  }, rec?.listId);

  return (
    <section
      ref={sectionRef}
      className="flex animate-in flex-col gap-3 duration-300 fade-in slide-in-from-bottom-2 sm:gap-4"
    >
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <h2
          className={cn(
            "text-lg font-bold tracking-tight",
            group.titleKind === "label" && "text-wordmark",
          )}
        >
          {group.title}
        </h2>
        <RecommendationSummary recommendation={group.recommendation} />
      </div>
      <div className={GRID}>
        {group.items.map((product) => (
          <ChatProductCard key={product.productId} product={product} />
        ))}
      </div>
    </section>
  );
}

/**
 * 묶음 단위 안내(CH-5). BUY_ALL 은 "이 조합을 통째로 산다"는 제안이라 합계·예산이 함께 있어야
 * 의미가 통하고, 드롭은 listType 과 무관하게 알려야 한다("5개 중 3개가 품절").
 * 추천이 아닌 묶음(인기상품·경로 A)은 recommendation 이 없어 아무것도 그리지 않는다.
 */
function RecommendationSummary({
  recommendation,
}: {
  recommendation: ProductGroup["recommendation"];
}) {
  if (!recommendation) return null;
  const { listType, itemsDropped, totalBudget, sum, withinBudget } =
    recommendation;

  // 합계·예산은 BUY_ALL 에만 존재한다. 드롭이 있으면 서버가 withinBudget 을 null 로 주므로
  // (남은 것만의 합계로 예산을 판정하면 오해를 준다) 초과 여부는 그때 표시하지 않는다.
  const showBudget = listType === "BUY_ALL" && sum !== undefined;

  if (!showBudget && !itemsDropped) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {showBudget && (
        <span className="font-semibold">합계 {formatPrice(sum)}</span>
      )}
      {showBudget && totalBudget !== undefined && (
        <span className="text-muted-foreground">
          예산 {formatPrice(totalBudget)}
        </span>
      )}
      {showBudget && withinBudget === true && (
        <span className="font-medium text-brand">예산 안에 들어요</span>
      )}
      {showBudget && withinBudget === false && (
        <span className="font-medium text-red-500">예산을 넘어요</span>
      )}
      {itemsDropped > 0 && (
        <span className="text-muted-foreground">
          품절·판매중지로 {itemsDropped}개가 빠졌어요
        </span>
      )}
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <Skeleton className="aspect-square rounded-[12px] bg-muted/80 sm:aspect-[4/3]" />
      <div className="mt-3 flex flex-1 flex-col px-0.5 sm:mt-4">
        <div className="flex flex-col gap-2 sm:gap-2.5">
          <div className="flex items-center justify-between gap-2 sm:min-h-[1.125rem]">
            <Skeleton className="h-3 w-2/5 rounded-full sm:h-3.5" />
            <Skeleton className="h-3.5 w-1/4 rounded-full sm:h-4" />
          </div>

          <div className="space-y-1">
            <Skeleton className="h-4 rounded-full sm:h-4.5" />
            <Skeleton className="h-4 w-4/5 rounded-full sm:h-4.5" />
          </div>
        </div>

        <div className="pt-4 sm:pt-[18px]">
          <Skeleton className="h-5 w-3/4 rounded-full sm:h-6" />
        </div>
      </div>
    </div>
  );
}
