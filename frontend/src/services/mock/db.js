import { storage } from '@/lib/storage';
import { DEFAULT_CONFIG } from './defaultConfig';

/**
 * In-browser stand-in for the backend database (Firestore collections in section 19).
 * It lives in localStorage so the demo behaves like a real server across reloads.
 * Delete this folder once the real API is wired (VITE_USE_MOCK_API=false).
 */
const KEY = 'mockdb:v4'; // v4: demo accounts moved to the gyaangrid.in domain
let db = null;
let saveTimer = null;

function empty() {
  return {
    schemaVersion: 3,
    users: {},        // users/{uid}
    emailIndex: {},   // email -> uid
    sessions: {},     // token -> uid
    state: {},        // per-student server-owned data (attempts, mistakes, ledgers …)
    admin: {
      config: structuredClone(DEFAULT_CONFIG),
      configHistory: [],
      curriculumOverrides: {}, // chapterId/topicId -> { name, status, order }
      customChapters: {},      // classId -> [chapter]
      materials: {},           // topicId -> material
      materialHistory: {},     // topicId -> [versions]
      questionOverrides: {},   // questionId -> partial question
      customQuestions: [],
      customTests: [],
      testOverrides: {},
      customSeries: [],
      seriesOverrides: {},
      kbDocs: [],
      moderation: [],
      audit: [],
      adminSessions: {},
      pendingOtp: {},
    },
  };
}

export function getDb() {
  if (db) return db;
  db = storage.get(KEY);
  if (!db || db.schemaVersion !== 3) {
    db = empty();
    db.seeded = false;
  }
  return db;
}

export function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => storage.set(KEY, db), 60);
}

export function resetDb() {
  db = empty();
  storage.set(KEY, db);
  return db;
}

export function userState(uid) {
  const d = getDb();
  if (!d.state[uid]) {
    d.state[uid] = {
      attempts: [],
      mistakes: {},
      challenges: {},
      practiceSets: {},
      testAttempts: {},
      doubts: [],
      coinLedger: [],
      xpLedger: [],
      studied: {},
      topicViews: [],
      activity: [],
      streak: { current: 0, longest: 0, lastDate: null },
      doubtUsage: {},
      xpDaily: {},
      recommendation: null,
      reports: [],
    };
  }
  return d.state[uid];
}
