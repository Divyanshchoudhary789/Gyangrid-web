import { ApiError, ERROR_CODES } from '../errors';

/**
 * Integration point for real Google sign-in (F1-01).
 *
 * Wire this to Firebase Auth when the backend is connected, e.g.:
 *   const cred = await signInWithPopup(auth, new GoogleAuthProvider());
 *   const idToken = await cred.user.getIdToken();
 *   return authApi.google({ idToken });   // backend verifies the token and returns { token, user }
 *
 * The client must never trust the Google profile on its own — the backend verifies the ID token.
 */
export async function signInWithGoogleProvider() {
  throw new ApiError(ERROR_CODES.SERVER, 'Google sign-in is not configured yet. Please use email and password.');
}
