import { env } from '@/config/env';
import { ApiError, ERROR_CODES } from './errors';

/**
 * Single HTTP entry point for the whole app.
 * - Real mode: fetch against VITE_API_BASE_URL with the bearer token, timeout and the common envelope.
 * - Mock mode: the same call is routed to the in-browser mock server (lazy-loaded, so it never
 *   ships in a production bundle built with VITE_USE_MOCK_API=false).
 */
let tokenProvider = () => null;
let unauthorizedHandler = () => {};

export const setTokenProvider = (fn) => { tokenProvider = fn; };
export const setUnauthorizedHandler = (fn) => { unauthorizedHandler = fn; };

const DEFAULT_TIMEOUT = 20000;
const AI_TIMEOUT = 30000; // NFR-02 hard timeout

// Compared as a literal so the bundler can drop the whole mock layer when VITE_USE_MOCK_API=false.
const MOCK_ENABLED = import.meta.env.VITE_USE_MOCK_API !== 'false';
let mockServerPromise = null;
const loadMock = () => {
  if (!MOCK_ENABLED) return Promise.reject(new ApiError(ERROR_CODES.SERVER, 'Mock API is disabled.'));
  if (!mockServerPromise) mockServerPromise = import('./mock/server').then((m) => m.mockServer);
  return mockServerPromise;
};

async function viaMock(method, path, body, token) {
  const server = await loadMock();
  const jitter = Math.random() * env.mockLatencyMs * 0.6;
  await new Promise((r) => setTimeout(r, env.mockLatencyMs * 0.7 + jitter));
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError(ERROR_CODES.NETWORK, undefined, { status: 0 });
  }
  const res = server.handle({ method, path, body, token });
  if (!res.ok) throw new ApiError(res.error.code, res.error.message, { status: res.status, details: res.error.details });
  return res.data;
}

async function viaFetch(method, path, body, token, { timeout, signal }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  signal?.addEventListener('abort', () => controller.abort());
  let res;
  try {
    res = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body != null && method !== 'GET' ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      credentials: 'include',
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError(ERROR_CODES.TIMEOUT, undefined, { status: 0 });
    throw new ApiError(ERROR_CODES.NETWORK, undefined, { status: 0 });
  } finally {
    clearTimeout(timer);
  }
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok || !json?.ok) {
    const code = json?.error?.code || (res.status === 401 ? ERROR_CODES.UNAUTHENTICATED : ERROR_CODES.SERVER);
    throw new ApiError(code, json?.error?.message, { status: res.status, details: json?.error?.details });
  }
  return json.data;
}

export async function request(method, path, body, opts = {}) {
  const token = opts.token ?? tokenProvider(opts.scope);
  try {
    if (MOCK_ENABLED && env.useMockApi) return await viaMock(method, path, body, token);
    return await viaFetch(method, path, body, token, { timeout: opts.ai ? AI_TIMEOUT : DEFAULT_TIMEOUT, signal: opts.signal });
  } catch (err) {
    if (err instanceof ApiError && err.code === ERROR_CODES.UNAUTHENTICATED && !opts.skipAuthRedirect) unauthorizedHandler(opts.scope);
    throw err;
  }
}

const qs = (params) => {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'ALL');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};

export const http = {
  get: (path, params, opts) => request('GET', `${path}${qs(params)}`, null, opts),
  post: (path, body, opts) => request('POST', path, body ?? {}, opts),
  put: (path, body, opts) => request('PUT', path, body ?? {}, opts),
  patch: (path, body, opts) => request('PATCH', path, body ?? {}, opts),
  del: (path, body, opts) => request('DELETE', path, body ?? {}, opts),
};
