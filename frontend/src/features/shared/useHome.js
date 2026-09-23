import { useQuery, invalidate } from '@/hooks/useQuery';
import { homeApi } from '@/services/api/student';

/** Home payload: one aggregated call, cached to storage so Home renders instantly and offline (F2-07). */
export const useHome = (opts = {}) => useQuery('home', homeApi.get, { persist: true, staleMs: 15000, ...opts });

/** After any submission the server-computed summary changes; refetch it (never recompute on the client). */
export const refreshSummary = () => {
  invalidate('home');
  invalidate('progress');
  invalidate('rewards');
  invalidate('leaderboard');
  invalidate('mistakes');
  invalidate('curriculum');
  invalidate('tests');
};
