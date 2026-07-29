import { RequireRole } from "@/shared/auth/guards";

// /seller/* 전체가 SELLER 전용(원본 router/index.tsx의 RequireRole).
// 셸(헤더)은 (shell) 라우트 그룹에만 적용한다 — /seller/chat은 셸 없이 전체 화면.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireRole role="SELLER">{children}</RequireRole>;
}
