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
 * 통과시키는 경로: /seller/* (판매자 자기 영역), /login·/signup (판매자도 접근해야 함),
 * 그리고 루트 "/" (랜딩 = 서비스 소개 — 판매자도 자기 쪽 소개를 봐야 한다).
 * 그 외 경로에 SELLER가 오면 /seller로 돌려보낸다.
 *
 * 랜딩을 허용하는 이유: 이 화면은 쇼핑 기능이 아니라 **서비스 소개**다.
 * 판매자 탭이 그 안에 있어서 막으면 판매자가 자기 대상 소개 페이지에 못 들어간다.
 * 소개일 뿐이라 격리가 지키려는 것(판매자가 구매자 기능을 쓰는 것)은 그대로 막힌다 —
 * 랜딩의 구매자 CTA도 판매자에게는 판매자 채팅을 가리킨다(features/landing/cta.ts).
 *
 * ⚠️ 루트를 ALLOWED_PREFIXES 에 "/" 로 넣지 말 것 — 접두사 매칭이라 모든 경로가
 * 통과해 격리가 통째로 무력화된다. 루트만 정확히 일치로 따로 판정한다
 * (2026-08-12 랜딩이 /landing 에서 루트로 옮겨오면서 생긴 함정).
 */
const ALLOWED_PREFIXES = ["/seller", "/login", "/signup"];

/** 랜딩(루트) — 접두사가 아니라 정확히 이 경로일 때만 허용한다. */
const ALLOWED_EXACT = ["/"];

export function SellerIsolation({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isRestoring = useAuthStore((s) => s.isRestoring);
  const pathname = usePathname();
  const router = useRouter();

  const isSeller = user?.role === "SELLER";
  const allowed =
    ALLOWED_EXACT.includes(pathname) ||
    ALLOWED_PREFIXES.some(
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
