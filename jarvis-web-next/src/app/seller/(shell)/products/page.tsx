import { Suspense } from "react";
import ProductsPage from "@/features/seller/ProductsPage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProductsPage />
    </Suspense>
  );
}
