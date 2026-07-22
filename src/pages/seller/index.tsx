import { Outlet, Route, Routes } from "react-router-dom";
import { SellerHeader } from "./components/SellerHeader";
import DashboardPage from "./DashboardPage";
import OrdersPage from "./OrdersPage";
import ProductsPage from "./ProductsPage";
import SellerChatPage from "./ChatPage";

/**
 * 판매자 페이지 라우터.
 * AI 협업(목록을 보며 대화)은 /seller/chat 한 화면에서만 제공한다 —
 * 주문·상품 관리 페이지에는 채팅 UI를 두지 않는다.
 */
export default function SellerPage() {
  return (
    <Routes>
      <Route path="chat" element={<SellerChatPage />} />
      <Route element={<SellerShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}

/** 판매자 셸 — 헤더 + 본문(대시보드·목록). AI 채팅은 별도 화면(/seller/chat)이다. */
function SellerShell() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SellerHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
