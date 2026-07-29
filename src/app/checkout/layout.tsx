import { RequireAuth } from "@/shared/auth/guards";

// 구매는 로그인 필요(원본 router/index.tsx의 RequireAuth 중첩).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
