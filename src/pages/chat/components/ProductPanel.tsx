import { MessagesSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductGroup } from "@/shared/types/chat";
import { ChatProductCard } from "./ChatProductCard";

interface ProductPanelProps {
  groups: ProductGroup[];
  isStreaming: boolean;
}

const GRID = "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3";

// 우측 상품 패널 — 상황 추천은 카테고리별 그룹으로 묶어 표시
export function ProductPanel({ groups, isStreaming }: ProductPanelProps) {
  const isEmpty = groups.length === 0;

  // 상품 찾는 중(스트리밍 + 아직 결과 없음) → 스켈레톤 카드로 로딩 표현
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

  // 대화 시작 전 빈 상태
  if (isEmpty) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <MessagesSquare className="size-7" />
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
        <section key={group.title} className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{group.title}</h2>
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

// 실제 상품 카드와 같은 레이아웃(정사각 이미지 + 텍스트 줄)의 스켈레톤
function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border">
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
