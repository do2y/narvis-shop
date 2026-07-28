import { Suspense } from "react";
import OrderComplete from "@/features/checkout/OrderComplete";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OrderComplete />
    </Suspense>
  );
}
