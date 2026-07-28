import { RequireRole } from "@/shared/auth/guards";

// /admin/* 은 ADMIN 전용(원본 router/index.tsx).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireRole role="ADMIN">{children}</RequireRole>;
}
