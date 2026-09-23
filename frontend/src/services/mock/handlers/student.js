import { ApiError, ERROR_CODES } from '../../errors';
import { getDb, userState } from '../db';
import { hashString, uid as makeId } from '@/lib/random';
import { isEmail, passwordIssues, isValidName, isIndianMobile } from '@/lib/validators';
import { leaderboardName, maskContact, firstName } from '@/lib/format';
import { addDays, weekStartKey, istDateKey, formatDate } from '@/lib/date';
import { CONSENT_TEXT_VERSION } from '@/config/constants';
import {
  cfg, today, summary, leaderboard, topicStats, strongWeak, totalXp, coinBalance, effectiveStreak,
  curriculumFor, topicMeta, dueMistakes,
} from '../engine';
import { parentSuggestion } from '../ai';

export const pwHash = (email, pw) => `mock$${hashString(`${email.toLowerCase()}::${pw}`)}`;

export function publicUser(u) {
  return {
    uid: u.uid,
    email: u.email,
    name: u.name,
    displayName: u.displayName,
    emailVerified: u.emailVerified,
    providers: u.providers,
    createdAt: u.createdAt,
    onboarded: Boolean(u.profile?.consent && u.profile?.onboardedAt),
    referralCode: u.referralCode,
    profile: u.profile ? {
      classId: u.profile.classId ?? null,
      boardId: u.profile.boardId ?? null,
      avatarId: u.profile.avatarId ?? null,
      parent: u.profile.parent ? { name: u.profile.parent.name, relationship: u.profile.parent.relationship, contactMasked: u.profile.parent.contactMasked, contactType: u.profile.parent.contactType } : null,
      consent: u.profile.consent ? { version: u.profile.consent.version, timestamp: u.profile.consent.timestamp, method: u.profile.consent.method, status: 'ACTIVE' } : null,
    } : null,
    settings: u.settings,
  };
}

function createSession(uid) {
  const token = `mock.${makeId()}.${makeId()}`;
  getDb().sessions[token] = uid;
  return token;
}

export function createUser({ email, name, providers, passwordHash = null, emailVerified = false }) {
  const d = getDb();
  const uid = `u_${makeId()}`;
  d.users[uid] = {
    uid,
    email: email.toLowerCase(),
    name: name.trim(),
    displayName: leaderboardName(name),
    providers,
    passwordHash,
    emailVerified,
    createdAt: new Date().toISOString(),
    profile: {},
    settings: { reminders: true, reminderTime: cfg().challenge.reminderTime, parentReport: true, sound: true },
    suspended: false,
    deletedAt: null,
    failedLogins: [],
    referralCode: `GG${hashString(uid).toString(36).slice(0, 6).toUpperCase()}`,
  };
  d.emailIndex[email.toLowerCase()] = uid;
  userState(uid);
  return d.users[uid];
}

function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] == null || body[f] === '');
  if (missing.length) throw new ApiError(ERROR_CODES.VALIDATION, `Missing: ${missing.join(', ')}`);
}

/* ------------------------------------------------------------------ auth */

function register({ body }) {
  requireFields(body, ['name', 'email', 'password']);
  if (!isValidName(body.name)) throw new ApiError(ERROR_CODES.VALIDATION, 'Please enter your real first name (letters only).');
  if (!isEmail(body.email)) throw new ApiError(ERROR_CODES.VALIDATION, 'Please enter a valid email address.');
  const issues = passwordIssues(body.password);
  if (issues.length) throw new ApiError(ERROR_CODES.VALIDATION, `Password needs: ${issues.join(', ').toLowerCase()}.`);
  const d = getDb();
  const existing = d.emailIndex[body.email.toLowerCase()];
  if (existing && !d.users[existing].deletedAt) throw new ApiError(ERROR_CODES.CONFLICT, 'An account with this email already exists. Try signing in instead.', { status: 409 });
  const u = createUser({ email: body.email, name: body.name, providers: ['password'], passwordHash: pwHash(body.email, body.password) });
  return { token: createSession(u.uid), user: publicUser(u) };
}

function login({ body }) {
  requireFields(body, ['email', 'password']);
  const d = getDb();
  const uid = d.emailIndex[body.email.toLowerCase()];
  const u = uid && d.users[uid];
  const windowStart = Date.now() - 15 * 60 * 1000;
  if (u) {
    u.failedLogins = (u.failedLogins || []).filter((t) => t > windowStart);
    if (u.failedLogins.length >= 5) {
      throw new ApiError(ERROR_CODES.RATE_LIMITED, 'Too many attempts. Please wait 15 minutes or reset your password.', { status: 429 });
    }
  }
  if (!u || u.deletedAt || !u.passwordHash || u.passwordHash !== pwHash(body.email, body.password)) {
    if (u) u.failedLogins.push(Date.now());
    const left = u ? 5 - u.failedLogins.length : null;
    throw new ApiError(ERROR_CODES.UNAUTHENTICATED, `Incorrect email or password.${left != null && left <= 2 ? ` ${left} attempt${left === 1 ? '' : 's'} left.` : ''}`, { status: 401 });
  }
  u.failedLogins = [];
  return { token: createSession(u.uid), user: publicUser(u) };
}

/** Google identity linking to the same address merges into one UID (F1-09). */
function google({ body }) {
  requireFields(body, ['email', 'name']);
  const d = getDb();
  const uid = d.emailIndex[body.email.toLowerCase()];
  let u = uid && d.users[uid];
  if (u && u.deletedAt) u = null;
  if (u) {
    if (!u.providers.includes('google')) u.providers.push('google');
    u.emailVerified = true;
  } else {
    u = createUser({ email: body.email, name: body.name, providers: ['google'], emailVerified: true });
  }
  return { token: createSession(u.uid), user: publicUser(u) };
}

const forgot = ({ body }) => {
  if (!isEmail(body.email || '')) throw new ApiError(ERROR_CODES.VALIDATION, 'Please enter a valid email address.');
  // Always succeed: never reveal whether an account exists. Link is single-use, 30 min (F1-02).
  return { sent: true, expiresInMin: 30 };
};

const logout = ({ token }) => {
  delete getDb().sessions[token];
  return { signedOut: true };
};

const me = ({ user }) => publicUser(user);

const verifyEmail = ({ user }) => {
  user.emailVerified = true;
  return publicUser(user);
};

/** POST /auth/profile — onboarding: class, board, parent, consent, avatar (F1-04, F1-05). */
function saveProfile({ user, body }) {
  const p = user.profile || (user.profile = {});
  if (body.classId != null) {
    if (![6, 7, 8, 9, 10].includes(Number(body.classId))) throw new ApiError(ERROR_CODES.VALIDATION, 'Please choose a class between 6 and 10.');
    p.classId = Number(body.classId);
  }
  if (body.boardId) {
    if (body.boardId !== 'NCERT_CBSE') throw new ApiError(ERROR_CODES.VALIDATION, 'Only NCERT / CBSE is available right now.');
    p.boardId = body.boardId;
  }
  if (body.parent) {
    const { name, relationship, contact } = body.parent;
    if (!isValidName(name || '')) throw new ApiError(ERROR_CODES.VALIDATION, "Please enter your parent or guardian's name.");
    if (!relationship) throw new ApiError(ERROR_CODES.VALIDATION, 'Please choose the relationship.');
    const isMail = isEmail(contact || '');
    if (!isMail && !isIndianMobile(contact || '')) throw new ApiError(ERROR_CODES.VALIDATION, 'Enter a valid email or 10-digit Indian mobile number.');
    p.parent = {
      name: name.trim(),
      relationship,
      contactType: isMail ? 'EMAIL' : 'PHONE',
      contactMasked: maskContact(contact),
      contactHash: `h_${hashString(contact.trim().toLowerCase()).toString(16)}`, // hashed for matching (SEC-06)
      contactEnc: `enc:${btoa(unescape(encodeURIComponent(contact.trim())))}`, // stands in for at-rest encryption
    };
  }
  if (body.consent) {
    if (!p.parent) throw new ApiError(ERROR_CODES.VALIDATION, 'Add parent details before giving consent.');
    if (!body.consent.accepted || !body.consent.selfDeclared) throw new ApiError(ERROR_CODES.VALIDATION, 'Please tick both boxes to continue.');
    p.consent = {
      version: CONSENT_TEXT_VERSION,
      timestamp: new Date().toISOString(),
      // D-07 pending: self-declaration now; parent OTP / notice-and-objection plugs in here.
      method: 'STUDENT_SELF_DECLARATION',
      contactHash: p.parent.contactHash,
      selfDeclared: true,
    };
  }
  if (body.avatarId !== undefined) p.avatarId = body.avatarId || 'owl';
  if (body.complete) {
    if (!p.classId || !p.boardId || !p.parent || !p.consent) throw new ApiError(ERROR_CODES.VALIDATION, 'Please finish all onboarding steps.');
    p.avatarId = p.avatarId || 'owl';
    p.onboardedAt = p.onboardedAt || new Date().toISOString();
  }
  return publicUser(user);
}

/* ------------------------------------------------------------------ home */

export function challengeCard(uid, classId) {
  const st = userState(uid);
  const c = st.challenges[today()];
  const size = cfg().challenge.size;
  if (!c) return { state: 'NOT_STARTED', answered: 0, total: size, date: today() };
  const answered = Object.keys(c.answers).length;
  if (c.status === 'SUBMITTED') {
    return { state: 'COMPLETED', answered, total: c.questionIds.length, score: c.result.score, scorePct: c.result.scorePct, coinsEarned: c.result.coinsAwarded, xpEarned: c.result.xpAwarded, date: c.date, classId };
  }
  return { state: answered > 0 ? 'IN_PROGRESS' : 'NOT_STARTED', answered, total: c.questionIds.length, date: c.date };
}

function home({ uid, user }) {
  const st = userState(uid);
  const classId = user.profile.classId;
  const lastView = st.topicViews.find((v) => topicMeta(v.topicId)?.classId === classId);
  const lastTopic = lastView && topicMeta(lastView.topicId);
  const usage = st.doubtUsage[today()] || { count: 0, images: 0 };
  return {
    serverDate: today(),
    summary: summary(uid),
    challenge: challengeCard(uid, classId),
    reviewDue: dueMistakes(uid, classId).length,
    continueLearning: lastTopic ? { topicId: lastTopic.id, name: lastTopic.name, chapterName: lastTopic.chapterName, at: lastView.at } : null,
    recentActivity: st.activity.slice(0, 5),
    doubtQuota: { usedToday: usage.count, limit: cfg().ai.doubtsPerDay },
  };
}

/* ------------------------------------------------------------------ settings & account */

function updateSettings({ user, body }) {
  const allowed = ['reminders', 'reminderTime', 'parentReport', 'sound'];
  allowed.forEach((k) => { if (body[k] !== undefined) user.settings[k] = body[k]; });
  if (body.name) {
    if (!isValidName(body.name)) throw new ApiError(ERROR_CODES.VALIDATION, 'Please enter a valid name.');
    user.name = body.name.trim();
    user.displayName = leaderboardName(user.name);
  }
  if (body.avatarId) user.profile.avatarId = body.avatarId;
  return publicUser(user);
}

/** Class change keeps history segmented per class; XP, coins, streak unaffected (F1-08). */
function changeClass({ user, body }) {
  const c = Number(body.classId);
  if (![6, 7, 8, 9, 10].includes(c)) throw new ApiError(ERROR_CODES.VALIDATION, 'Please choose a class between 6 and 10.');
  user.profile.classId = c;
  userState(user.uid).recommendation = null;
  return publicUser(user);
}

/** SEC-13: machine-readable JSON export. The mock returns it immediately. */
function exportData({ uid, user }) {
  const st = userState(uid);
  return {
    exportedAt: new Date().toISOString(),
    format: 'gyaangrid-export-v1',
    profile: publicUser(user),
    attempts: st.attempts,
    mistakes: Object.values(st.mistakes),
    doubts: st.doubts.map(({ imageDataUrl: _img, ...rest }) => rest),
    coinLedger: st.coinLedger,
    xpLedger: st.xpLedger,
    testAttempts: Object.values(st.testAttempts),
  };
}

/** F1-11: soft-delete now, hard-delete within 30 days, parent notified. */
function deleteAccount({ user, body, token }) {
  if (body.confirm !== 'DELETE') throw new ApiError(ERROR_CODES.VALIDATION, 'Type DELETE to confirm.');
  const d = getDb();
  user.deletedAt = new Date().toISOString();
  user.hardDeleteAfter = addDays(today(), 30);
  delete d.sessions[token];
  d.admin.audit.unshift({ id: makeId('aud_'), at: user.deletedAt, actor: 'student (self-service)', action: 'ACCOUNT_DELETION_REQUESTED', target: user.uid, before: null, after: { hardDeleteAfter: user.hardDeleteAfter } });
  return { deleted: true, hardDeleteAfter: user.hardDeleteAfter, parentNotified: Boolean(user.profile?.parent) };
}

/* ------------------------------------------------------------------ progress (F9) */

function progress({ uid, user }) {
  const st = userState(uid);
  const classId = user.profile.classId;
  const t = today();
  const attempts = st.attempts.filter((a) => a.classId === classId);
  const activeDates = new Set([...attempts.map((a) => a.date), ...st.doubts.map((x) => x.date)]);
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6)).map((date) => ({
    date,
    active: activeDates.has(date),
    challenge: st.challenges[date]?.status === 'SUBMITTED',
    questions: attempts.filter((a) => a.date === date).length,
  }));
  const monthStart = `${t.slice(0, 7)}-01`;
  const wk = weekStartKey(t);
  const timeSpent = attempts.reduce((s, a) => s + (a.timeSpentSec || 0), 0) + st.topicViews.reduce((s, v) => s + (v.seconds || 0), 0);

  const chapters = curriculumFor(classId);
  const stats = topicStats(uid, classId);
  const totalTopics = chapters.reduce((s, ch) => s + ch.topics.length, 0);
  const touched = new Set([...Object.keys(stats), ...Object.keys(st.studied).filter((id) => topicMeta(id)?.classId === classId)]);
  const chaptersOpened = new Set(st.topicViews.map((v) => topicMeta(v.topicId)).filter((x) => x?.classId === classId).map((x) => x.chapterId));

  // 4-week trend, inactive weeks as gaps (null) not zeros (F9-04)
  const trend = [3, 2, 1, 0].map((back) => {
    const start = addDays(wk, -7 * back);
    const end = addDays(start, 6);
    const list = attempts.filter((a) => a.date >= start && a.date <= end);
    return { week: formatDate(`${start}T12:00:00+05:30`, { day: 'numeric', month: 'short' }), accuracy: list.length ? Math.round((list.filter((a) => a.correct).length / list.length) * 100) : null, questions: list.length };
  });
  const { strong, weak } = strongWeak(uid, classId);
  const tests = Object.values(st.testAttempts).filter((a) => a.status === 'SUBMITTED' && a.classId === classId);
  const ms = Object.values(st.mistakes).filter((m) => m.classId === classId);
  const repeatByTopic = {};
  ms.forEach((m) => { repeatByTopic[m.topicId] = (repeatByTopic[m.topicId] || 0) + m.wrongCount; });
  const mostRepeated = Object.entries(repeatByTopic).sort((a, b) => b[1] - a[1])[0];
  const sum = summary(uid);
  const lb = leaderboard(uid, classId);

  return {
    activity: {
      week,
      activeDaysWeek: [...activeDates].filter((d) => d >= wk).length,
      activeDaysMonth: [...activeDates].filter((d) => d >= monthStart).length,
      currentStreak: sum.currentStreak,
      longestStreak: sum.longestStreak,
      timeSpentSec: timeSpent,
    },
    learning: {
      chaptersOpened: chaptersOpened.size,
      totalChapters: chapters.length,
      topicsStudied: Object.keys(st.studied).filter((id) => topicMeta(id)?.classId === classId).length,
      topicsCompleted: Object.values(stats).filter((s) => s.mastery != null && s.mastery >= 75).length,
      materialViews: st.topicViews.filter((v) => topicMeta(v.topicId)?.classId === classId).length,
      syllabusTouchedPct: totalTopics ? Math.round((touched.size / totalTopics) * 100) : 0,
      totalTopics,
    },
    performance: {
      accuracyOverall: sum.accuracyOverall,
      trend,
      strong: strong.map(({ topicId, name, mastery, accuracy }) => ({ topicId, name, mastery, accuracy })),
      weak: weak.map(({ topicId, name, mastery, accuracy, activeMistakes }) => ({ topicId, name, mastery, accuracy, activeMistakes })),
      avgTimePerQuestionSec: attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.timeSpentSec || 0), 0) / attempts.length) : null,
      testsAttempted: tests.length,
      testsAvgScorePct: tests.length ? Math.round(tests.reduce((s, a) => s + a.result.scorePct, 0) / tests.length) : null,
      questionsAttempted: attempts.length,
    },
    mistakes: {
      total: ms.length,
      active: ms.filter((m) => m.status === 'ACTIVE').length,
      resolved: ms.filter((m) => m.status === 'RESOLVED').length,
      resolutionRate: ms.length ? Math.round((ms.filter((m) => m.status === 'RESOLVED').length / ms.length) * 100) : null,
      mostRepeatedTopic: mostRepeated ? { topicId: mostRepeated[0], name: topicMeta(mostRepeated[0])?.name, count: mostRepeated[1] } : null,
    },
    gamification: {
      totalXp: sum.totalXp, level: sum.level, levelProgress: sum.levelProgress, xpToNextLevel: sum.xpToNextLevel,
      currentStreak: sum.currentStreak, goldCoins: sum.goldCoins, rank: lb.me?.rank, classSize: lb.totalStudents,
      recentRewards: [...st.coinLedger].reverse().slice(0, 4),
    },
    mastery: chapters.map((ch) => ({
      chapterId: ch.id, name: ch.name, number: ch.number,
      topics: ch.topics.map((tp) => ({ topicId: tp.id, name: tp.name, mastery: stats[tp.id]?.mastery ?? null, attempts: stats[tp.id]?.attempts || 0, accuracy: stats[tp.id]?.accuracy ?? null })),
    })),
    weights: cfg().mastery,
  };
}

/* ------------------------------------------------------------------ rewards & leaderboard (F10) */

function rewards({ uid }) {
  const st = userState(uid);
  const t = today();
  const c = cfg();
  return {
    goldCoins: coinBalance(uid),
    totalXp: totalXp(uid),
    ledger: [...st.coinLedger].reverse(),
    xpHistory: [...st.xpLedger].reverse().slice(0, 40),
    today: {
      challenge: st.coinLedger.some((e) => e.id === `${uid}_${t}_DAILY_CHALLENGE`),
      doubt: st.coinLedger.some((e) => e.id === `${uid}_${t}_DOUBT_SOLVED`),
    },
    rules: {
      challengeCoins: c.coins.DAILY_CHALLENGE.amount,
      challengeMinScore: c.coins.DAILY_CHALLENGE.minScorePct,
      doubtCoins: c.coins.DOUBT_SOLVED.amount,
      bothBonus: c.coins.BOTH_BONUS,
      xp: c.xp,
    },
    referral: { enabled: c.flags.referrals },
    streak: effectiveStreak(uid),
  };
}

const getLeaderboard = ({ uid, user, query }) => leaderboard(uid, user.profile.classId, query.period === 'ALL_TIME' ? 'ALL_TIME' : 'WEEKLY');

/* ------------------------------------------------------------------ weekly parent report preview (F11-08) */

export function buildParentReport(uid, { weekEnd = today() } = {}) {
  const d = getDb();
  const user = d.users[uid];
  const st = userState(uid);
  const classId = user.profile.classId;
  const start = addDays(weekEnd, -6);
  const prevStart = addDays(start, -7);
  const inRange = (x, a, b) => x >= a && x <= b;
  const att = st.attempts.filter((a) => inRange(a.date, start, weekEnd));
  const prev = st.attempts.filter((a) => inRange(a.date, prevStart, addDays(start, -1)));
  const acc = (l) => (l.length ? Math.round((l.filter((a) => a.correct).length / l.length) * 100) : null);
  const { strong, weak } = strongWeak(uid, classId);
  const ms = Object.values(st.mistakes);
  const tests = Object.values(st.testAttempts).filter((a) => a.status === 'SUBMITTED' && inRange(istDateKey(new Date(a.submittedAt)), start, weekEnd));
  const fname = firstName(user.name);
  return {
    subject: `Gyaangrid — ${fname}'s week in Maths (${formatDate(`${start}T12:00:00+05:30`, { day: 'numeric', month: 'short' })} – ${formatDate(`${weekEnd}T12:00:00+05:30`, { day: 'numeric', month: 'short' })})`,
    recipientMasked: user.profile.parent?.contactMasked,
    parentName: user.profile.parent?.name,
    atAGlance: {
      activeDays: new Set(att.map((a) => a.date)).size,
      challenges: Object.values(st.challenges).filter((c) => c.status === 'SUBMITTED' && inRange(c.date, start, weekEnd)).length,
      tests: tests.length,
      testsAvg: tests.length ? Math.round(tests.reduce((s, a) => s + a.result.scorePct, 0) / tests.length) : null,
      questions: att.length,
    },
    accuracy: acc(att),
    accuracyChange: acc(att) != null && acc(prev) != null ? acc(att) - acc(prev) : null,
    doingWell: strong.map((t) => t.name),
    needsAttention: weak.map((t) => t.name),
    mistakesSaved: ms.filter((m) => inRange(istDateKey(new Date(m.createdAt)), start, weekEnd)).length,
    mistakesResolved: ms.filter((m) => m.resolvedAt && inRange(istDateKey(new Date(m.resolvedAt)), start, weekEnd)).length,
    xpEarned: st.xpLedger.filter((e) => inRange(e.date, start, weekEnd)).reduce((s, e) => s + e.amount, 0),
    coinsEarned: st.coinLedger.filter((e) => inRange(e.serverDate, start, weekEnd)).reduce((s, e) => s + e.amount, 0),
    streak: effectiveStreak(uid).current,
    suggestion: parentSuggestion(fname, weak[0]?.name),
    inactive: att.length === 0,
    schedule: cfg().parentReport,
    enabled: user.settings.parentReport && cfg().flags.parentReport,
    excludes: ['Doubt conversations or AI chat content', 'Question text or your individual answers', 'Anything you typed yourself'],
  };
}

const parentReport = ({ uid }) => buildParentReport(uid);

/* ------------------------------------------------------------------ reporting a question (F4-07) */

function reportQuestion({ uid, body }) {
  if (!body.questionId || !['WRONG_ANSWER', 'UNCLEAR', 'NOT_IN_SYLLABUS'].includes(body.reason)) throw new ApiError(ERROR_CODES.VALIDATION, 'Choose a reason.');
  getDb().admin.moderation.unshift({
    id: makeId('mod_'), type: 'QUESTION_REPORT', status: 'OPEN', questionId: body.questionId, reason: body.reason,
    note: (body.note || '').slice(0, 300), reportedBy: uid, at: new Date().toISOString(),
  });
  return { reported: true };
}

export const studentRoutes = [
  { method: 'POST', path: '/auth/register', auth: 'none', handler: register },
  { method: 'POST', path: '/auth/login', auth: 'none', handler: login },
  { method: 'POST', path: '/auth/google', auth: 'none', handler: google },
  { method: 'POST', path: '/auth/forgot', auth: 'none', handler: forgot },
  { method: 'POST', path: '/auth/logout', auth: 'student', handler: logout },
  { method: 'POST', path: '/auth/verify-email', auth: 'student', handler: verifyEmail },
  { method: 'GET', path: '/me', auth: 'student', handler: me },
  { method: 'POST', path: '/auth/profile', auth: 'student', handler: saveProfile },
  { method: 'GET', path: '/home', auth: 'student', consent: true, handler: home },
  { method: 'PATCH', path: '/settings', auth: 'student', handler: updateSettings },
  { method: 'POST', path: '/account/class', auth: 'student', consent: true, handler: changeClass },
  { method: 'POST', path: '/account/export', auth: 'student', handler: exportData },
  { method: 'DELETE', path: '/account', auth: 'student', handler: deleteAccount },
  { method: 'GET', path: '/progress', auth: 'student', consent: true, handler: progress },
  { method: 'GET', path: '/rewards', auth: 'student', consent: true, handler: rewards },
  { method: 'GET', path: '/leaderboard', auth: 'student', consent: true, handler: getLeaderboard },
  { method: 'GET', path: '/parent-report/preview', auth: 'student', consent: true, handler: parentReport },
  { method: 'POST', path: '/report/question', auth: 'student', consent: true, handler: reportQuestion },
];

