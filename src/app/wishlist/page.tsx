import { Suspense } from "react";
import WishlistPage from "@/features/wishlist";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WishlistPage />
    </Suspense>
  );
}
