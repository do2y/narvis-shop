"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronDown, LogOut } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLogout } from "@/shared/hooks/useLogout";
import { useAuthStore } from "@/shared/stores/authStore";

/**
 * 대시보드 + 판매자가 하루에 도는 순서 — 들어온 주문을 처리하고(주문), 그 결과로
 * 재고·상세를 손보고(상품), 성과를 확인한 뒤(보고서), 필요하면 AI에게 맡긴다.
 *
 * 대시보드를 메뉴에 남기는 이유: 로고도 같은 곳을 가리키지만 로고는 활성 표시를
 * 받지 못하고 "홈이 대시보드인지 쇼핑몰인지"도 화면에서 알 수 없다. 다른 화면에서
 * 돌아오는 길이 눈에 보이는 편이 낫다(로고는 보조 진입로로 함께 둔다).
 *
 * end:true 는 정확 일치용 — 없으면 /seller/orders 에서도 대시보드가 활성이 된다.
 */
const MENU = [
  { to: "/seller", label: "대시보드", end: true },
  { to: "/seller/orders", label: "주문" },
  { to: "/seller/products", label: "상품" },
  { to: "/seller/reports", label: "보고서" },
  { to: "/seller/chat", label: "AI 에이전트" },
];

// 원본 NavLink의 isActive 판정을 그대로 옮긴다(계획서 3장 스니펫).
// end:true 는 정확 일치용 — 하위 경로를 갖지 않는 항목에 쓴다.
function isMenuActive(
  pathname: string,
  item: { to: string; end?: boolean },
): boolean {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

interface SellerHeaderProps {
  /**
   * 페이지 네비(대시보드/주문/상품/AI) 노출 여부. 기본 true.
   * AI 채팅 화면은 우측에서 주문·상품을 이미 다루므로 네비를 숨겨 워크스페이스에 집중시킨다
   * (돌아가는 길은 로고→홈/대시보드가 담당).
   */
  showNav?: boolean;
  /**
   * 로고 오른쪽 슬롯 — 그 화면에서만 쓰는 동작 버튼을 넣는다("새 대화").
   * AppHeader 와 같은 이름·같은 자리다. 두 챗 화면이 같은 위치에서 같게 동작해야 한다.
   */
  leftSlot?: React.ReactNode;
}

/**
 * 판매자 전용 헤더 — 로고·네비·계정을 한 줄에.
 * AppHeader(찜·장바구니 등 쇼핑 동선)는 판매자 업무와 무관해 쓰지 않는다.
 * AI 협업은 네비의 "AI 어시스턴트"(/seller/chat)로 진입한다.
 */
export function SellerHeader({ showNav = true, leftSlot }: SellerHeaderProps) {
  const user = useAuthStore((s) => s.user);
  const handleLogout = useLogout();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        {/* 로고 + 화면별 동작 슬롯 — AppHeader 와 같은 묶음·같은 gap-4 */}
        <div className="flex min-w-0 items-center gap-4">
          {/* 로고 → 판매자 홈(대시보드). 메뉴의 "대시보드"와 같은 목적지이며 여기는
              보조 진입로다 — 판매자 화면에서 로고를 누르면 쇼핑몰이 아니라 자기
              업무 홈으로 오는 편이 자연스럽다. */}
          <Link
            href="/seller"
            aria-label="판매자 대시보드"
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {/* 구매자 헤더와 같은 심볼 — 두 화면이 같은 로고로 읽혀야 한다 */}
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local logo mark shared with buyer header */}
            <img
              src="/logo-mark.png"
              alt=""
              aria-hidden
              className="size-7 shrink-0"
            />
            {/* 워드마크와 Seller 는 baseline 으로 맞춘다 — 크기가 달라 가운데 정렬하면
                글자 밑선이 어긋난다. 심볼만 바깥에서 세로 가운데로 맞춘다. */}
            <span className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight text-wordmark">
                Narvis
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Seller
              </span>
            </span>
          </Link>
          {leftSlot}
        </div>

        {/* 데스크탑: 헤더 안 네비 / 모바일: 아래 줄로 분리 */}
        <nav
          aria-label="판매자 메뉴"
          className={cn("hidden", showNav && "md:block")}
        >
          <ul className="flex items-center gap-1">
            {MENU.map((item) => {
              const active = isMenuActive(pathname, item);
              return (
                <li key={item.to}>
                  <Link
                    href={item.to}
                    // 활성 표시를 색·굵기로만 주면 스크린리더는 알 수 없다.
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center whitespace-nowrap rounded-full px-3.5 text-sm",
                      "transition-[color,background-color] duration-150 ease-out-strong",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-muted font-bold text-foreground"
                        : "font-medium text-muted-foreground hover:[@media(hover:hover)]:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-11 shrink-0 gap-1.5 rounded-full px-3 text-sm font-medium",
              )}
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {user.nickname.charAt(0)}
              </span>
              <span className="hidden sm:inline">{user.nickname}</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="w-56 rounded-xl p-1.5 shadow-lg"
            >
              <div className="flex items-center gap-2.5 px-1.5 py-1.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {user.nickname.charAt(0)}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold leading-tight">
                    {user.nickname}
                  </span>
                  <span className="text-xs text-muted-foreground">판매자</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={handleLogout}
                className="rounded-lg py-2"
              >
                <LogOut />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* 모바일 네비 — 헤더에 다 넣으면 좁아서 아래 줄로.
          5개라 360px 에서는 "AI 에이전트"가 넘친다 — overflow-x-auto 로 그 줄만
          가로 스크롤한다(페이지 본문은 넘치지 않으므로 CLAUDE.md 의 가로 스크롤
          금지에 걸리지 않는다). 활성 항목은 진입 시 보이는 자리에 오도록 왼쪽부터
          업무 순서대로 둔다. */}
      {showNav && (
      <nav aria-label="판매자 메뉴" className="md:hidden">
        <ul className="flex gap-1 overflow-x-auto border-t px-4 sm:px-6">
          {MENU.map((item) => {
            const active = isMenuActive(pathname, item);
            return (
              <li key={item.to} className="shrink-0">
                <Link
                  href={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm",
                    "transition-[color,border-color] duration-150 ease-out-strong",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    active
                      ? "border-foreground font-bold text-foreground"
                      : "border-transparent font-medium text-muted-foreground hover:[@media(hover:hover)]:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      )}
    </header>
  );
}
