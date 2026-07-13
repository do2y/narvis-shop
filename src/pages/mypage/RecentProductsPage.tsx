import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRecentProducts } from "./useRecentProducts";
import { RecentProductCard } from "./components/RecentProductCard";

function RecentProductsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex flex-col">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="mt-3 h-3 w-12" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function RecentProductsPage() {
  const { data: products, isPending, isError, refetch } = useRecentProducts();

  return (
    <div>
      <h2 className="text-lg font-bold">최근 본 상품</h2>

      <div className="mt-5">
        {isPending ? (
          <RecentProductsSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">
              최근 본 상품을 불러오지 못했어요.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 rounded-full px-5",
              )}
            >
              다시 시도
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm font-medium">아직 본 상품이 없어요</p>
            <p className="text-sm text-muted-foreground">
              관심 있는 상품을 둘러보면 여기에 모아드려요.
            </p>
            <Link
              to="/"
              className={cn(buttonVariants(), "mt-1 h-11 rounded-full px-6")}
            >
              쇼핑하러 가기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <RecentProductCard key={product.productId} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
