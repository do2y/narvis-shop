import { Suspense } from "react";
import OrdersPage from "@/features/seller/OrdersPage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OrdersPage />
    </Suspense>
  );
}
