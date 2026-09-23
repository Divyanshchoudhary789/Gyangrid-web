import { toast } from 'sonner';
import { authApi } from '@/services/api/student';
import { useAuthStore } from '@/store/authStore';
import { clearQueryCache } from '@/hooks/useQuery';
import { track } from '@/lib/analytics';

export function startSession({ token, user }) {
  clearQueryCache();
  useAuthStore.getState().setSession({ token, user });
}

/** Where a signed-in student should land. */
export const homePathFor = (user) => (user?.onboarded ? '/home' : '/onboarding');

export async function signOut(navigate, { silent = false } = {}) {
  try {
    await authApi.logout();
  } catch {
    /* token may already be invalid — sign out locally regardless */
  }
  useAuthStore.getState().clear();
  clearQueryCache();
  track('sign_out');
  if (!silent) toast.success('Signed out. See you tomorrow!');
  navigate('/login', { replace: true });
}
