import { ApiError, ERROR_CODES } from '../errors';
import { getDb, persist } from './db';
import { ensureSeeded } from './seed';
import { studentRoutes } from './handlers/student';
import { learningRoutes } from './handlers/learning';
import { assessmentRoutes } from './handlers/assessment';
import { doubtRoutes } from './handlers/doubts';
import { adminRoutes } from './handlers/admin';

/**
 * Minimal router emulating the backend API (section 20). Each route declares its guard:
 *   auth: 'none' | 'student' | 'admin', consent: true → 403 CONSENT_REQUIRED without a consent record (F1-07),
 *   roles: [...] → admin custom-claim check (3.1).
 */
const routes = [...studentRoutes, ...learningRoutes, ...assessmentRoutes, ...doubtRoutes, ...adminRoutes].map((r) => {
  const keys = [];
  const pattern = new RegExp(`^${r.path.replace(/:[a-zA-Z]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; })}$`);
  return { ...r, keys, pattern };
});

function authenticate(route, token) {
  const d = getDb();
  if (route.auth === 'none') return {};
  if (route.auth === 'admin') {
    const session = token && d.admin.adminSessions[token];
    if (!session) throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Your admin session has expired. Please sign in again.', { status: 401 });
    if (route.roles && !route.roles.includes(session.role)) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, 'Your role does not have access to this section.', { status: 403 });
    }
    return { admin: session };
  }
  const uid = token && d.sessions[token];
  const user = uid && d.users[uid];
  if (!user || user.deletedAt) throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Please sign in again.', { status: 401 });
  if (user.suspended) throw new ApiError(ERROR_CODES.ACCOUNT_SUSPENDED, 'This account is suspended. Please contact support.', { status: 403 });
  if (route.consent && !user.profile?.consent) {
    throw new ApiError(ERROR_CODES.CONSENT_REQUIRED, 'Parental consent is required before using GyanGrid.', { status: 403 });
  }
  return { uid, user };
}

export const mockServer = {
  handle({ method, path, body, token }) {
    try {
      ensureSeeded();
      const [pathname, query = ''] = path.split('?');
      const route = routes.find((r) => r.method === method && r.pattern.test(pathname));
      if (!route) throw new ApiError(ERROR_CODES.NOT_FOUND, `No mock route for ${method} ${pathname}`, { status: 404 });
      const match = route.pattern.exec(pathname);
      const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
      const ctx = authenticate(route, token);
      const data = route.handler({
        ...ctx, params, body: structuredClone(body ?? {}), query: Object.fromEntries(new URLSearchParams(query)), token,
      });
      persist();
      // structuredClone mimics JSON transport: the client never holds references to server state
      return { ok: true, data: data === undefined ? null : structuredClone(data), status: 200 };
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, status: err.status, error: { code: err.code, message: err.message, details: err.details } };
      }
      console.error('[mock server]', err);
      return { ok: false, status: 500, error: { code: ERROR_CODES.SERVER, message: 'Something went wrong. Please try again.' } };
    }
  },
};
