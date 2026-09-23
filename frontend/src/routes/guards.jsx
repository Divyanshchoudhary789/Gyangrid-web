import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore, useAdminStore } from '@/store/authStore';

/** UI guards only improve UX — every rule is also enforced by the API (F1-07, SEC-03). */
export function RequireAuth() {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export function RequireOnboarded() {
  const user = useAuthStore((s) => s.user);
  if (!user?.onboarded) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export function RequireNotOnboarded() {
  const user = useAuthStore((s) => s.user);
  if (user?.onboarded) return <Navigate to="/home" replace />;
  return <Outlet />;
}

export function PublicOnly() {
  const { token, user } = useAuthStore();
  if (token && user) return <Navigate to={user.onboarded ? '/home' : '/onboarding'} replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const token = useAdminStore((s) => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
