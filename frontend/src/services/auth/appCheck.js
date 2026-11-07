import { getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from 'firebase/app-check';
import { env } from '@/config/env';

/**
 * Firebase App Check. The backend requires `X-Firebase-AppCheck` on every /api/v1 call when the
 * deployment enables it. Configured only when a reCAPTCHA v3 site key is provided; otherwise the
 * header is simply omitted (the backend treats it as optional unless enforcement is on).
 */
let appCheck = null;
let initialised = false;

function init() {
  if (initialised) return appCheck;
  initialised = true;
  const siteKey = env.firebase.appCheckSiteKey;
  if (!siteKey || !env.firebase.apiKey || typeof window === 'undefined') return null;
  // Local development only: lets a registered debug token pass App Check without reCAPTCHA.
  if (import.meta.env.DEV && env.firebase.appCheckDebugToken) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = env.firebase.appCheckDebugToken;
  }
  try {
    const app = getApps()[0] || initializeApp(env.firebase);
    appCheck = initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
  } catch {
    appCheck = null;
  }
  return appCheck;
}

/** A current App Check token, or null when App Check isn't configured or a token can't be obtained. */
export async function getAppCheckToken() {
  const ac = init();
  if (!ac) return null;
  try {
    return (await getToken(ac, false)).token;
  } catch {
    return null;
  }
}

export const appCheckConfigured = () => Boolean(env.firebase.appCheckSiteKey);
