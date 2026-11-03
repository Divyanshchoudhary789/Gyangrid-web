/**
 * Centralised access to build-time environment variables.
 * Everything prefixed VITE_ is compiled into the browser bundle, so only public client configuration
 * belongs here (the Firebase Web config is public by design; access is protected by Firebase Auth,
 * the backend's token verification and Firebase security rules). Real secrets live on the backend.
 */
const bool = (v, fallback) => (v === undefined ? fallback : String(v).toLowerCase() === 'true');
const e = import.meta.env;

export const env = Object.freeze({
  useMockApi: bool(e.VITE_USE_MOCK_API, false),
  apiBaseUrl: (e.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, ''),
  mockLatencyMs: Number(e.VITE_MOCK_LATENCY_MS ?? 350),
  isDev: e.DEV,
  firebase: Object.freeze({
    apiKey: e.VITE_FIREBASE_API_KEY,
    authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: e.VITE_FIREBASE_PROJECT_ID,
    storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: e.VITE_FIREBASE_APP_ID,
    measurementId: e.VITE_FIREBASE_MEASUREMENT_ID,
  }),
});
