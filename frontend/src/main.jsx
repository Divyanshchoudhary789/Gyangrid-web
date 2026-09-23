import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { setTokenProvider, setUnauthorizedHandler } from '@/services/http';
import { useAuthStore, useAdminStore } from '@/store/authStore';
import { clearQueryCache } from '@/hooks/useQuery';
import { track } from '@/lib/analytics';

setTokenProvider((scope) => (scope === 'admin' ? useAdminStore.getState().token : useAuthStore.getState().token));

// Expired / revoked session: clear local state and send the user to the right sign-in page.
setUnauthorizedHandler((scope) => {
  if (scope === 'admin') {
    useAdminStore.getState().clear();
    if (!window.location.pathname.startsWith('/admin/login')) window.location.assign('/admin/login');
    return;
  }
  useAuthStore.getState().clear();
  clearQueryCache();
  if (!['/login', '/signup', '/'].includes(window.location.pathname)) window.location.assign('/login');
});

track('app_open');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
