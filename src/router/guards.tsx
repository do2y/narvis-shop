import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/authStore';

function loginRedirect(pathname: string, search: string) {
  const returnUrl = encodeURIComponent(pathname + search);
  return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
}

/**
 * 세션 복원(refresh → me) 중에는 판정을 미룬다.
 * 없으면 새로고침 때마다 user가 잠깐 비어 보여 로그인 화면으로 튕긴다.
 */
function useAuthGate() {
  const user = useAuthStore((s) => s.user);
  const isRestoring = useAuthStore((s) => s.isRestoring);
  return { user, isRestoring };
}

/** 로그인(회원 이상) 필요 라우트 가드 */
export function RequireAuth() {
  const { user, isRestoring } = useAuthGate();
  const location = useLocation();
  if (isRestoring) return null;
  if (!user) return loginRedirect(location.pathname, location.search);
  return <Outlet />;
}

/** 특정 역할(판매자/관리자) 필요 라우트 가드 */
export function RequireRole({ role }: { role: 'SELLER' | 'ADMIN' }) {
  const { user, isRestoring } = useAuthGate();
  const location = useLocation();
  if (isRestoring) return null;
  if (!user) return loginRedirect(location.pathname, location.search);
  // role은 /api/auth/me로 덮어쓴 서버 값 — persist된 localStorage 값이 아니다.
  if (user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
