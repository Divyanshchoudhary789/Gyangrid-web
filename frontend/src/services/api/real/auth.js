import { http } from '../../http';
import { ApiError, ERROR_CODES } from '../../errors';
import {
  firebaseSignUp, firebaseSignIn, firebaseGoogleSignIn, firebaseResetPassword, firebaseSignOut,
  firebaseReloadUser, firebaseResendVerification, currentFirebaseUser, authReady, getIdToken,
} from '../../auth/firebase';
import { mapProfile } from './mappers';
import { getBoardsWithClasses } from './curriculum';

/** GET /auth/me syncs the Firebase identity into the backend user record; GET /profile returns the app profile. */
export async function loadAppUser() {
  const fb = (await authReady()) || currentFirebaseUser();
  if (!fb) throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Please sign in again.', { status: 401 });
  const me = await http.get('/auth/me', null, { skipAuthRedirect: true });
  const soft = (path) => http.get(path, null, { skipAuthRedirect: true }).catch((e) => {
    if (e.code === ERROR_CODES.UNAUTHENTICATED) throw e;
    return null;
  });
  const [profile, settings] = await Promise.all([soft('/profile'), soft('/profile/settings')]);
  const user = mapProfile({ me, profile, firebaseUser: fb });
  const st = settings?.settings || settings;
  if (st && typeof st === 'object') {
    user.settings = {
      reminders: st.reminders ?? true,
      reminderTime: st.reminderTime || '17:00',
      sound: st.sound ?? true,
      parentReport: st.parentReport ?? true,
    };
  }
  return withClassInfo(user);
}

/** The profile only carries ids; fill in grade / class / board names from the public curriculum. */
async function withClassInfo(user) {
  const p = user.profile;
  if (!p?.classId || (p.grade && p.boardName)) return user;
  try {
    const boards = await getBoardsWithClasses();
    for (const b of boards) {
      const c = b.classes.find((x) => x._id === p.classId);
      if (c) {
        return { ...user, profile: { ...p, grade: p.grade ?? c.grade ?? null, className: p.className || c.name || null, boardId: p.boardId || b._id, boardName: p.boardName || b.name || b.code || null } };
      }
    }
  } catch { /* names are cosmetic; keep the ids */ }
  return user;
}

/**
 * Firebase sign-in succeeded; now the backend must accept the ID token. If it doesn't, sign out of
 * Firebase too so the student is never left half-signed-in, and explain that the account is safe.
 */
const session = async ({ justCreated = false } = {}) => {
  try {
    const user = await loadAppUser();
    if (user.role === 'ADMIN') {
      throw new ApiError(ERROR_CODES.FORBIDDEN, 'This is a staff account. Please sign in from the admin console (/admin/login).', { status: 403 });
    }
    return { token: user.uid, user };
  } catch (e) {
    await firebaseSignOut();
    if (e.code === ERROR_CODES.UNAUTHENTICATED) {
      throw new ApiError(
        ERROR_CODES.SERVER,
        justCreated
          ? 'Your account was created, but our server could not verify your sign-in right now. Please try signing in again in a little while.'
          : 'Our server could not verify your sign-in right now. Please try again in a little while.',
        { status: 503, details: { backendCode: e.details?.backendCode } },
      );
    }
    throw e;
  }
};

export const authApi = {
  async register({ name, email, password }) {
    await firebaseSignUp({ name, email, password });
    return session({ justCreated: true });
  },
  async login({ email, password }) {
    await firebaseSignIn({ email, password });
    return session();
  },
  async google() {
    await firebaseGoogleSignIn();
    return session();
  },
  forgotPassword: (email) => firebaseResetPassword(email).then(() => ({ sent: true, expiresInMin: 60 })),
  logout: () => firebaseSignOut(),
  /** "I've verified" — reload the Firebase user; resend the link if still unverified. */
  async verifyEmail() {
    const fb = await firebaseReloadUser();
    if (!fb?.emailVerified) {
      await firebaseResendVerification();
      throw new ApiError(ERROR_CODES.VALIDATION, "Your email isn't verified yet. We've sent you a fresh link — please check your inbox.");
    }
    return loadAppUser();
  },
  /** Email OTP proves ownership of the account's email; sign-in stays with Firebase. */
  async requestEmailOtp() {
    const email = currentFirebaseUser()?.email;
    if (!email) throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Please sign in again.', { status: 401 });
    await http.post('/auth/email-otp/request', { email }, { skipAuthRedirect: true });
    return { sent: true, email };
  },
  async verifyEmailOtp(otp) {
    const email = currentFirebaseUser()?.email;
    if (!email) throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Please sign in again.', { status: 401 });
    await http.post('/auth/email-otp/verify', { email, otp }, { skipAuthRedirect: true });
    await firebaseReloadUser().catch(() => null);
    await getIdToken(true).catch(() => null);
    return { ...(await loadAppUser()), emailVerified: true };
  },
  me: () => loadAppUser(),
};
