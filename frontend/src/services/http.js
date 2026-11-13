import { env } from '@/config/env';
import { ApiError, ERROR_CODES, mapBackendError } from './errors';
import { getAppCheckToken } from './auth/appCheck';

/**
 * Single HTTP entry point for the whole app.
 * - Real mode: fetch against VITE_API_BASE_URL with a fresh Firebase ID token, timeout, one safe retry
 *   for idempotent reads, and the backend envelope { success, message, data } / { success:false, message, errorCode }.
 * - Mock mode (VITE_USE_MOCK_API=true, local demo only): routed to the in-browser mock server, which is
 *   lazy-loaded and dropped from production bundles built with VITE_USE_MOCK_API=false.
 */
let tokenProvider = async () => null;
let unauthorizedHandler = () => {};

export const setTokenProvider = (fn) => { tokenProvider = fn; };
export const setUnauthorizedHandler = (fn) => { unauthorizedHandler = fn; };

// The API is hosted on a platform that can cold-start in ~30–60 s, so timeouts are generous.
const DEFAULT_TIMEOUT = 60000;
const AI_TIMEOUT = 90000;

// Compared as a literal so the bundler can drop the whole mock layer when VITE_USE_MOCK_API is not 'true'.
const MOCK_ENABLED = import.meta.env.VITE_USE_MOCK_API === 'true';
export const isMockMode = () => MOCK_ENABLED && env.useMockApi;

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function viaFetch(method, path, body, token, { timeout, signal, headers: extra, responseType }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  let res;
  const hasBody = body != null && method !== 'GET';
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData; // multipart: the browser sets the boundary
  const appCheck = await getAppCheckToken();
  try {
    res = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(appCheck ? { 'X-Firebase-AppCheck': appCheck } : {}),
        ...(extra || {}),
        ...(hasBody && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: hasBody ? (isForm ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      if (signal?.aborted) throw e;
      throw new ApiError(ERROR_CODES.TIMEOUT, undefined, { status: 0 });
    }
    throw new ApiError(ERROR_CODES.NETWORK, undefined, { status: 0 });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  if (responseType === 'blob' && res.ok) {
    try { return await res.blob(); } catch { throw new ApiError(ERROR_CODES.NETWORK, undefined, { status: 0 }); }
  }
  let json = null;
  try { json = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok || json?.success === false) throw mapBackendError(res.status, json);
  // Some endpoints may reply with an empty body (e.g. 204); normalise to null.
  return json && 'data' in json ? json.data : json;
}

/**
 * @param {object} opts
 *  - scope: 'admin' | undefined
 *  - auth: false → send no token (public endpoints)
 *  - ai: longer timeout
 *  - skipAuthRedirect: don't bounce to the sign-in page on 401
 *  - headers: extra request headers (e.g. Idempotency-Key)
 */
export async function request(method, path, body, opts = {}) {
  if (isMockMode()) {
    const token = opts.token ?? (await tokenProvider(opts.scope));
    try {
      return await viaMock(method, path, body, token);
    } catch (err) {
      if (err instanceof ApiError && err.code === ERROR_CODES.UNAUTHENTICATED && !opts.skipAuthRedirect) unauthorizedHandler(opts.scope);
      throw err;
    }
  }

  const timeout = opts.ai ? AI_TIMEOUT : DEFAULT_TIMEOUT;
  const getToken = (force) => (opts.auth === false ? null : opts.token ?? tokenProvider(opts.scope, force));
  const canRetry = method === 'GET';
  let token = await getToken(false);
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await viaFetch(method, path, body, token, {
        timeout,
        signal: opts.signal,
        headers: opts.headers,
        responseType: opts.responseType,
      });
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      // An expired ID token: refresh once and retry the same request.
      if (err.status === 401 && token && attempt === 0 && opts.auth !== false) {
        token = await getToken(true);
        continue;
      }
      // Transient failures on idempotent reads get one more try.
      if (canRetry && attempt === 0 && (err.code === ERROR_CODES.NETWORK || err.status >= 502)) {
        await sleep(800);
        continue;
      }
      if (err.code === ERROR_CODES.UNAUTHENTICATED && !opts.skipAuthRedirect) unauthorizedHandler(opts.scope);
      // The admin 2FA session (12 h) has lapsed: the admin console asks for a fresh code.
      if (err.code === ERROR_CODES.TWO_FACTOR_REQUIRED && typeof window !== 'undefined') window.dispatchEvent(new Event('gg:two-factor-required'));
      throw err;
    }
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
  postBlob: (path, body, opts = {}) => request('POST', path, body ?? {}, { ...opts, responseType: 'blob' }),
  put: (path, body, opts) => request('PUT', path, body ?? {}, opts),
  patch: (path, body, opts) => request('PATCH', path, body ?? {}, opts),
  del: (path, body, opts) => request('DELETE', path, body ?? undefined, opts),
};
