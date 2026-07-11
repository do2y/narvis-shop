import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOrders } from "./useOrders";
import { OrderCard } from "./components/OrderCard";

function OrdersSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border bg-background">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex gap-4 px-5 py-4">
            <Skeleton className="size-16 rounded-xl sm:size-20" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const { data: orders, isPending, isError, refetch } = useOrders();

  return (
    <div>
      <h2 className="text-lg font-bold">주문 내역</h2>

      <div className="mt-5">
        {isPending ? (
          <OrdersSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">
              주문 내역을 불러오지 못했어요.
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
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm font-medium">아직 주문 내역이 없어요</p>
            <p className="text-sm text-muted-foreground">
              마음에 드는 상품을 찾아 첫 주문을 시작해보세요.
            </p>
            <Link
              to="/"
              className={cn(buttonVariants(), "mt-1 h-11 rounded-full px-6")}
            >
              쇼핑하러 가기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {orders.map((order) => (
              <OrderCard key={order.orderId} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
