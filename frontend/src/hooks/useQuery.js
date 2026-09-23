import { useCallback, useEffect, useRef, useState } from 'react';
import { storage } from '@/lib/storage';

/**
 * Tiny stale-while-revalidate query cache.
 * - Renders instantly from memory (or from localStorage when `persist` is set: F2-07 / NFR-03 offline Home),
 *   then reconciles with the server.
 * - `invalidate(prefix)` refetches every mounted query whose key starts with the prefix.
 */
const cache = new Map();
const listeners = new Set();
const inflight = new Map();

export function invalidate(prefix = '') {
  [...cache.keys()].forEach((k) => { if (k.startsWith(prefix)) cache.get(k).stale = true; });
  listeners.forEach((fn) => fn(prefix));
}

export function setQueryData(key, updater) {
  const prev = cache.get(key)?.data;
  const data = typeof updater === 'function' ? updater(prev) : updater;
  cache.set(key, { data, at: Date.now(), stale: false });
  listeners.forEach((fn) => fn(key, true));
}

export function clearQueryCache() {
  cache.clear();
}

export function useQuery(key, fetcher, { enabled = true, persist = false, staleMs = 30000 } = {}) {
  const initial = () => {
    const mem = cache.get(key);
    if (mem) return mem.data;
    if (persist) {
      const saved = storage.get(`q:${key}`);
      if (saved) return saved.data;
    }
    return undefined;
  };
  const [data, setData] = useState(initial);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(() => data === undefined && enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(() => data !== undefined);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const reqId = useRef(0);

  const run = useCallback(async () => {
    const id = ++reqId.current;
    setError(null);
    if (cache.get(key)?.data === undefined) setLoading(true); else setRefreshing(true);
    try {
      // de-duplicate concurrent requests for the same key (e.g. header + page both reading /home)
      let promise = inflight.get(key);
      if (!promise) {
        promise = fetcherRef.current().finally(() => inflight.delete(key));
        inflight.set(key, promise);
      }
      const result = await promise;
      if (id !== reqId.current) return result;
      cache.set(key, { data: result, at: Date.now(), stale: false });
      if (persist) storage.set(`q:${key}`, { data: result, at: Date.now() });
      setData(result);
      setFromCache(false);
      return result;
    } catch (e) {
      if (id === reqId.current) setError(e);
      return undefined;
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [key, persist]);

  useEffect(() => {
    if (!enabled) return;
    const mem = cache.get(key);
    if (mem) {
      setData(mem.data);
      setLoading(false);
    } else {
      const saved = persist ? storage.get(`q:${key}`) : null;
      setData(saved?.data);
      setLoading(!saved);
    }
    if (!mem || mem.stale || Date.now() - mem.at > staleMs) run();
  }, [key, enabled, run, staleMs, persist]);

  useEffect(() => {
    const onChange = (changedKey, dataOnly) => {
      if (dataOnly) {
        if (changedKey === key) setData(cache.get(key)?.data);
        return;
      }
      if (enabled && key.startsWith(changedKey)) run();
    };
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  }, [key, enabled, run]);

  const mutate = useCallback((updater) => setQueryData(key, updater), [key]);

  return { data, error, loading, refreshing, fromCache, refetch: run, mutate };
}
