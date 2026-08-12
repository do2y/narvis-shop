"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/shared/stores/authStore";

/**
 * 라우트 가드 — 원본 `src/router/guards.tsx`를 App Router 레이아웃용으로 옮긴 것.
 *
 * `<Outlet />` 대신 children을 받는다(레이아웃이 감싸는 형태).
 * 리다이렉트는 렌더 중 <Navigate>가 아니라 이펙트에서 router.replace로 수행한다 —
 * Next에서는 렌더 중 내비게이션이 경고를 낸다.
 *
 * **proxy.ts(구 middleware)로 옮기지 않는 이유**: AT가 메모리에만 있어 서버가 인증
 * 상태를 알 수 없다. 가드는 UX 필터일 뿐이고 최종 방어선은 백엔드다(CLAUDE.md).
 */

/**
 * 세션 복원(refresh → me) 중에는 판정을 미룬다.
 * 없으면 새로고침 때마다 user가 잠깐 비어 보여 로그인 화면으로 튕긴다.
 */
function useAuthGate() {
  const user = useAuthStore((s) => s.user);
  const isRestoring = useAuthStore((s) => s.isRestoring);
  return { user, isRestoring };
}

/**
 * 현재 경로+쿼리를 returnUrl로 만들어 로그인으로 보낸다.
 *
 * useSearchParams를 쓰지 않는 이유: 가드는 화면 전체를 감싸므로 그 훅을 쓰면
 * 보호된 페이지 전부가 Suspense 경계에 묶여 SSR에서 통째로 비워진다.
 * 이 함수는 리다이렉트 시점(클라이언트)에만 호출되므로 window에서 읽는다.
 */
function useLoginRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  return () => {
    const qs = window.location.search;
    const returnUrl = encodeURIComponent(pathname + qs);
    router.replace(`/login?returnUrl=${returnUrl}`);
  };
}

/** 로그인(회원 이상) 필요 라우트 가드 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isRestoring } = useAuthGate();
  const redirectToLogin = useLoginRedirect();

  useEffect(() => {
    if (!isRestoring && !user) redirectToLogin();
    // redirectToLogin은 매 렌더 새 함수라 의존성에서 뺀다(넣으면 매번 재실행).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoring, user]);

  if (isRestoring || !user) return null;
  return <>{children}</>;
}

/** 특정 역할(판매자/관리자) 필요 라우트 가드 */
export function RequireRole({
  role,
  children,
}: {
  role: "SELLER" | "ADMIN";
  children: React.ReactNode;
}) {
  const { user, isRestoring } = useAuthGate();
  const router = useRouter();
  const redirectToLogin = useLoginRedirect();

  useEffect(() => {
    if (isRestoring) return;
    if (!user) {
      redirectToLogin();
      return;
    }
    // role은 /api/auth/me로 덮어쓴 서버 값 — persist된 localStorage 값이 아니다.
    // 역할이 안 맞으면 쇼핑몰 홈으로 보낸다 — 이미 로그인해 서비스를 쓰던 사람이라
    // 루트(랜딩=서비스 소개)로 되돌리면 "처음 온 사람" 취급이 된다.
    if (user.role !== role) router.replace("/home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoring, user, role]);

  if (isRestoring || !user || user.role !== role) return null;
  return <>{children}</>;
}

/**
 * 판매자를 쇼핑몰(구매자) 라우트에서 격리하는 가드.
 * 판매자는 /seller/* 밖으로 나가면 안 되므로, 그 밖의 라우트에 오면 대시보드로 돌려보낸다.
 * (게스트·일반 회원·관리자는 그대로 통과 — SELLER만 걸러낸다.)
 */
export function BlockSeller({ children }: { children: React.ReactNode }) {
  const { user, isRestoring } = useAuthGate();
  const router = useRouter();

  useEffect(() => {
    if (!isRestoring && user?.role === "SELLER") router.replace("/seller");
  }, [isRestoring, user, router]);

  if (isRestoring) return null;
  if (user?.role === "SELLER") return null;
  return <>{children}</>;
}
