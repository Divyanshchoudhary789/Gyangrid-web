import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@/lib/storage';

/**
 * Student session. With Firebase Auth the SDK persists the session itself (F1-03); here we persist
 * the opaque token so a reload returns the student to Home without re-entering credentials.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: ({ token, user }) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => {
        set({ token: null, user: null });
        storage.clearUserCache(); // F1-11: sign-out clears locally cached personal data
      },
    }),
    { name: 'gg:auth', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ token: s.token, user: s.user }) },
  ),
);

export const useAdminStore = create(
  persist(
    (set) => ({
      token: null,
      admin: null,
      setSession: ({ token, admin }) => set({ token, admin }),
      clear: () => set({ token: null, admin: null }),
    }),
    // Admin sessions are tab-scoped: closing the tab ends the session.
    { name: 'gg:admin', storage: createJSONStorage(() => sessionStorage) },
  ),
);
