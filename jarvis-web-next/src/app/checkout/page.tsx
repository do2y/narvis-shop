import { Suspense } from "react";
import CheckoutPage from "@/features/checkout";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckoutPage />
    </Suspense>
  );
}
