import { Suspense } from "react";
import ReviewWritePage from "@/features/mypage/ReviewWritePage";

// useSearchParams(orderItemId·productId)를 쓰므로 Suspense 경계가 필요하다.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReviewWritePage />
    </Suspense>
  );
}
