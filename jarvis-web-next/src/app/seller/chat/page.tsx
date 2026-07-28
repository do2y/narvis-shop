import { Suspense } from "react";
import SellerChatPage from "@/features/seller/ChatPage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SellerChatPage />
    </Suspense>
  );
}
