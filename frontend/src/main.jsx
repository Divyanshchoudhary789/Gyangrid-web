import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { setTokenProvider, setUnauthorizedHandler, isMockMode } from '@/services/http';
import { getIdToken } from '@/services/auth/firebase';
import { useAuthStore, useAdminStore } from '@/store/authStore';
import { clearQueryCache } from '@/hooks/useQuery';
import { track } from '@/lib/analytics';

if (isMockMode()) {
  setTokenProvider(async (scope) => (scope === 'admin' ? useAdminStore.getState().token : useAuthStore.getState().token));
} else {
  // Real backend: always a fresh Firebase ID token (the SDK refreshes it before expiry).
  setTokenProvider(async (_scope, forceRefresh) => getIdToken(Boolean(forceRefresh)));
}

// Expired / revoked session: clear local state and send the user to the right sign-in page.
setUnauthorizedHandler((scope) => {
  if (scope === 'admin') {
    useAdminStore.getState().clear();
    if (!window.location.pathname.startsWith('/admin/login')) window.location.assign('/admin/login');
    return;
  }
  useAuthStore.getState().clear();
  clearQueryCache();
  if (!['/login', '/signup', '/', '/forgot-password', '/privacy', '/terms'].includes(window.location.pathname)) window.location.assign('/login');
});

track('app_open');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
