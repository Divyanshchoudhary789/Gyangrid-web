/** Safe localStorage wrappers: storage can throw in private mode or when blocked. */
const PREFIX = 'gg:';

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* quota exceeded or blocked: non-fatal */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
  /** Clears cached personal data on sign-out (F1-11). Leaves the mock "server" DB intact. */
  clearUserCache() {
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith(PREFIX) && !k.startsWith(`${PREFIX}mockdb`))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  },
};
