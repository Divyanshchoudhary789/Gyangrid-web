import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { env } from '@/config/env';
import { ApiError, ERROR_CODES } from '../errors';

/**
 * Firebase Authentication (F1-01..F1-03).
 * Firebase owns the session (persisted in IndexedDB, refreshed automatically). The backend only
 * ever receives a short-lived Firebase ID token in the Authorization header.
 */
let auth = null;
let ready = null;

export const firebaseConfigured = () => Boolean(env.firebase.apiKey && env.firebase.authDomain && env.firebase.projectId && env.firebase.appId);

export function getFirebaseAuth() {
  if (auth) return auth;
  if (!firebaseConfigured()) throw new ApiError(ERROR_CODES.SERVER, 'Sign-in is not configured. Please contact support.');
  const app = getApps()[0] || initializeApp(env.firebase);
  auth = getAuth(app);
  auth.useDeviceLanguage();
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  return auth;
}

/** Resolves once Firebase has restored (or not) the previous session. */
export function authReady() {
  if (!ready) {
    ready = new Promise((resolve) => {
      const unsub = onAuthStateChanged(getFirebaseAuth(), (u) => { unsub(); resolve(u); });
    });
  }
  return ready;
}

export const onFirebaseUserChanged = (cb) => onAuthStateChanged(getFirebaseAuth(), cb);
export const currentFirebaseUser = () => (auth ? auth.currentUser : null);

/** Fresh ID token for API calls (Firebase refreshes it when it is close to expiry). */
export async function getIdToken(forceRefresh = false) {
  await authReady();
  const u = getFirebaseAuth().currentUser;
  return u ? u.getIdToken(forceRefresh) : null;
}

const FIREBASE_MESSAGES = {
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password is too weak. Use at least 8 characters with a letter and a number.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes or reset your password.',
  'auth/network-request-failed': "You're offline or the connection dropped. Please try again.",
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Please allow pop-ups and try again.',
  'auth/account-exists-with-different-credential': 'This email is already registered with a different sign-in method.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled yet. Please contact support.',
  'auth/unauthorized-domain': 'This website is not authorised for sign-in yet. Please contact support.',
};

function wrap(e) {
  if (e instanceof ApiError) return e;
  const code = e?.code || '';
  const msg = FIREBASE_MESSAGES[code] || 'Something went wrong while signing in. Please try again.';
  const map = {
    'auth/email-already-in-use': ERROR_CODES.CONFLICT,
    'auth/too-many-requests': ERROR_CODES.RATE_LIMITED,
    'auth/network-request-failed': ERROR_CODES.NETWORK,
  };
  return new ApiError(map[code] || ERROR_CODES.UNAUTHENTICATED, msg, { status: 401, details: { firebaseCode: code } });
}

export async function firebaseSignUp({ name, email, password }) {
  try {
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    // Email verification is required before the first reward (F1-01); failure here must not block sign-up.
    sendEmailVerification(cred.user).catch(() => {});
    await cred.user.getIdToken(true);
    return cred.user;
  } catch (e) { throw wrap(e); }
}

export async function firebaseSignIn({ email, password }) {
  try {
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    return cred.user;
  } catch (e) { throw wrap(e); }
}

export async function firebaseGoogleSignIn() {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(getFirebaseAuth(), provider);
    return cred.user;
  } catch (e) { throw wrap(e); }
}

export async function firebaseResetPassword(email) {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  } catch (e) {
    // Never reveal whether an account exists for this email.
    if (e?.code === 'auth/user-not-found') return;
    throw wrap(e);
  }
}

export async function firebaseResendVerification() {
  const u = getFirebaseAuth().currentUser;
  if (!u) throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Please sign in again.');
  try { await sendEmailVerification(u); } catch (e) { throw wrap(e); }
}

/** Reloads the Firebase user so a freshly clicked verification link is picked up. */
export async function firebaseReloadUser() {
  const u = getFirebaseAuth().currentUser;
  if (!u) return null;
  await u.reload();
  await u.getIdToken(true);
  return getFirebaseAuth().currentUser;
}

export async function firebaseSignOut() {
  try { await signOut(getFirebaseAuth()); } catch { /* already signed out */ }
}
