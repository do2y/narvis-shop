import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

// 마이페이지 하위 메뉴 (docs/features.md 8번 표 기준)
const MENU = [
  { to: "/mypage/orders", label: "주문 내역" },
  { to: "/mypage/claims", label: "취소·반품·교환" },
  { to: "/mypage/recent", label: "최근 본 상품" },
  { to: "/mypage/wishlist", label: "찜" },
  { to: "/mypage/addresses", label: "배송지 관리" },
  { to: "/mypage/inquiries", label: "문의 내역" },
];

export function MyPageNav() {
  return (
    // 모바일: 가로 스크롤 탭 / 데스크탑: 좌측 세로 메뉴
    <nav className="lg:w-48 lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        {MENU.map((item) => (
          <li key={item.to} className="shrink-0">
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex h-11 items-center whitespace-nowrap rounded-xl px-4 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
