import { Suspense } from "react";
import ReportsPage from "@/features/seller/ReportsPage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReportsPage />
    </Suspense>
  );
}
