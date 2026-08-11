"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MENU = [
  // AI 개인화가 이 서비스의 핵심 기능이라 주문 내역보다 앞에 둔다.
  // featured: 나머지가 "기록 조회"인 것과 달리 이것만 이 서비스의 고유 기능이라
  // 같은 모양으로 두면 목록에 묻힌다(아래 스타일 주석 참조).
  { to: "/mypage/preferences", label: "내 취향 나비게이션", featured: true },
  { to: "/mypage/orders", label: "주문 내역" },
  { to: "/mypage/claims", label: "취소·반품" },
  { to: "/mypage/recent", label: "최근 본 상품" },
  { to: "/mypage/wishlist", label: "찜" },
  { to: "/mypage/addresses", label: "배송지 관리" },
];

export function MyPageNav() {
  // 원본 NavLink의 isActive를 pathname 대조로 대체(계획서 3장 스니펫).
  // 하위 경로 포함 매칭 — /mypage/orders/123에서도 "주문 내역"이 활성이어야 한다.
  const pathname = usePathname();

  return (
    <nav aria-label="마이페이지 메뉴">
      {/* 모바일은 가벼운 스크롤 탭 바, 데스크탑은 기존 세로 목록을 유지한다. */}
      <div className="overflow-x-auto border-b border-border/60 px-4 scroll-px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-0 lg:overflow-visible lg:border-b-0">
        <ul className="flex w-max min-w-full items-center gap-5 lg:flex-col lg:gap-0.5">
          {MENU.map((item) => {
            const isActive =
              pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <li key={item.to} className="shrink-0 lg:w-full">
                <Link
                  href={item.to}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative inline-flex h-11 items-center whitespace-nowrap px-0.5 text-[15px] font-medium tracking-tight text-muted-foreground transition-[color] duration-150 ease-out-strong",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "after:absolute after:bottom-[-1px] after:left-0.5 after:right-0.5 after:h-0.5 after:rounded-full after:bg-brand after:opacity-0 after:transition-opacity after:duration-150",
                    "lg:flex lg:w-full lg:justify-between lg:rounded-sm lg:px-3.5 lg:text-sm lg:after:hidden",
                    isActive
                      ? "font-semibold text-wordmark after:opacity-100 lg:bg-muted lg:font-medium lg:text-foreground"
                      : "hover:[@media(hover:hover)]:text-foreground lg:hover:bg-muted/60",
                    /*
                      이 서비스의 고유 기능이라는 표식은 데스크탑 목록에서만 남긴다.
                      모바일에선 탭 전부를 같은 계층의 내비게이션으로 읽히게 해야 해
                      배경·알약 처리 없이 텍스트와 인디케이터만 쓴다.
                    */
                    item.featured && [
                      "lg:before:absolute lg:before:left-0 lg:before:top-1/2 lg:before:h-5 lg:before:w-[3px] lg:before:-translate-y-1/2 lg:before:rounded-full",
                      "lg:before:bg-[linear-gradient(180deg,#8FB4F2,#8FD3A6_55%,#F0D274)]",
                      "lg:before:transition-opacity lg:before:duration-200",
                      isActive
                        ? "lg:before:opacity-100"
                        : "lg:before:opacity-45 lg:hover:before:opacity-100",
                      !isActive &&
                        "lg:bg-brand/[0.05] lg:hover:bg-brand/[0.085]",
                    ],
                  )}
                >
                  <span>{item.label}</span>
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
      </div>
    </nav>
  );
}
