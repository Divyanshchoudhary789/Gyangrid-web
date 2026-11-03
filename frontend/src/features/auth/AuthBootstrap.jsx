import { useEffect, useState } from 'react';
import { isMockMode } from '@/services/http';
import { authReady, onFirebaseUserChanged, firebaseConfigured } from '@/services/auth/firebase';
import { authApi } from '@/services/api/student';
import { useAuthStore, useAdminStore } from '@/store/authStore';
import { clearQueryCache } from '@/hooks/useQuery';
import { ERROR_CODES } from '@/services/errors';
import { LogoMark } from '@/components/brand/Logo';

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50" role="status" aria-live="polite">
      <LogoMark className="h-14 w-14 animate-pulse" />
      <p className="text-sm font-semibold text-ink-500">Loading Gyaangrid…</p>
    </div>
  );
}

/**
 * Real mode: Firebase restores its session asynchronously. Until it has, route guards must not decide
 * (otherwise a signed-in student would flash the login page). We then refresh the app profile from the
 * backend so onboarding status and class are always current.
 */
export function AuthBootstrap({ children }) {
  const [ready, setReady] = useState(() => isMockMode() || !firebaseConfigured());

  useEffect(() => {
    if (isMockMode() || !firebaseConfigured()) return undefined;
    let cancelled = false;
    (async () => {
      const fbUser = await authReady();
      const store = useAuthStore.getState();
      if (!fbUser) {
        if (store.token) { store.clear(); clearQueryCache(); }
        useAdminStore.getState().clear();
      } else if (useAdminStore.getState().token) {
        // The browser's Firebase session belongs to an admin; the admin console verifies it itself.
        if (store.token) store.clear();
      } else {
        try {
          const user = await authApi.me();
          if (cancelled) return;
          if (user.role === 'ADMIN') useAuthStore.getState().clear(); // admins use /admin, never the student app
          else useAuthStore.getState().setSession({ token: fbUser.uid, user });
        } catch (e) {
          // Keep the cached profile when offline; drop the session only if the backend rejects it.
          if (e.code === ERROR_CODES.UNAUTHENTICATED || e.code === ERROR_CODES.ACCOUNT_SUSPENDED) useAuthStore.getState().clear();
          else if (!store.user) useAuthStore.getState().setSession({ token: fbUser.uid, user: null });
        }
      }
      if (!cancelled) setReady(true);
    })();
    // Signed out in another tab, or the session was revoked.
    const unsub = onFirebaseUserChanged((u) => {
      if (u) return;
      if (useAuthStore.getState().token) { useAuthStore.getState().clear(); clearQueryCache(); }
      if (useAdminStore.getState().token) useAdminStore.getState().clear();
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  return ready ? children : <Splash />;
}
