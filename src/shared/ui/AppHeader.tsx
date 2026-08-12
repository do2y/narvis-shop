"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Heart,
  LogOut,
  MessageSquare,
  ShoppingCart,
  User,
} from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { saveChat } from "@/shared/chat/chatPersistence";
import { useChatStore } from "@/shared/chat/store";
import { useCartItemCount } from "@/shared/hooks/useCart";
import { useLogout } from "@/shared/hooks/useLogout";
import { useAuthStore, type UserRole } from "@/shared/stores/authStore";

interface AppHeaderProps {
  showMenu?: boolean;
  leftSlot?: React.ReactNode;
}

// 역할 한글 라벨 — 드롭다운 계정 헤더의 배지에 사용
const ROLE_LABEL: Record<UserRole, string> = {
  USER: "일반 회원",
  SELLER: "판매자",
  ADMIN: "관리자",
};

// 헤더 아이콘 링크 — 44px 터치 타깃, 활성 경로 강조, title 툴팁 + aria-label 병행.
// active 판단은 현재 pathname과 대조(경로 일치 시 배경·색으로 현재 위치 표시).
function NavIconLink({
  to,
  label,
  badge,
  compact = false,
  className,
  children,
}: {
  to: string;
  label: string;
  badge?: number;
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  // 0(빈 장바구니)이면 뱃지를 숨긴다. 99를 넘으면 자릿수가 늘어 아이콘을 가리므로 99+로 절삭.
  const badgeText = !badge ? undefined : badge > 99 ? "99+" : String(badge);
  const pathname = usePathname();
  // 원본 NavLink의 기본 동작(하위 경로 포함 매칭)과 맞춘다.
  // 여기 쓰이는 경로(/chat·/wishlist·/cart)는 하위 경로가 없어 결과가 동일하다.
  const isActive = pathname === to || pathname.startsWith(`${to}/`);

  return (
    <Link
      href={to}
      // 뱃지 수를 라벨에 포함해 스크린리더에도 개수가 전달되게 한다
      aria-label={badge ? `${label} (${badge}개)` : label}
      title={label}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        // 최소 44px 클릭 영역 (터치 안정성)
        compact ? "relative size-10 rounded-full min-[390px]:size-11" : "relative size-11 rounded-full",
        className,
        isActive && "bg-muted text-foreground",
      )}
    >
      {/* 뱃지가 있으면 아이콘을 살짝 내려 우상단에 뱃지 자리를 비운다.
          (아이콘 간격이 gap-0.5로 좁아 뱃지를 버튼 밖으로 빼면 옆 아이콘과 닿는다) */}
      <span
        className={cn(
          badgeText && (compact ? "translate-y-px" : "translate-y-0.5"),
        )}
      >
        {children}
      </span>
      {badgeText && (
        <span
          aria-hidden
          className={cn(
            "absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background",
            compact
              ? "right-0.5 top-0.5 min-[390px]:right-1 min-[390px]:top-1"
              : "right-1 top-1 sm:right-0.5",
          )}
        >
          {badgeText}
        </span>
      )}
    </Link>
  );
}

export function AppHeader({ showMenu = true, leftSlot }: AppHeaderProps) {
  const user = useAuthStore((s) => s.user);
  // 게스트도 장바구니를 쓰므로 로그인 여부와 무관하게 조회 (CLAUDE.md)
  const cartCount = useCartItemCount();

  // 채팅 진입점이 이미 있는 곳에선 헤더 채팅 버튼을 숨김:
  //  - 쇼핑몰 홈(/home): 히어로에 채팅 입력창이 있음
  //  - 채팅(/chat): 이미 그 페이지임
  // 그 외 페이지에선 상시 채팅 진입점으로 유지.
  // (루트 "/" 는 랜딩이고 LandingHeader 를 쓰므로 여기 조건에 넣지 않는다 —
  //  넣으면 정작 홈에서 히어로 입력창과 헤더 버튼이 겹쳐 두 개가 된다)
  const pathname = usePathname();
  const isChatPage = pathname.startsWith("/chat");
  const hasChatEntry = pathname === "/home" || pathname.startsWith("/chat");

  const handleLogout = useLogout();

  // 로그인 후 원래 보던 화면으로 돌려보낸다.
  // 채팅에서 떠날 땐 마지막 상태를 한 번 더 확정해 둔다 — 평소 저장은 useChatPersistence 가
  // 하지만, 채팅 페이지가 언마운트되며 구독이 끊기는 타이밍과 겹칠 수 있다.
  const authHref = (path: string) =>
    `${path}?returnUrl=${encodeURIComponent(pathname)}`;
  const handleAuthNavigate = () => {
    if (!pathname.startsWith("/chat")) return;
    const { messages, sessionId, results } = useChatStore.getState();
    saveChat({ messages, sessionId, results });
  };

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6">
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center sm:gap-4",
            isChatPage ? "gap-1.5 min-[390px]:gap-2" : "gap-2",
          )}
        >
          <Link
            href="/home"
            aria-label="Narvis 홈"
            className={cn(
              "flex items-center rounded-full sm:gap-2.5",
              isChatPage
                ? "shrink-0 gap-1.5 min-[390px]:gap-2"
                : "min-w-0 shrink gap-1.5",
            )}
          >
            {/* 워드마크 옆 심볼. alt=""·aria-hidden — 바로 옆 "Narvis" 와 Link 의
                aria-label 이 이미 이름을 말하므로 중복해 읽히지 않게 한다. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local logo mark; keeping parity with shared header variants */}
            <img
              src="/logo-mark.png"
              alt=""
              aria-hidden
              className="size-6 shrink-0 sm:size-7"
            />
            {isChatPage ? (
              <span className="hidden whitespace-nowrap text-[15px] font-bold tracking-tight text-wordmark min-[390px]:inline sm:text-lg">
                Narvis
              </span>
            ) : (
              <span className="truncate text-base font-bold tracking-tight text-wordmark sm:text-lg">
                Narvis
              </span>
            )}
          </Link>
          {leftSlot}
        </div>

        {showMenu && (
          <nav className="flex shrink-0 items-center">
            {/* 채팅: 핵심 기능 진입점 — 홈·채팅 화면엔 이미 진입점이 있어 숨김 */}
            {!hasChatEntry && (
              <NavIconLink
                to="/chat"
                label="채팅"
                compact={isChatPage}
                className={user ? "hidden sm:inline-flex" : undefined}
              >
                <MessageSquare className="size-5" />
              </NavIconLink>
            )}

            {/* 찜·장바구니: 항상 노출. 게스트는 각 페이지에서 로그인 유도/담기 처리 */}
            <div className="flex shrink-0 items-center gap-0.5 min-[390px]:gap-1 sm:gap-1">
              <NavIconLink to="/wishlist" label="찜 목록" compact={isChatPage}>
                <Heart className="size-[22px] translate-x-0.5 sm:size-5 sm:translate-x-0" />
              </NavIconLink>
              <NavIconLink
                to="/cart"
                label="장바구니"
                badge={cartCount}
                compact={isChatPage}
              >
                <ShoppingCart className="size-[22px] -translate-x-0.5 sm:size-5 sm:translate-x-0" />
              </NavIconLink>
            </div>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`${user.nickname}님 계정 메뉴`}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "ml-0.5 h-10 shrink-0 gap-0.5 rounded-full px-1 text-sm font-medium min-[390px]:ml-1 min-[390px]:h-11 min-[390px]:px-1.5 sm:gap-1.5 sm:px-3",
                  )}
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground sm:hidden">
                    {user.nickname.charAt(0)}
                  </span>
                  <span className="hidden sm:inline">{user.nickname}님</span>
                  {/* 열림 상태를 chevron 회전으로 피드백 */}
                  <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-aria-expanded/button:rotate-180 sm:size-4" />
                </DropdownMenuTrigger>
                {/* 페이지가 각진 카드(rounded-sm)로 가득 → 메뉴는 더 둥글고(rounded-xl)
                    그림자 깊은(shadow-lg) 떠 있는 층위로 구분해 '카드 하나 더'처럼 안 보이게(§12).
                    트리거 폭 고정(w-anchor-width) 해제, 오른쪽 끝 정렬 */}
                <DropdownMenuContent
                  align="end"
                  sideOffset={6}
                  className="w-56 rounded-xl p-1.5 shadow-lg"
                >
                  {/* 계정 헤더 — 배경·박스 없이 가볍게. "지금 누구로 로그인했는지" 재확인 */}
                  <div className="flex items-center gap-2.5 px-1.5 py-1.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {user.nickname.charAt(0)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold leading-tight">
                        {user.nickname}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_LABEL[user.role]}
                      </span>
                    </div>
                  </div>
                  {/* 구분선 1개만 — 정체성 ↔ 메뉴. 항목끼리는 이어 붙여 칸 분할감 줄임 */}
                  <DropdownMenuSeparator />
                  {!hasChatEntry && (
                    <DropdownMenuItem
                      render={<Link href="/chat" />}
                      className="rounded-lg py-2 sm:hidden"
                    >
                      <MessageSquare />
                      AI 채팅
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    render={<Link href="/mypage" />}
                    className="rounded-lg py-2"
                  >
                    <User />
                    마이페이지
                  </DropdownMenuItem>
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
            ) : (
              <>
                <Link
                  href={authHref("/login")}
                  onClick={handleAuthNavigate}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "ml-0.5 h-10 rounded-full px-2.5 text-[13px] font-medium whitespace-nowrap min-[390px]:ml-1 min-[390px]:px-3 sm:h-11 sm:px-3.5 sm:text-sm",
                  )}
                >
                  로그인
                </Link>
                <Link
                  href={authHref("/signup")}
                  onClick={handleAuthNavigate}
                  className={cn(
                    buttonVariants(),
                    "ml-1 h-[38px] rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap min-[390px]:px-4 sm:h-11 sm:px-4 sm:text-sm",
                  )}
                >
                  시작하기
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
