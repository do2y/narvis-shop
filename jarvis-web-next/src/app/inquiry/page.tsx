import { Suspense } from "react";
import InquiryPage from "@/features/inquiry";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InquiryPage />
    </Suspense>
  );
}
