import { RequireAuth } from "@/shared/auth/guards";
import { MyPageShell } from "@/features/mypage/MyPageShell";

// 마이페이지 전체가 로그인 필요(원본 router/index.tsx의 RequireAuth 중첩).
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <MyPageShell>{children}</MyPageShell>
    </RequireAuth>
  );
}
