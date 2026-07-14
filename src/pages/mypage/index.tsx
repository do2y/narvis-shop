import { Navigate, Route, Routes } from "react-router-dom";
import { AppHeader } from "@/shared/ui/AppHeader";
import { ProfileHeader } from "./components/ProfileHeader";
import { MyPageNav } from "./components/MyPageNav";
import OrdersPage from "./OrdersPage";
import OrderDetailPage from "./OrderDetailPage";
import ClaimsPage from "./ClaimsPage";
import ReviewWritePage from "./ReviewWritePage";
import RecentProductsPage from "./RecentProductsPage";
import WishlistPage from "./WishlistPage";
import AddressesPage from "./AddressesPage";
import InquiriesPage from "./InquiriesPage";

export default function MyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-20 sm:p-6">
        <ProfileHeader />

        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-10">
          <MyPageNav />
          <div className="min-w-0 flex-1">
            <Routes>
              <Route index element={<Navigate to="orders" replace />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:orderId" element={<OrderDetailPage />} />
              <Route path="reviews/new" element={<ReviewWritePage />} />
              <Route path="claims" element={<ClaimsPage />} />
              <Route path="recent" element={<RecentProductsPage />} />
              <Route path="wishlist" element={<WishlistPage />} />
              <Route path="addresses" element={<AddressesPage />} />
              <Route path="inquiries" element={<InquiriesPage />} />
              {/* 알 수 없는 하위 경로 → 주문 내역으로 */}
              <Route path="*" element={<Navigate to="orders" replace />} />
            </Routes>
          </div>
        </div>
      </main>
    </div>
  );
}
