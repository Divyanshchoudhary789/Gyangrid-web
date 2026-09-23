/**
 * Centralised access to build-time environment variables.
 * Never put secrets here: everything prefixed VITE_ ships in the client bundle (SEC-01).
 */
const bool = (v, fallback) => (v === undefined ? fallback : String(v).toLowerCase() === 'true');

export const env = Object.freeze({
  useMockApi: bool(import.meta.env.VITE_USE_MOCK_API, true),
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  mockLatencyMs: Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 350),
  isDev: import.meta.env.DEV,
});
