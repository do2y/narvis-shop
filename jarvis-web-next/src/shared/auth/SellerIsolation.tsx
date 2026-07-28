"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/shared/stores/authStore";

/**
 * 판매자를 쇼핑몰(구매자) 라우트에서 격리한다 — 원본 `BlockSeller` 가드의 대체.
 *
 * 원본은 라우터 트리에서 구매자 라우트를 `<BlockSeller>`로 감쌌다. App Router에서
 * 같은 형태로 하려면 폴더를 라우트 그룹으로 대거 이동해야 하는데, 그건 1:1 이식
 * 범위를 넘는 구조 변경이라 루트 레이아웃에서 경로로 판정한다(동작은 동일).
 *
 * 통과시키는 경로: /seller/* (판매자 자기 영역), /login·/signup (판매자도 접근해야 함).
 * 그 외 경로에 SELLER가 오면 /seller로 돌려보낸다.
 */
const ALLOWED_PREFIXES = ["/seller", "/login", "/signup"];

export function SellerIsolation({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isRestoring = useAuthStore((s) => s.isRestoring);
  const pathname = usePathname();
  const router = useRouter();

  const isSeller = user?.role === "SELLER";
  const allowed = ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const blocked = !isRestoring && isSeller && !allowed;

  useEffect(() => {
    if (blocked) router.replace("/seller");
  }, [blocked, router]);

  // 복원 중에는 판정을 보류한다 — 없으면 새로고침마다 화면이 깜빡인다.
  if (blocked) return null;
  return <>{children}</>;
}
