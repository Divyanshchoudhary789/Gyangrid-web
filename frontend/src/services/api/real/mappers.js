/**
 * Backend → UI shape adapters. Every real response passes through here so pages stay decoupled
 * from backend field names. Mappers are defensive: missing fields become null/[] rather than throwing.
 */
import { leaderboardName, maskContact } from '@/lib/format';

export const idOf = (v) => (v && typeof v === 'object' ? v._id || v.id || null : v || null);
export const unwrap = (data, ...keys) => {
  if (data == null) return data;
  for (const k of keys) if (data[k] !== undefined) return data[k];
  return data;
};
export const list = (data, ...keys) => {
  const v = unwrap(data, ...keys, 'items', 'results', 'docs');
  return Array.isArray(v) ? v : [];
};
export const pageInfo = (data) => {
  const p = data?.pagination || data?.meta || {};
  return { page: p.page ?? 1, limit: p.limit ?? 20, total: p.total ?? 0, totalPages: p.totalPages ?? p.pages ?? 1 };
};
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const gradeOf = (cls) => {
  if (cls == null) return null;
  if (typeof cls === 'number') return cls;
  if (typeof cls === 'object') return num(cls.grade ?? cls.classNumber, null) ?? (Number(String(cls.name || '').replace(/\D/g, '')) || null);
  return null;
};

/** Relationship enum used by the backend (MOTHER, FATHER, GUARDIAN, GRANDPARENT, OTHER). */
export const RELATIONSHIP_TO_API = { Mother: 'MOTHER', Father: 'FATHER', Guardian: 'GUARDIAN', Grandparent: 'GRANDPARENT', Other: 'OTHER' };
const RELATIONSHIP_FROM_API = Object.fromEntries(Object.entries(RELATIONSHIP_TO_API).map(([k, v]) => [v, k]));

export function mapProfile({ me, profile, firebaseUser }) {
  const u = { ...(unwrap(me, 'user') || {}), ...(unwrap(profile, 'profile', 'user') || {}) };
  const cls = u.class || u.classInfo || (typeof u.classId === 'object' ? u.classId : null);
  const board = u.board || u.boardInfo || (typeof u.boardId === 'object' ? u.boardId : null);
  const parent = u.parent || {};
  const consent = u.consent || {};
  const name = u.displayName || u.name || firebaseUser?.displayName || (u.email || firebaseUser?.email || '').split('@')[0] || 'Student';
  // The backend already masks `parent.contact` (e.g. p***@gmail.com); never show an unmasked value.
  const rawContact = parent.contact || u.parentContact || null;
  const parentContactMasked = u.parentContactMasked || parent.contactMasked || u.maskedParentContact
    || (rawContact ? (String(rawContact).includes('*') ? rawContact : maskContact(rawContact)) : null);
  const consentGiven = Boolean(
    u.parentPermissionGranted ?? consent.parentPermissionGranted ?? u.consentGiven ?? consent.granted ?? u.consentedAt ?? consent.consentedAt,
  );
  const onboarded = Boolean(
    u.onboardingCompleted ?? u.isOnboarded ?? u.onboarded ?? (u.onboardingStatus ? String(u.onboardingStatus).toUpperCase() === 'COMPLETED' : undefined)
      ?? (idOf(u.classId) && consentGiven),
  );
  return {
    uid: firebaseUser?.uid || u.firebaseUid || idOf(u),
    id: idOf(u),
    email: u.email || firebaseUser?.email || '',
    name,
    displayName: leaderboardName(name),
    role: String(u.role || 'STUDENT').toUpperCase(),
    status: u.status || 'ACTIVE',
    emailVerified: Boolean(firebaseUser?.emailVerified || u.emailVerified || u.emailOtpVerified),
    providers: (firebaseUser?.providerData || []).map((p) => (p.providerId === 'google.com' ? 'google' : 'password')),
    createdAt: u.createdAt || firebaseUser?.metadata?.creationTime || null,
    onboarded,
    onboardingStep: u.onboardingStep ?? null,
    profile: {
      classId: idOf(u.classId) || idOf(cls),
      grade: gradeOf(cls) ?? gradeOf(u.grade ?? u.classNumber ?? null),
      className: cls?.name || null,
      boardId: idOf(u.boardId) || idOf(board),
      boardName: board?.name || board?.code || null,
      avatarId: u.avatarId ?? null,
      parent: (u.parentName || parent.name || parentContactMasked) ? {
        name: u.parentName || parent.name || null,
        relationship: RELATIONSHIP_FROM_API[u.parentRelationship || parent.relationship] || u.parentRelationship || parent.relationship || null,
        contactMasked: parentContactMasked,
        contactType: u.parentContactType || parent.contactType || null,
      } : null,
      consent: consentGiven ? {
        version: u.consentVersion || consent.version || null,
        timestamp: u.consentedAt || consent.consentedAt || null,
        method: 'STUDENT_SELF_DECLARATION',
        status: 'ACTIVE',
      } : null,
    },
    streak: u.streak || u.streakSummary || null,
    settings: u.settings || { reminders: true, reminderTime: '17:00', parentReport: true, sound: true },
    _raw: undefined,
  };
}
