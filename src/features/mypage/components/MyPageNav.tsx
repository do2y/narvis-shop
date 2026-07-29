"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MENU = [
  { to: "/mypage/orders", label: "주문 내역" },
  { to: "/mypage/claims", label: "취소·반품" },
  { to: "/mypage/recent", label: "최근 본 상품" },
  { to: "/mypage/wishlist", label: "찜" },
  { to: "/mypage/addresses", label: "배송지 관리" },
  { to: "/mypage/inquiries", label: "문의 내역" },
];

export function MyPageNav() {
  // 원본 NavLink의 isActive를 pathname 대조로 대체(계획서 3장 스니펫).
  // 하위 경로 포함 매칭 — /mypage/orders/123에서도 "주문 내역"이 활성이어야 한다.
  const pathname = usePathname();

  return (
    <nav>
      {/* 모바일: 가로 스크롤 필 / 데스크탑: 세로 리스트 (Apple 설정앱 스타일 셀) */}
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {MENU.map((item) => {
          const isActive =
            pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <li key={item.to} className="shrink-0 lg:shrink">
              <Link
                href={item.to}
                className={cn(
                  "group flex h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-all duration-200 active:scale-[0.98] lg:justify-between lg:rounded-sm lg:px-3.5",
                  isActive
                    ? "bg-primary text-primary-foreground lg:bg-muted lg:text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span className="tracking-tight">{item.label}</span>
                <ChevronRight
                  className={cn(
                    "hidden size-4 shrink-0 transition-colors lg:block",
                    isActive
                      ? "text-muted-foreground"
                      : "text-muted-foreground/40 group-hover:text-muted-foreground",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
