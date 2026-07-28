import { Suspense } from "react";
import CartPage from "@/features/cart";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CartPage />
    </Suspense>
  );
}
