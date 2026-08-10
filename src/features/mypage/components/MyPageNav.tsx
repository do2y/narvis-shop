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
                  "group relative flex h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-all duration-200 active:scale-[0.98] lg:justify-between lg:rounded-sm lg:px-3.5",
                  // 포커스 링 — 키보드 사용자가 지금 어디 있는지 항상 보이게.
                  // 브랜드색 링이라 마우스 hover(회색 배경)와 성격이 구분된다.
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                  isActive
                    ? "bg-primary text-primary-foreground lg:bg-muted lg:text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  /*
                    이 서비스의 고유 기능이라는 표시.

                    나머지 5개는 "내가 한 일의 기록"(주문·찜·배송지)이고 이것만
                    AI가 만든 것이라, 같은 셀로 두면 성격 차이가 사라진다.

                    아이콘(스파클·별)을 쓰지 않는다 — AI를 아이콘으로 말하는 건
                    상투적이고, 여섯 항목 중 하나만 아이콘이 붙으면 정렬도 깨진다.
                    대신 **왼쪽 그라데이션 바**로 로고색(파랑→초록→노랑)을 얇게
                    끌어와 로고와 같은 계열임을 알린다. 비활성일 때는 옅게 두고
                    hover·활성에서 또렷해져, CTA처럼 튀지 않으면서 존재를 알린다.
                  */
                  item.featured && [
                    "before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full",
                    "before:bg-[linear-gradient(180deg,#8FB4F2,#8FD3A6_55%,#F0D274)]",
                    "before:transition-opacity before:duration-200",
                    // 모바일 알약은 좌측에 여백이 없어 바가 글자에 닿는다 —
                    // 데스크탑(세로 목록)에서만 바를 쓰고, 모바일은 배경으로 구분
                    "before:hidden lg:before:block",
                    isActive
                      ? "lg:before:opacity-100"
                      : "before:opacity-45 hover:before:opacity-100",
                    // 비활성일 때도 아주 옅은 배경을 깔아 목록에서 먼저 눈에 든다.
                    // 활성 상태(bg-muted)를 이기지 않을 만큼만 준다.
                    !isActive &&
                      "bg-brand/[0.045] hover:bg-brand/[0.085] lg:bg-brand/[0.05]",
                  ],
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
