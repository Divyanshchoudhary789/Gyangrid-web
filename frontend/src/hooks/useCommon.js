import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { APP_NAME } from '@/config/constants';

/* ---------------- online status (NFR-03: every CTA shows a clear offline state) */
const subscribeOnline = (cb) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};
export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

/* ---------------- document title */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : `${APP_NAME} — AI Maths Tutor for Classes 6–10`;
  }, [title]);
}

/* ---------------- interval */
export function useInterval(fn, ms) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (ms == null) return undefined;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/**
 * Countdown against a server deadline. The offset between server and device clocks is applied,
 * so changing the device clock cannot add time (F6-06 acceptance).
 */
export function useServerCountdown(remainingSecAtSync) {
  // Re-sync synchronously when the server value changes, so the first render never reads a stale 0.
  const sync = useRef({ base: remainingSecAtSync, at: performance.now() });
  if (sync.current.base !== remainingSecAtSync) sync.current = { base: remainingSecAtSync, at: performance.now() };
  const [, setTick] = useState(0);
  useInterval(() => setTick((n) => n + 1), 250);
  // performance.now() is monotonic and unaffected by wall-clock changes
  return Math.max(0, Math.round(sync.current.base - (performance.now() - sync.current.at) / 1000));
}

/** Seconds spent on the current item; restarts when `resetKey` changes. */
export function useElapsed(resetKey) {
  const start = useRef(performance.now());
  useEffect(() => { start.current = performance.now(); }, [resetKey]);
  return useCallback(() => Math.round((performance.now() - start.current) / 1000), []);
}

/* ---------------- async action with loading/error state */
export function useAction(fn) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const run = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      return await fn(...args);
    } catch (e) {
      if (mounted.current) setError(e);
      throw e;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [fn]);
  return [run, { loading, error, setError }];
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function useMediaQuery(query) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Warn before leaving a page with unsaved work. */
export function useBeforeUnload(active, message = 'Your progress is saved, but are you sure you want to leave?') {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active, message]);
}
