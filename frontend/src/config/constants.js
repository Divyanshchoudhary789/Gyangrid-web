export const APP_NAME = 'Gyaangrid';
export const SUPPORT_EMAIL = 'support@gyaangrid.in';
export const CONSENT_TEXT_VERSION = 'consent-v1.0-2026-09';

export const CLASSES = [6, 7, 8, 9, 10];
export const BOARDS = [
  { id: 'NCERT_CBSE', name: 'NCERT / CBSE', active: true, note: 'Available now' },
  { id: 'ICSE', name: 'ICSE', active: false, note: 'Coming soon' },
  { id: 'STATE', name: 'State Board', active: false, note: 'Coming soon' },
];

export const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Other'];

/** The avatar ids the backend accepts (PUT /profile/onboarding, PATCH /profile). */
export const BUDDY_AVATARS = [
  { id: 'buddy-blue', emoji: '🐳', bg: 'from-sky-300 to-blue-500' },
  { id: 'buddy-green', emoji: '🐢', bg: 'from-emerald-300 to-green-500' },
  { id: 'buddy-orange', emoji: '🦊', bg: 'from-orange-300 to-amber-500' },
  { id: 'buddy-purple', emoji: '🦄', bg: 'from-fuchsia-300 to-purple-500' },
  { id: 'buddy-yellow', emoji: '🐥', bg: 'from-yellow-200 to-amber-400' },
];

const LEGACY_AVATARS = [
  { id: 'fox', emoji: '🦊', bg: 'from-orange-300 to-amber-400' },
  { id: 'owl', emoji: '🦉', bg: 'from-violet-300 to-indigo-400' },
  { id: 'panda', emoji: '🐼', bg: 'from-slate-200 to-slate-400' },
  { id: 'tiger', emoji: '🐯', bg: 'from-amber-300 to-orange-500' },
  { id: 'robot', emoji: '🤖', bg: 'from-sky-300 to-cyan-500' },
  { id: 'rocket', emoji: '🚀', bg: 'from-fuchsia-300 to-purple-500' },
  { id: 'unicorn', emoji: '🦄', bg: 'from-pink-300 to-rose-400' },
  { id: 'dino', emoji: '🦖', bg: 'from-emerald-300 to-green-500' },
  { id: 'astronaut', emoji: '🧑‍🚀', bg: 'from-blue-300 to-indigo-500' },
  { id: 'star', emoji: '🌟', bg: 'from-yellow-200 to-amber-400' },
  { id: 'koala', emoji: '🐨', bg: 'from-zinc-200 to-zinc-400' },
  { id: 'octopus', emoji: '🐙', bg: 'from-rose-300 to-red-400' },
];

/** Avatars offered in the pickers: the backend's set in real mode, the demo set in mock mode. */
export const AVATARS = import.meta.env.VITE_USE_MOCK_API === 'true' ? LEGACY_AVATARS : BUDDY_AVATARS;
/** Every known avatar, so any stored id still renders (e.g. data created in mock mode). */
export const ALL_AVATARS = [...BUDDY_AVATARS, ...LEGACY_AVATARS];
export const DEFAULT_AVATAR_ID = AVATARS[0].id;

export const MASTERY_BANDS = [
  { min: 75, label: 'Strong', key: 'STRONG', tone: 'success' },
  { min: 50, label: 'Partial', key: 'PARTIAL', tone: 'warning' },
  { min: 0, label: 'Needs Work', key: 'NEEDS_WORK', tone: 'danger' },
];

export const MISTAKE_SOURCES = ['CHALLENGE', 'PRACTICE', 'TEST', 'DOUBT'];

export const SOURCE_LABELS = {
  CHALLENGE: 'Daily Challenge',
  PRACTICE: 'Practice',
  TEST: 'Test',
  DOUBT: 'Doubt',
};

export const ADMIN_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  CONTENT_MANAGER: 'CONTENT_MANAGER',
  SUPPORT: 'SUPPORT',
};

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  CONTENT_MANAGER: 'Content Manager',
  SUPPORT: 'Support / Moderator',
};

export const AI_REFUSAL_MESSAGE =
  'I can currently help you with Mathematics topics from your Gyaangrid syllabus. Please ask me a Mathematics question related to your course.';

export const DOUBT_LIMITS = { maxTextChars: 1000, maxImageMb: 5, maxVoiceSec: 60, imageLongEdgePx: 1600 };
