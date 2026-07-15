import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Heart, ShoppingCart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/shared/stores/authStore";

interface AppHeaderProps {
  showMenu?: boolean;
  leftSlot?: React.ReactNode;
}

export function AppHeader({ showMenu = true, leftSlot }: AppHeaderProps) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              J
            </span>
            <span className="text-lg font-bold tracking-tight">Jarvis</span>
          </Link>
          {leftSlot}
        </div>

        {showMenu && (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/wishlist"
              aria-label="찜 목록"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-9",
              )}
            >
              <Heart className="size-5" />
            </Link>
            <Link
              to="/cart"
              aria-label="장바구니"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-9",
              )}
            >
              <ShoppingCart className="size-5" />
            </Link>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "ml-1 h-9 gap-1 px-2 text-sm font-medium sm:ml-2",
                  )}
                >
                  {user.nickname}님
                  <ChevronDown className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem render={<Link to="/mypage" />}>
                    마이페이지
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleLogout}
                  >
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link
                  to="/login"
                  className={cn(buttonVariants({ variant: "ghost" }), "h-9")}
                >
                  로그인
                </Link>
                <Link
                  to="/signup"
                  className={cn(buttonVariants(), "h-9 rounded-full px-4")}
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
