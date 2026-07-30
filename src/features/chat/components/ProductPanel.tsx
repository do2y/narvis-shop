import { MessagesSquare } from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import type { ChatResult, ProductGroup } from "@/shared/types/chat";
import { formatPrice } from "@/shared/utils/formatPrice";
import { ChatProductCard } from "./ChatProductCard";

interface ProductPanelProps {
  results: ChatResult[];
  isStreaming: boolean;
}

const GRID = "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3";

export function ProductPanel({ results, isStreaming }: ProductPanelProps) {
  // SHOPPING 채널은 상품 결과만 표시한다(다른 kind는 이 채널에 오지 않음)
  const groups = results.flatMap((r) => (r.kind === "products" ? r.groups : []));
  const isEmpty = groups.length === 0;

  if (isEmpty && isStreaming) {
    return (
      <div className="p-4 sm:p-6">
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
          대화를 시작하면 추천 상품이 여기에 표시돼요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-6">
      {groups.map((group) => (
        <section
          key={group.title}
          className="flex animate-in flex-col gap-4 duration-300 fade-in slide-in-from-bottom-2"
        >
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold tracking-tight">{group.title}</h2>
            <RecommendationSummary recommendation={group.recommendation} />
          </div>
          <div className={GRID}>
            {group.items.map((product) => (
              <ChatProductCard key={product.productId} product={product} />
            ))}
          </div>
        </section>
      ))}
    </div>
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
    <div className="flex flex-col overflow-hidden rounded-sm border">
      <Skeleton className="aspect-square rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-3 w-1/3 rounded-full" />
        <Skeleton className="h-4 w-4/5 rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="mt-2 h-5 w-1/2 rounded-full" />
      </div>
    </div>
  );
}
