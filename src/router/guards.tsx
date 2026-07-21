import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/authStore';

function loginRedirect(pathname: string, search: string) {
  const returnUrl = encodeURIComponent(pathname + search);
  return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
}

/** 로그인(회원 이상) 필요 라우트 가드 */
export function RequireAuth() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return loginRedirect(location.pathname, location.search);
  return <Outlet />;
}

/** 특정 역할(판매자/관리자) 필요 라우트 가드 */
export function RequireRole({ role }: { role: 'SELLER' | 'ADMIN' }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return loginRedirect(location.pathname, location.search);
  if (user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
