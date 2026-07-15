import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInquiries } from "./useInquiries";
import { InquiryCard } from "./components/InquiryCard";

function InquiriesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-sm border bg-background px-5 py-4"
        >
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-5 flex-1 max-w-56" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function InquiriesPage() {
  const { data: inquiries, isPending, isError, refetch } = useInquiries();

  return (
    <div>
      <h2 className="text-lg font-bold">문의 내역</h2>

      <div className="mt-5">
        {isPending ? (
          <InquiriesSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">
              문의 내역을 불러오지 못했어요.
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
        ) : inquiries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed py-16 text-center">
            <p className="text-sm font-medium">문의 내역이 없어요</p>
            <p className="text-sm text-muted-foreground">
              문의 챗봇으로 궁금한 점을 남기면 여기에서 확인할 수 있어요.
            </p>
            <Link
              to="/chat"
              className={cn(buttonVariants(), "mt-1 h-11 rounded-full px-6")}
            >
              문의하러 가기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {inquiries.map((inquiry) => (
              <InquiryCard key={inquiry.inquiryId} inquiry={inquiry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
