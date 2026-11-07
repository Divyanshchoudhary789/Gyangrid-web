import { http } from '../../http';
import { ApiError, ERROR_CODES } from '../../errors';
import { isEmail } from '@/lib/validators';
import { storage } from '@/lib/storage';
import { istDateKey, addDays, formatDate } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import { authApi as baseAuth, loadAppUser } from './auth';
import { doubtApi } from './doubts';
import { getBoardsWithClasses, getChapters, getTopics, getTopic, getTopicMaterials, clearCurriculumCache } from './curriculum';
import { RELATIONSHIP_TO_API, list, pageInfo } from './mappers';
import { toUiQuestion, toBackendAnswer, fromBackendAnswer, toReveal, explanationSteps, answerLabel } from './questions';

/* ================================================================== helpers */

const me = () => useAuthStore.getState().user || {};
const classIdOf = () => me().profile?.classId || null;
const pct = (n) => (n == null ? null : Math.round(Number(n)));

/** Locally remembered, server-graded results (the backend doesn't return them again later). */
const memory = {
  get: (k) => storage.get(`rv:${k}`, {}),
  set: (k, v) => storage.set(`rv:${k}`, v),
  patch: (k, id, v) => storage.set(`rv:${k}`, { ...storage.get(`rv:${k}`, {}), [id]: v }),
};

/** `awarded: { xp, coins }` from a grading / completion response (null when absent). */
const awardedOf = (r) => {
  const a = r?.awarded || r?.rewards || null;
  if (!a || (a.xp == null && a.coins == null)) return null;
  // Answers send plain numbers (or null); completions send { awarded, transaction: { amount } }.
  const amount = (v) => (typeof v === 'object' ? (v?.awarded === false ? 0 : Number(v?.transaction?.amount ?? v?.amount ?? 0)) : Number(v ?? 0));
  return { xp: amount(a.xp), coins: amount(a.coins) };
};

/**
 * Completion payloads carry `breakdown` on the first question, with null names. The names are
 * filled in from the questions themselves.
 */
function breakdownOf(data) {
  const qs = data?.questions || [];
  const bd = data?.breakdown || qs.find((q) => q.breakdown)?.breakdown;
  if (!bd) return { chapters: [], topics: [] };
  const name = (key, idKey, id) => qs.find((q) => String(q[idKey]) === String(id))?.[key] || null;
  return {
    chapters: (bd.chapters || []).map((c) => ({ ...c, name: c.name || c.chapterName || name('chapterName', 'chapterId', c.chapterId) })),
    topics: (bd.topics || []).map((t) => ({ ...t, name: t.name || t.topicName || name('topicName', 'topicId', t.topicId) })),
  };
}

/** A server question that carries the student's answer and the solution (result screens). */
function serverReveal(raw) {
  const q = toUiQuestion(raw);
  const your = raw.yourAnswer ?? raw.selectedAnswer ?? raw.answer ?? null;
  const yourUi = your == null || your === '' ? null : fromBackendAnswer(q, your);
  return {
    ...toReveal(q, { yourAnswer: yourUi, isCorrect: raw.isCorrect, correctAnswer: raw.correctAnswer, explanation: raw.explanationSteps || raw.explanation }),
    topicId: raw.topicId?._id || raw.topicId || q.topicId,
    topicName: raw.topicName || raw.topicId?.name || null,
  };
}

/** Ledger entries tied to a given source (fallback when a response has no `awarded` block). */
async function awardsFor(sourceId) {
  try {
    const [xp, coins] = await Promise.all([
      http.get('/rewards/xp/history', { page: 1, limit: 20 }),
      http.get('/rewards/coins/history', { page: 1, limit: 20 }),
    ]);
    const match = (e) => String(e.sourceId || '').includes(String(sourceId));
    return {
      xp: list(xp).filter(match).reduce((s, e) => s + Number(e.amount || 0), 0),
      coins: list(coins).filter(match).reduce((s, e) => s + Number(e.amount || 0), 0),
    };
  } catch {
    return { xp: 0, coins: 0 };
  }
}

/** All topics of the student's class with chapter info (cached per page load). */
async function classTopics(classId) {
  const chapters = await getChapters(classId);
  const withTopics = await Promise.all(chapters.map(async (ch) => ({ ch, topics: await getTopics(ch._id).catch(() => []) })));
  const byId = new Map();
  withTopics.forEach(({ ch, topics }) => topics.forEach((t) => byId.set(t._id, { ...t, chapterName: ch.name, chapterNumber: ch.chapterNumber })));
  return { chapters: withTopics, byId };
}

async function chapterNameMap(classId) {
  const chapters = await getChapters(classId).catch(() => []);
  return new Map(chapters.map((c) => [c._id, c.name]));
}

/** Recommendation → closed action set with a deep-linkable target (F9-07). */
function mapRecommendation(rec, classId) {
  if (!rec?.action) return null;
  const action = rec.action || rec.type;
  const targetIsClass = rec.targetId && rec.targetId === classId;
  const labels = {
    READ_MATERIAL: 'Start learning',
    PRACTICE_TOPIC: 'Practise now',
    REVIEW_MISTAKES: 'Review mistakes',
    TAKE_TEST: 'Take a test',
    CONTINUE_CHALLENGE: "Open today's challenge",
  };
  return { action, targetId: rec.targetId || null, targetKind: targetIsClass ? 'CLASS' : 'TOPIC', reason: rec.reason || '', ctaLabel: rec.ctaLabel || labels[action] || 'Continue' };
}

/* ================================================================== auth & onboarding */

/** +91XXXXXXXXXX for 10-digit Indian mobile numbers. */
export function normalisePhone(v) {
  const d = String(v).replace(/[^\d]/g, '');
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith('91')) return `+${d}`;
  return v;
}

/** PUT /profile/onboarding accepts partial updates, so each onboarding step saves what it collected. */
async function saveProfile(body) {
  const payload = {};
  if (body.classId != null) payload.classId = body.classId;
  if (body.boardId) payload.boardId = body.boardId;
  if (body.parent) {
    const contact = String(body.parent.contact || '').trim();
    payload.parentName = body.parent.name?.trim();
    payload.parentRelationship = RELATIONSHIP_TO_API[body.parent.relationship] || 'OTHER';
    payload.parentContactType = isEmail(contact) ? 'email' : 'mobile';
    payload.parentContact = isEmail(contact) ? contact : normalisePhone(contact);
  }
  if (body.consent) {
    if (!body.consent.accepted || !body.consent.selfDeclared) throw new ApiError(ERROR_CODES.VALIDATION, 'Please tick both boxes to continue.');
    payload.parentPermissionGranted = true;
    payload.termsAccepted = true;
    payload.privacyAccepted = true;
  }
  if (body.avatarId !== undefined) payload.avatarId = body.avatarId || null;
  if (Object.keys(payload).length) await http.put('/profile/onboarding', payload);
  return loadAppUser();
}

export const authApi = { ...baseAuth, saveProfile };
export const curriculumApi = { boardsWithClasses: getBoardsWithClasses };

/* ================================================================== home (GET /home) */

function mapSummary(g = {}, extras = {}) {
  const totalXp = Number(g.totalXp ?? 0);
  const min = Number(g.currentLevelMinXp ?? 0);
  const max = Number(g.nextLevelMinXp ?? (min + 100));
  return {
    totalXp,
    level: g.level ?? 1,
    levelProgress: max > min ? Math.max(0, Math.min(100, Math.round(((totalXp - min) / (max - min)) * 100))) : 0,
    xpToNextLevel: g.xpToNextLevel ?? Math.max(0, max - totalXp),
    goldCoins: Number(g.coins ?? 0),
    currentStreak: g.currentStreak ?? extras.streak?.current ?? 0,
    longestStreak: g.bestStreak ?? extras.streak?.longest ?? 0,
    mistakes: extras.mistakes || { total: 0, active: 0, resolved: 0 },
    accuracyOverall: extras.accuracy ?? null,
    accuracyLast7d: null,
    rank: { classWeekly: extras.rank ?? null },
    recommendation: extras.recommendation || null,
    dailyGoals: (g.dailyGoals || []).map((d) => ({ key: d.key, label: d.label, coins: d.coins, completed: Boolean(d.completed) })),
  };
}

function challengeCard(dc) {
  if (!dc || dc.available === false) return { state: 'UNAVAILABLE', answered: 0, total: 0 };
  const status = String(dc.status || '').toUpperCase();
  const total = dc.totalQuestions ?? 0;
  const answered = dc.answeredQuestions ?? 0;
  if (status === 'COMPLETED') {
    return { state: 'COMPLETED', id: dc.id, answered, total, score: dc.correctCount ?? dc.score ?? 0, scorePct: total ? Math.round(((dc.correctCount ?? 0) / total) * 100) : 0, date: dc.date };
  }
  return { state: answered > 0 ? 'IN_PROGRESS' : 'NOT_STARTED', id: dc.id, answered, total: total || 5, date: dc.date };
}

const ACTIVITY_LINK = { CHALLENGE: '/challenge', PRACTICE: '/practice', TEST: '/tests', MISTAKE: '/mistakes', REWARD: '/rewards' };

function activityFrom(home) {
  if (Array.isArray(home.recentActivity)) {
    return home.recentActivity.slice(0, 6).map((a, i) => {
      const type = String(a.type || 'PRACTICE').toUpperCase();
      const meta = a.meta || {};
      let link = ACTIVITY_LINK[type] || '/home';
      if (type === 'TEST' && meta.sessionId) link = `/tests/result/${meta.sessionId}`;
      if (type === 'MISTAKE' && (meta.mistakeId || meta.id)) link = `/mistakes/${meta.mistakeId || meta.id}`;
      const detail = meta.detail || (meta.xp ? `+${meta.xp} XP` : meta.coins ? `+${meta.coins} coins` : meta.score != null && meta.total != null ? `${meta.score}/${meta.total}` : '');
      return { id: a._id || a.id || `${type}-${i}`, type: type === 'REWARD' ? 'PRACTICE' : type, title: a.title || 'Activity', detail, link, at: a.at || a.createdAt };
    });
  }
  const items = [];
  (home.gamification?.recentRewards || []).forEach((r, i) => items.push({
    id: r._id || `rw${i}`, type: r.source === 'DAILY_CHALLENGE' ? 'CHALLENGE' : r.source === 'TEST' ? 'TEST' : 'PRACTICE',
    title: r.description || 'Reward earned', detail: `+${r.amount} ${r.currency === 'COIN' || r.balanceAfter != null ? 'coins' : 'XP'}`, link: '/rewards', at: r.createdAt,
  }));
  const tr = home.tests?.recentResult;
  if (tr) items.push({ id: tr._id || 'test', type: 'TEST', title: 'Test submitted', detail: `${tr.obtainedMarks ?? 0}/${tr.totalMarks ?? 0} marks`, link: tr.sessionId ? `/tests/result/${tr.sessionId}` : '/tests', at: tr.submittedAt || tr.createdAt });
  (home.mistakes?.recent || []).forEach((m) => items.push({ id: m.id, type: 'MISTAKE', title: 'Mistake saved for review', detail: (m.source || '').replace('_', ' ').toLowerCase(), link: `/mistakes/${m.id}`, at: m.lastMistakenAt }));
  return items.filter((x) => x.at).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5);
}

async function getHome() {
  const [home, lb, doubtQuota] = await Promise.all([
    http.get('/home'),
    http.get('/leaderboard', { period: 'week', page: 1, limit: 1 }).catch(() => null),
    doubtApi.quota().catch(() => null),
  ]);
  const classId = home.student?.class?.id || classIdOf();
  const ms = home.mistakes || {};
  const summary = mapSummary(home.gamification || {}, {
    streak: home.streak,
    accuracy: home.progress?.overall?.attempts ? pct(home.progress.overall.accuracy) : null,
    mistakes: { total: (ms.activeCount ?? 0) + (ms.resolvedCount ?? 0), active: ms.activeCount ?? 0, resolved: ms.resolvedCount ?? 0 },
    rank: (lb?.me || lb?.currentUser)?.rank ?? null,
    recommendation: mapRecommendation(home.recommendation, classId),
  });
  const cl = home.continueLearning;
  return {
    serverDate: istDateKey(),
    student: home.student || null,
    summary,
    challenge: challengeCard(home.dailyChallenge),
    reviewDue: ms.activeCount ?? 0,
    continueLearning: cl ? { topicId: cl.topicId || cl.topic?.id || cl.id, name: cl.topicName || cl.topic?.name || cl.name, chapterName: cl.chapterName || cl.chapter?.name || '' } : null,
    recentActivity: activityFrom(home),
    doubtQuota,
    tests: home.tests || null,
  };
}

export const homeApi = { get: getHome };

/* ================================================================== learn (curriculum + materials + topic progress) */

async function topicProgressMap() {
  try {
    const d = await http.get('/progress/topics', { page: 1, limit: 100 });
    return new Map(list(d).map((t) => [String(t.topicId?._id || t.topicId), {
      mastery: t.masteryScore ?? t.mastery ?? null,
      attempts: t.attempts ?? t.totalAttempts ?? 0,
      accuracy: t.accuracy != null ? pct(t.accuracy) : null,
      studied: Boolean(t.studied || t.materialViewed),
      last5: t.lastResults || t.last5 || null,
      activeMistakes: t.activeMistakes ?? 0,
    }]));
  } catch {
    return new Map();
  }
}

async function getCurriculum() {
  const classId = classIdOf();
  if (!classId) throw new ApiError(ERROR_CODES.ONBOARDING_REQUIRED, 'Please finish setting up your class first.');
  const [{ chapters }, progress] = await Promise.all([classTopics(classId), topicProgressMap()]);
  return {
    classId,
    grade: me().profile?.grade ?? null,
    chapters: chapters.map(({ ch, topics }, i) => {
      const ts = topics.map((t, j) => {
        const p = progress.get(String(t._id)) || {};
        return { id: t._id, name: t.name, number: t.topicNumber ?? j + 1, questionCount: t.questionCount ?? null, progressPct: t.progressPct ?? null, mastery: p.mastery ?? null, attempts: p.attempts || 0, accuracy: p.accuracy ?? null, studied: Boolean(t.studied || p.studied), hasMaterial: null };
      });
      const scored = ts.filter((t) => t.mastery != null);
      return {
        id: ch._id, number: ch.chapterNumber ?? i + 1, name: ch.name, description: ch.description || '',
        topicCount: ts.length, questionCount: ch.questionCount ?? (ts.some((t) => t.questionCount != null) ? ts.reduce((n, t) => n + (t.questionCount || 0), 0) : null),
        mastery: scored.length ? Math.round(scored.reduce((s, t) => s + t.mastery, 0) / scored.length) : null,
        studiedCount: ts.filter((t) => t.studied).length,
        topics: ts,
      };
    }),
  };
}

/** Backend materials → UI blocks. rich_text content is HTML and is sanitised at render time. */
function materialBlocks(items) {
  return items.map((m) => {
    const type = String(m.type || '').toLowerCase();
    const url = m.url || m.fileUrl || m.pdfUrl || m.videoUrl || m.contentUrl || (type !== 'rich_text' && /^https?:/.test(m.content || '') ? m.content : null);
    if (type === 'pdf') return { id: m._id, type: 'PDF', title: m.title || 'Notes (PDF)', url, pages: m.pages || null };
    if (type === 'video') return { id: m._id, type: 'VIDEO', title: m.title || 'Video lesson', url, durationSec: m.durationSeconds || m.durationSec || null };
    return { id: m._id, type: 'HTML', title: m.title, html: m.content || '' };
  });
}

async function getTopicDetail(topicId) {
  const classId = classIdOf();
  const [topic, materials, progress] = await Promise.all([getTopic(topicId), getTopicMaterials(topicId).catch(() => []), topicProgressMap()]);
  if (!topic) throw new ApiError(ERROR_CODES.NOT_FOUND, 'This topic could not be found.', { status: 404 });
  // Class isolation (F3-01): never show a topic outside the student's own class.
  const chapters = await getChapters(classId).catch(() => []);
  const chapter = chapters.find((c) => c._id === topic.chapterId);
  if (!chapter) throw new ApiError(ERROR_CODES.FORBIDDEN, 'This topic is not part of your class.', { status: 403 });
  const siblings = await getTopics(chapter._id).catch(() => []);
  const idx = siblings.findIndex((t) => t._id === topicId);
  const p = progress.get(String(topicId));
  const published = materials.filter((m) => !m.status || String(m.status).toUpperCase() === 'PUBLISHED');
  memory.set(`mat:${topicId}`, published.map((m) => m._id));
  return {
    topic: { id: topic._id, name: topic.name, description: topic.description || '', chapterId: chapter._id, chapterName: chapter.name, number: topic.topicNumber },
    material: published.length ? { blocks: materialBlocks(published) } : null,
    stats: p && p.attempts ? { attempts: p.attempts, accuracy: p.accuracy, mastery: p.mastery, activeMistakes: p.activeMistakes, last5: Array.isArray(p.last5) ? p.last5 : [] } : null,
    questionCount: topic.questionCount ?? null,
    studied: Boolean(topic.studied || p?.studied),
    activeMistakes: p?.activeMistakes || 0,
    prev: idx > 0 ? { id: siblings[idx - 1]._id, name: siblings[idx - 1].name } : null,
    next: idx >= 0 && idx < siblings.length - 1 ? { id: siblings[idx + 1]._id, name: siblings[idx + 1].name } : null,
  };
}

/** POST /materials/:id/view for each published material of the topic (idempotent on the server). */
async function recordView(topicId, seconds) {
  if (seconds < 20) return { studied: false, newlyStudied: false };
  const ids = storage.get(`rv:mat:${topicId}`, []);
  if (!ids.length) return { studied: false, newlyStudied: false };
  const already = memory.get('studied')[topicId];
  await Promise.all(ids.map((id) => http.post(`/materials/${id}/view`, {}).catch(() => null)));
  memory.patch('studied', topicId, true);
  clearCurriculumCache(); // topic `studied` / `progressPct` changed on the server
  return { studied: true, newlyStudied: !already };
}

export const learnApi = { curriculum: getCurriculum, topic: getTopicDetail, recordView };

/* ================================================================== daily challenge (/daily-challenge) */

function challengePayload(data) {
  const c = data.challenge || {};
  const questions = (data.questions || []).map(toUiQuestion);
  // Answered questions come back with the student's answer + solution; fall back to the local cache.
  const fromServer = Object.fromEntries((data.questions || [])
    .filter((q) => q.yourAnswer != null || q.isCorrect != null)
    .map((q) => [String(q.questionId || q._id), serverReveal(q)]));
  const cache = { ...memory.get(`dc:${c._id}`), ...fromServer };
  const answeredCount = (c.correctCount ?? 0) + (c.incorrectCount ?? 0);
  const status = String(c.status || '').toUpperCase() === 'COMPLETED' ? 'SUBMITTED' : answeredCount > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
  return {
    id: c._id,
    date: c.challengeDate,
    status,
    total: questions.length,
    // The server grades in order and doesn't return per-question answers; resume at the next unanswered one.
    currentIndex: Math.min(answeredCount, Math.max(0, questions.length - 1)),
    answeredCount,
    answers: Object.fromEntries(Object.entries(cache).map(([k, v]) => [k, v.yourAnswer])),
    reveals: cache,
    questions,
    score: { correct: c.correctCount ?? 0, incorrect: c.incorrectCount ?? 0, total: c.totalQuestions ?? questions.length },
    result: null,
    graded: true,
  };
}

let currentChallenge = null;
async function challengeToday() {
  const data = await http.get('/daily-challenge');
  currentChallenge = challengePayload(data);
  return currentChallenge;
}

async function challengeAnswer({ questionId, answer, timeSpentSec }) {
  const c = currentChallenge || await challengeToday();
  const q = c.questions.find((x) => x.questionId === questionId);
  try {
    const r = await http.post(`/daily-challenge/${c.id}/answer`, { questionId, answer: toBackendAnswer(q, answer), timeTakenSeconds: Math.min(3600, Math.max(0, Math.round(timeSpentSec || 0))) });
    const reveal = { ...toReveal(q, { yourAnswer: answer, isCorrect: r.isCorrect, correctAnswer: r.correctAnswer, explanation: r.explanationSteps || r.explanation }), awarded: awardedOf(r) };
    memory.patch(`dc:${c.id}`, questionId, reveal);
    return { saved: true, reveal, answered: (r.score?.correct ?? 0) + (r.score?.incorrect ?? 0), total: r.score?.total ?? c.total };
  } catch (e) {
    if (e.details?.backendCode === 'QUESTION_ALREADY_ANSWERED') return { saved: true, alreadyAnswered: true, reveal: memory.get(`dc:${c.id}`)[questionId] || null };
    throw e;
  }
}

function challengeResult(c, completeData, awards) {
  const score = typeof completeData?.score === 'number'
    ? { correct: completeData.score, incorrect: (completeData.total ?? c.total) - completeData.score, total: completeData.total ?? c.total }
    : completeData?.score || c.score;
  const total = score.total || c.total || 0;
  const correct = score.correct ?? 0;
  const reveals = memory.get(`dc:${c.id}`);
  return {
    challengeId: c.id,
    date: c.date,
    score: correct,
    total,
    scorePct: total ? Math.round((correct / total) * 100) : 0,
    xpAwarded: awards.xp,
    coinsAwarded: awards.coins,
    coinReason: awards.coins ? null : null,
    mistakesSaved: score.incorrect ?? 0,
    streak: completeData?.streak ? { current: completeData.streak.currentStreak ?? 0, longest: completeData.streak.longestStreak ?? 0, extended: true, milestoneXp: 0 } : null,
    diagnosis: diagnosisFrom(breakdownOf(completeData)),
    // Same order the student answered them in.
    questions: (completeData?.questions?.length
      ? c.questions.map((q) => completeData.questions.find((x) => String(x.questionId) === String(q.questionId))).filter(Boolean).map(serverReveal)
      : c.questions.map((q) => reveals[q.questionId]).filter(Boolean)),
    alreadySubmitted: false,
  };
}

async function challengeSubmit() {
  const c = currentChallenge || await challengeToday();
  const done = await http.post(`/daily-challenge/${c.id}/complete`, {});
  const awards = awardedOf(done) || await awardsFor(c.id);
  currentChallenge = { ...c, status: 'SUBMITTED' };
  return challengeResult(currentChallenge, done, awards);
}

async function challengeResultGet() {
  const data = await http.get('/daily-challenge');
  const c = challengePayload(data);
  currentChallenge = c;
  if (c.status !== 'SUBMITTED') throw new ApiError(ERROR_CODES.NOT_FOUND, "You haven't finished today's challenge yet.", { status: 404 });
  const awards = awardedOf(data.challenge) || awardedOf(data) || await awardsFor(c.id);
  return { ...challengeResult(c, null, awards), alreadySubmitted: true };
}

export const challengeApi = { today: challengeToday, answer: challengeAnswer, submit: challengeSubmit, result: challengeResultGet };

/* ================================================================== practice (/practice) */

async function practiceStart({ scope = 'TOPIC', targetId, size = 10, difficulty = 'MIXED', maxDifficulty = null, title = null }) {
  const classId = classIdOf();
  const body = { classId, numberOfQuestions: Math.min(25, Math.max(1, Number(size) || 10)) };
  let label = title;
  if (scope === 'TOPIC' && targetId) {
    body.topicId = targetId;
    if (!label) label = (await getTopic(targetId).catch(() => null))?.name || 'Topic practice';
  } else if (scope === 'CHAPTER' && targetId) {
    body.chapterId = targetId;
    if (!label) label = (await getChapters(classId).catch(() => [])).find((c) => c._id === targetId)?.name || 'Chapter practice';
  } else if (scope === 'WEAK') {
    body.mode = 'WEAK_TOPICS'; // the server picks questions from the student's weak topics
    label = label || 'My weak topics';
  }
  const diff = difficulty !== 'MIXED' ? difficulty : maxDifficulty === 'EASY' ? 'EASY' : null;
  if (diff) body.difficulty = diff;
  let data;
  try {
    data = await http.post('/practice/start', body);
  } catch (e) {
    if (e.code === ERROR_CODES.NOT_FOUND || e.code === ERROR_CODES.VALIDATION) {
      throw new ApiError(e.code, e.message || 'New questions for this topic are being added. Try another topic for now.', { status: e.status, details: e.details });
    }
    throw e;
  }
  const sid = data.session?._id;
  const got = data.session?.totalQuestions ?? (data.questions || []).length;
  memory.set(`ps-meta:${sid}`, { title: label });
  return {
    ...practicePayload(data),
    notice: got < body.numberOfQuestions ? `Only ${got} question${got === 1 ? ' is' : 's are'} available here right now — more are being added.` : null,
  };
}

function practicePayload(data) {
  const s = data.session || {};
  const cache = memory.get(`ps:${s._id}`);
  const meta = storage.get(`rv:ps-meta:${s._id}`, {});
  const graded = new Map([...(s.answers || []), ...(data.questions || []).filter((q) => q.isCorrect != null)].map((a) => [String(a.questionId || a._id), a]));
  const questions = (data.questions || []).map(toUiQuestion).map((q) => {
    if (cache[q.questionId]) return cache[q.questionId];
    const a = graded.get(String(q.questionId));
    // Answered on another device/session: we know the outcome but not the worked solution.
    return a ? toReveal(q, { yourAnswer: fromBackendAnswer(q, a.yourAnswer ?? a.selectedAnswer), isCorrect: a.isCorrect, correctAnswer: a.correctAnswer ?? null, explanation: a.explanationSteps || a.explanation || null }) : q;
  });
  return {
    id: s._id,
    title: meta.title || 'Practice',
    status: String(s.status || '').toUpperCase() === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
    questions,
    answeredCount: (s.answers || []).length,
    summary: null,
  };
}

const practiceGet = async (id) => practicePayload(await http.get(`/practice/${id}`));

async function practiceAnswer({ setId, questionId, answer, timeSpentSec }) {
  const data = await http.get(`/practice/${setId}`);
  const q = (data.questions || []).map(toUiQuestion).find((x) => x.questionId === questionId);
  if (!q) throw new ApiError(ERROR_CODES.VALIDATION, 'This question is not part of this practice set.');
  const r = await http.post(`/practice/${setId}/answer`, { questionId, answer: toBackendAnswer(q, answer), timeTakenSeconds: Math.min(3600, Math.max(0, Math.round(timeSpentSec || 0))) });
  const reveal = { ...toReveal(q, { yourAnswer: answer, isCorrect: r.isCorrect, correctAnswer: r.correctAnswer, explanation: r.explanationSteps || r.explanation }), xpAwarded: awardedOf(r)?.xp || 0, mistakeSaved: !r.isCorrect };
  memory.patch(`ps:${setId}`, questionId, reveal);
  return reveal;
}

async function practiceFinish(id) {
  const r = await http.post(`/practice/${id}/complete`, {});
  const awards = awardedOf(r) || await awardsFor(id);
  // `score` is a number on completion, alongside `total` and the graded questions.
  const correct = typeof r.score === 'number' ? r.score : r.score?.correct ?? 0;
  const graded = (r.questions || []).filter((q) => q.yourAnswer != null && q.yourAnswer !== '');
  const answered = r.questions ? graded.length : correct + (r.score?.incorrect ?? 0);
  return {
    total: r.total ?? r.score?.total ?? answered,
    answered,
    correct,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    xpAwarded: awards.xp,
    coinsAwarded: awards.coins,
    mistakesSaved: Math.max(0, answered - correct),
    diagnosis: diagnosisFrom(breakdownOf(r)).filter((t) => !r.questions || graded.some((q) => String(q.topicId) === String(t.topicId))),
  };
}

/** Topic breakdown → the "how you did per topic" list on summary screens. */
function diagnosisFrom(breakdown) {
  return (breakdown?.topics || []).map((t) => {
    const accuracy = t.total ? Math.round(((t.correct ?? 0) / t.total) * 100) : 0;
    return {
      topicId: t.topicId, name: t.name || 'Topic', correct: t.correct ?? 0, total: t.total ?? 0, accuracy,
      status: accuracy >= 75 ? 'STRONG' : accuracy >= 50 ? 'PARTIAL' : 'NEEDS_PRACTICE',
    };
  });
}

export const practiceApi = { start: practiceStart, get: practiceGet, submitAnswer: practiceAnswer, finish: practiceFinish };

/* ================================================================== tests & series (/tests, /test-series) */

const testKind = (t) => (t.testType === 'FULL_SYLLABUS' ? 'FULL' : 'CHAPTER');

async function historyByTest() {
  const d = await http.get('/tests/history', { page: 1, limit: 50 }).catch(() => null);
  const map = new Map();
  inProgress.clear();
  const isOpen = (r) => r.isSession === true ? ['ACTIVE', 'IN_PROGRESS'].includes(String(r.status || '').toUpperCase()) : String(r.status || '').toUpperCase() === 'IN_PROGRESS';
  list(d).filter(isOpen).forEach((r) => {
    inProgress.set(String(r.testId?._id || r.testId), { sessionId: r.sessionId || r._id, expiresAt: r.expiresAt });
  });
  [...list(d).filter((r) => !isOpen(r) && !(r.isSession && !r.submittedAt))].sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt))).forEach((r) => {
    const k = String(r.testId?._id || r.testId);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  return map;
}

/** In-progress sessions reported by GET /tests/history (resumable on any device). */
const inProgress = new Map();

function activeSessionFor(testId) {
  const remote = inProgress.get(String(testId));
  if (remote && (!remote.expiresAt || new Date(remote.expiresAt).getTime() > Date.now())) return remote;
  const s = storage.get(`ts:${testId}`, null);
  if (!s) return null;
  if (new Date(s.expiresAt).getTime() + 60000 < Date.now()) return null;
  return s;
}

/** History rows carry score + totalMarks rather than percentage / obtainedMarks. */
function attemptSummary(h) {
  const marks = h.obtainedMarks ?? h.score ?? 0;
  const scorePct = h.percentage != null ? pct(h.percentage) : h.totalMarks ? Math.round((marks / h.totalMarks) * 100) : 0;
  return { attemptId: h.sessionId, scorePct, marks, submittedAt: h.submittedAt, passed: h.passed };
}

function testCard(t, history, chapterNames, series = null, order = null) {
  const done = history.get(String(t._id)) || [];
  const first = done[0];
  const totalQ = t.totalQuestions || t.questionIds?.length || 0;
  const active = activeSessionFor(t._id);
  return {
    id: t._id,
    title: t.title,
    description: t.description || '',
    kind: series ? 'SERIES' : testKind(t),
    durationSec: t.durationSeconds || 0,
    totalMarks: t.totalMarks || 0,
    passingMarks: t.passingMarks ?? null,
    questionCount: totalQ,
    marksPerQ: totalQ ? Math.round(((t.totalMarks || totalQ) / totalQ) * 100) / 100 : 1,
    negativeMarks: Number(t.negativeMarksPerQuestion ?? 0),
    allowNegativeTotal: Boolean(t.allowNegativeTotal),
    maxAttempts: t.maxAttempts ?? null,
    customInstructions: Array.isArray(t.instructions) ? t.instructions.filter(Boolean) : [],
    seriesId: series?._id || null,
    order,
    reattempt: t.maxAttempts == null || t.maxAttempts > 1,
    chapters: t.chapterId ? [chapterNames.get(String(t.chapterId)) || 'Chapter test'] : [],
    status: active ? 'IN_PROGRESS' : first ? 'COMPLETED' : 'AVAILABLE',
    firstAttempt: first ? attemptSummary(first) : null,
    attemptsCount: done.length,
    canReattempt: t.maxAttempts == null || done.length < t.maxAttempts,
    inProgressAttemptId: active?.sessionId || null,
  };
}

async function listTests() {
  const classId = classIdOf();
  const [tests, series, history, chapterNames] = await Promise.all([
    http.get('/tests/student', { classId, subject: 'MATHEMATICS', page: 1, limit: 50 }),
    http.get('/test-series/student', { classId, subject: 'MATHEMATICS', page: 1, limit: 50 }),
    historyByTest(),
    chapterNameMap(classId),
  ]);
  // Defence in depth: only this class's tests, even if the server returns more (F3-01).
  const mine = list(tests).filter((t) => !t.classId || String(t.classId) === String(classId));
  const cards = mine.map((t) => testCard(t, history, chapterNames));
  return {
    chapterTests: cards.filter((t) => t.kind === 'CHAPTER'),
    fullTests: cards.filter((t) => t.kind === 'FULL'),
    series: list(series).filter((s) => !s.classId || String(s.classId) === String(classId)).map((s) => {
      const unlockMode = String(s.unlockMode || 'OPEN').toUpperCase() === 'SEQUENTIAL' ? 'SEQUENTIAL' : 'OPEN';
      const completedIds = new Set((s.progress?.completedTestIds || s.completedTestIds || []).map(String));
      const nextId = s.progress?.nextUnlockedTestId || s.nextUnlockedTestId || null;
      let ts = (s.orderedTestIds || []).map((id, i) => {
        const t = mine.find((x) => String(x._id) === String(id?._id || id));
        return t ? testCard(t, history, chapterNames, s, i + 1) : null;
      }).filter(Boolean);
      if (unlockMode === 'SEQUENTIAL') {
        // A test is open once the previous one is done (server progress wins when provided).
        ts = ts.map((t, i) => {
          const done = completedIds.has(String(t.id)) || Boolean(t.firstAttempt);
          const unlocked = i === 0 || done || String(t.id) === String(nextId) || Boolean(ts[i - 1].firstAttempt) || completedIds.has(String(ts[i - 1].id));
          return unlocked || t.status === 'IN_PROGRESS' ? t : { ...t, status: 'LOCKED' };
        });
      }
      const done = ts.filter((t) => t.firstAttempt);
      return {
        id: s._id, title: s.title, description: s.description || '', unlockMode, tests: ts,
        progress: {
          completed: done.length, total: ts.length,
          averageScorePct: done.length ? Math.round(done.reduce((sum, t) => sum + (t.firstAttempt.scorePct || 0), 0) / done.length) : null,
          strongestChapter: null, weakestChapter: null,
        },
      };
    }),
  };
}

function instructionsFor(card) {
  const mins = Math.round(card.durationSec / 60);
  return [
    `This test has ${card.questionCount} question${card.questionCount === 1 ? '' : 's'} and lasts ${mins} minute${mins === 1 ? '' : 's'}.`,
    `It carries ${card.totalMarks} marks${card.passingMarks != null ? `; ${card.passingMarks} marks are needed to pass` : ''}.`,
    card.negativeMarks ? `Each wrong answer deducts ${card.negativeMarks} mark${card.negativeMarks === 1 ? '' : 's'}. Unanswered questions score 0.` : 'There is no negative marking.',
    'The timer runs on our server — leaving the page does not pause it.',
    'Your answers are saved as you go. You can change an answer until you submit.',
    'When the time is up, your saved answers are submitted automatically.',
  ];
}

async function getTestDetail(id) {
  const classId = classIdOf();
  const [d, history, chapterNames] = await Promise.all([http.get(`/tests/${id}`), historyByTest(), chapterNameMap(classId)]);
  const t = d.test || d;
  if (t.classId && String(t.classId) !== String(classId)) throw new ApiError(ERROR_CODES.FORBIDDEN, 'This test is not for your class.', { status: 403 });
  const card = testCard(t, history, chapterNames);
  return { ...card, instructions: card.customInstructions.length ? card.customInstructions : instructionsFor(card), seriesTitle: null };
}

function sessionPayload(testId, data) {
  const questions = (data.questions || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(toUiQuestion);
  const answers = {};
  (data.currentAnswerState || []).forEach((a) => {
    const q = questions.find((x) => String(x.questionId) === String(a.questionId));
    if (q && a.answer != null) answers[q.questionId] = fromBackendAnswer(q, a.answer);
  });
  return {
    attemptId: data.sessionId,
    test: {
      id: testId, title: data.test?.title || 'Test', durationSec: data.durationSeconds || data.test?.durationSeconds || 0,
      totalMarks: data.test?.totalMarks || 0, marksPerQ: 1, negativeMarks: Number(data.test?.negativeMarksPerQuestion ?? 0),
    },
    questions,
    answers,
    marked: [],
    remainingSec: Math.max(0, Math.round((new Date(data.expiresAt).getTime() - Date.now()) / 1000)),
    expiresAt: data.expiresAt,
    savedAt: null,
  };
}

async function startTest(id) {
  try {
    // Starting again returns the active session (with saved answers) if there is one.
    const data = await http.post(`/tests/${id}/start`, {});
    const prev = storage.get(`ts:${id}`, null);
    const sameSession = prev && prev.sessionId === data.sessionId;
    const p = sessionPayload(id, data);
    const synced = { ...p.answers };
    storage.set(`ts:${id}`, { sessionId: data.sessionId, expiresAt: data.expiresAt, data, synced, local: sameSession ? prev.local : undefined });
    // Answers typed offline on this device that the server hasn't received yet.
    return sameSession && prev.local ? { ...p, answers: { ...p.answers, ...prev.local } } : p;
  } catch (e) {
    if (e.details?.backendCode === 'SESSION_ACTIVE_EXISTS') {
      const sid = e.details?.data?.sessionId;
      if (sid && e.details?.data?.questions) {
        const p = sessionPayload(id, { ...e.details.data, sessionId: sid });
        storage.set(`ts:${id}`, { sessionId: sid, expiresAt: e.details.data.expiresAt, data: { ...e.details.data, sessionId: sid }, synced: { ...p.answers } });
        return p;
      }
      const saved = storage.get(`ts:${id}`, null);
      if (saved?.data) {
        const p = sessionPayload(id, saved.data);
        return { ...p, answers: { ...p.answers, ...(saved.local || {}) } };
      }
      throw new ApiError(ERROR_CODES.CONFLICT, 'You already have this test running on another device or browser. Please finish it there — it will be submitted automatically when the time runs out.', { status: 409 });
    }
    throw e;
  }
}

/** Sends only answers that changed since the last successful save. */
async function syncAnswers(testId, attemptId, answers) {
  const saved = storage.get(`ts:${testId}`, null) || { sessionId: attemptId, synced: {}, data: null };
  const questions = (saved.data?.questions || []).map(toUiQuestion);
  saved.local = answers;
  storage.set(`ts:${testId}`, saved);
  const changed = Object.entries(answers || {}).filter(([qid, v]) => v != null && v !== '' && saved.synced?.[qid] !== v);
  for (const [qid, v] of changed) {
    const q = questions.find((x) => String(x.questionId) === String(qid)) || { backendType: 'SHORT_ANSWER', options: [] };
    await http.patch(`/tests/sessions/${attemptId}/answer`, { questionId: qid, answer: toBackendAnswer(q, v), timeTakenSeconds: 0 });
    saved.synced = { ...(saved.synced || {}), [qid]: v };
    storage.set(`ts:${testId}`, saved);
  }
  return saved;
}

async function autosaveTest(id, { attemptId, answers }) {
  const saved = await syncAnswers(id, attemptId, answers);
  return { savedAt: new Date().toISOString(), remainingSec: saved.expiresAt ? Math.max(0, Math.round((new Date(saved.expiresAt).getTime() - Date.now()) / 1000)) : null };
}

async function submitTest(id, { attemptId, answers, timeUp }) {
  const saved = storage.get(`ts:${id}`, null);
  const expired = saved?.expiresAt && Date.now() > new Date(saved.expiresAt).getTime();
  if (!expired) {
    try { await syncAnswers(id, attemptId, answers); } catch { /* still submit what the server has */ }
  }
  try {
    await http.post(`/tests/sessions/${attemptId}/${expired || timeUp ? 'expire' : 'submit'}`, {});
  } catch (e) {
    // Expiry may be rejected if the server already finalised the session; fall through to the result.
    if (!(timeUp || expired)) throw e;
  }
  storage.remove(`ts:${id}`);
  return { attemptId, autoSubmitted: Boolean(timeUp || expired) };
}

async function testResult(attemptId) {
  const d = await http.get(`/tests/sessions/${attemptId}/result`);
  const r = d.result || d;
  // The result has no duration; the history row for this session has both timestamps.
  const hist = r.timeTakenSeconds == null && !d.session?.startedAt ? await http.get('/tests/history', { testId: r.testId, page: 1, limit: 50 }).catch(() => null) : null;
  const row = list(hist).find((h) => String(h.sessionId) === String(attemptId));
  const startedAt = r.startedAt || d.session?.startedAt || row?.startedAt;
  const t = d.test || {};
  const total = r.totalQuestions ?? 0;
  const correct = r.correctCount ?? 0;
  const incorrect = r.incorrectCount ?? 0;
  const skipped = r.unansweredQuestions ?? Math.max(0, total - correct - incorrect);
  const awards = awardedOf(d) || awardedOf(r) || await awardsFor(attemptId);
  const passed = r.passed;
  const scorePct = pct(r.percentage ?? 0);
  const bd = breakdownOf(d.breakdown || d.questions ? d : r);
  const acc = (x) => (x.total ? Math.round(((x.correct ?? 0) / x.total) * 100) : 0);
  const byChapter = (bd.chapters || []).map((c) => ({ chapterId: c.chapterId, name: c.name || 'Chapter', correct: c.correct ?? 0, total: c.total ?? 0, accuracy: acc(c) }));
  const byTopic = (bd.topics || []).map((t) => ({ topicId: t.topicId, name: t.name || 'Topic', correct: t.correct ?? 0, total: t.total ?? 0, accuracy: acc(t) }));
  const weakest = [...byTopic].filter((t) => t.total).sort((a, b) => a.accuracy - b.accuracy)[0];
  const rk = d.rank || r.rank || null;
  const summaryText = d.aiSummary || r.aiSummary || null;
  const questions = (d.questions || r.questions || []).map(serverReveal);
  return {
    attemptId, testId: r.testId, title: t.title || 'Test', seriesId: null,
    correct, incorrect, skipped, total,
    marks: r.obtainedMarks ?? 0, totalMarks: r.totalMarks ?? t.totalMarks ?? 0, passingMarks: t.passingMarks ?? null, passed,
    scorePct,
    accuracy: correct + incorrect ? Math.round((correct / (correct + incorrect)) * 100) : 0,
    timeTakenSec: r.timeTakenSeconds ?? (startedAt && r.submittedAt ? Math.round((new Date(r.submittedAt) - new Date(startedAt)) / 1000) : null),
    durationSec: t.durationSeconds ?? null,
    negativeMarks: Number(t.negativeMarksPerQuestion ?? 0), marksPerQ: total ? Math.round(((r.totalMarks || total) / total) * 100) / 100 : 1,
    byChapter, byTopic,
    rank: rk && rk.position != null ? { rank: rk.position, of: rk.outOf ?? null, percentile: rk.percentile ?? null } : null,
    rankAvailable: true,
    xpAwarded: awards.xp, isFirstAttempt: true,
    autoSubmitted: r.completionReason && r.completionReason !== 'SUBMITTED',
    mistakesSaved: incorrect,
    aiSummary: summaryText ? {
      lines: String(summaryText).split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean),
      nextStep: weakest && weakest.accuracy < 75 ? `Practise “${weakest.name}” to lift your score.` : 'Go through the solutions below, then try a practice set.',
    } : null,
    weakestTopicId: weakest && weakest.accuracy < 75 ? weakest.topicId : null,
    questions,
    submittedAt: r.submittedAt,
  };
}

async function getSeries(id) {
  const all = await listTests();
  const s = all.series.find((x) => String(x.id) === String(id));
  if (!s) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Series not found.', { status: 404 });
  return s;
}

/** Concurrent starts of the same test share one request, so a double tap never opens two sessions. */
const startsInFlight = new Map();
function startTestOnce(id) {
  if (!startsInFlight.has(id)) startsInFlight.set(id, startTest(id).finally(() => startsInFlight.delete(id)));
  return startsInFlight.get(id);
}

export const testApi = {
  list: listTests, get: getTestDetail, start: startTestOnce, autosave: autosaveTest, submit: submitTest, result: testResult, series: getSeries,
};

/* ================================================================== mistakes (/mistakes) */

const SOURCE_TO_UI = { DAILY_CHALLENGE: 'CHALLENGE', PRACTICE: 'PRACTICE', TEST: 'TEST', DOUBT: 'DOUBT' };
const SOURCE_TO_API = { CHALLENGE: 'DAILY_CHALLENGE', PRACTICE: 'PRACTICE', TEST: 'TEST' };

async function topicNameFor(topicId) {
  if (!topicId) return null;
  return (await getTopic(topicId).catch(() => null))?.name || null;
}

const isArchived = (m) => Boolean(m.isArchived ?? m.archived ?? m.archivedAt);

function mistakeItem(m, chapters) {
  const q = m.question || m.questionSnapshot || {};
  return {
    id: m._id,
    questionText: q.questionText || '',
    kind: 'QUESTION',
    topicId: q.topicId?._id || q.topicId || m.topicId?._id || m.topicId || null,
    topicName: m.topicName || m.topic?.name || q.topicName || null,
    chapterId: q.chapterId || m.chapterId || null,
    chapterName: chapters.get(String(q.chapterId || m.chapterId)) || null,
    status: isArchived(m) ? 'ARCHIVED' : String(m.status || 'ACTIVE').toUpperCase(),
    wrongCount: m.mistakeCount ?? 1,
    source: SOURCE_TO_UI[m.source] || m.source,
    sources: [SOURCE_TO_UI[m.source] || m.source],
    createdAt: m.firstMistakenAt || m.createdAt,
    lastAttemptAt: m.lastMistakenAt || m.updatedAt,
    nextReviewAt: m.nextReviewAt ? istDateKey(new Date(m.nextReviewAt)) : null, // the UI works in IST date keys
    reviewCount: m.reviewCount ?? (m.reviewedAt ? 1 : 0),
    reviewedAt: m.reviewedAt || null,
    due: !isArchived(m) && Boolean(m.dueToday ?? (m.nextReviewAt && new Date(m.nextReviewAt).getTime() <= Date.now() && String(m.status).toUpperCase() !== 'RESOLVED')),
    difficulty: q.difficulty || null,
  };
}

async function listMistakes(params = {}) {
  const classId = classIdOf();
  const base = { classId, page: 1, limit: 50 };
  const due = params.status === 'DUE' || params.due === true || params.due === 'true';
  const archived = params.status === 'ARCHIVED';
  const status = due ? 'ACTIVE' : params.status && !['ALL', 'DUE', 'ARCHIVED'].includes(params.status) ? params.status : undefined;
  const query = {
    ...base,
    status,
    dueOnly: due ? true : undefined,
    isArchived: archived ? true : undefined,
    search: params.q ? String(params.q).trim() : undefined,
    chapterId: params.chapterId,
    topicId: params.topicId,
    source: params.source ? SOURCE_TO_API[params.source] || params.source : undefined,
    sort: params.sort === 'REPEATED' ? 'frequent' : 'newest',
  };
  const count = (st, extra = {}) => http.get('/mistakes', { ...base, limit: 1, status: st, ...extra }).then(pageInfo).then((p) => p.total).catch(() => null);
  const [data, chapters, all, active, dueTotal, reviewed, resolved, archivedTotal] = await Promise.all([
    http.get('/mistakes', query), chapterNameMap(classId), count(undefined), count('ACTIVE'), count('ACTIVE', { dueOnly: true }), count('REVIEWED'), count('RESOLVED'), count(undefined, { isArchived: true }),
  ]);
  const items = list(data).map((m) => mistakeItem(m, chapters));
  const chapterList = [...chapters.entries()].map(([id, name]) => ({ id, name }));
  return {
    items,
    counts: { ALL: all, DUE: dueTotal, ACTIVE: active, REVIEWED: reviewed, RESOLVED: resolved, ARCHIVED: archivedTotal },
    dueToday: dueTotal,
    chapters: chapterList,
    total: pageInfo(data).total,
  };
}

async function mistakeDetail(id) {
  const d = await http.get(`/mistakes/${id}`);
  const m = d.mistake || d;
  const chapters = await chapterNameMap(classIdOf());
  const item = mistakeItem(m, chapters);
  const rawQ = m.question || m.questionSnapshot || {};
  const uiQ = toUiQuestion(rawQ);
  const submitted = m.yourAnswer ?? m.submittedAnswer ?? m.latestSelectedAnswer;
  const yourAnswer = fromBackendAnswer(uiQ, submitted);
  const correct = m.correctAnswer ?? rawQ.correctAnswer;
  const reveal = toReveal(uiQ, { yourAnswer, isCorrect: false, correctAnswer: correct, explanation: m.explanation ?? rawQ.explanation });
  return {
    ...item,
    topicName: item.topicName || await topicNameFor(item.topicId),
    question: { text: uiQ.questionText, imageUrl: uiQ.questionImageUrl, type: uiQ.type, backendType: uiQ.backendType, options: uiQ.options, difficulty: uiQ.difficulty },
    uiQuestion: uiQ,
    yourAnswer,
    yourAnswerLabel: reveal.yourAnswerLabel,
    correctAnswer: reveal.correctAnswer,
    correctAnswerLabel: reveal.correctAnswerLabel,
    explanation: reveal.explanation,
    conceptNote: null,
    aiConcept: null,
    attempts: Array.isArray(m.attempts) && m.attempts.length
      ? m.attempts.map((a) => ({ answer: a.answer, label: answerLabel(uiQ, fromBackendAnswer(uiQ, a.answer)), correct: Boolean(a.isCorrect), at: a.at || a.createdAt, source: SOURCE_TO_UI[a.source] || a.source || item.source }))
      : submitted != null ? [{ answer: submitted, label: reveal.yourAnswerLabel, at: m.lastMistakenAt, source: item.source }] : [],
    resolvedAt: m.resolvedAt || null,
  };
}

const mistakeAction = (action) => async (id) => {
  await http.patch(`/mistakes/${id}/${action}`, {});
  return mistakeDetail(id);
};

/** POST /mistakes/:id/retry — graded; resolves the mistake only when the answer is correct (F8-06). */
async function retryMistake(id, { answer }) {
  const current = await mistakeDetail(id);
  const r = await http.post(`/mistakes/${id}/retry`, { answer: toBackendAnswer(current.uiQuestion, answer) });
  const mistake = await mistakeDetail(id);
  return { correct: Boolean(r.isCorrect), xpAwarded: awardedOf(r)?.xp || 0, mistake };
}

async function archiveMistake(id, archive = true) {
  await http.post(`/mistakes/${id}/${archive ? 'archive' : 'unarchive'}`, {});
  return mistakeDetail(id);
}

async function practiceMore(id) {
  const m = await mistakeDetail(id);
  if (!m.topicId) throw new ApiError(ERROR_CODES.VALIDATION, 'This mistake has no topic linked yet.');
  return practiceStart({ scope: 'TOPIC', targetId: m.topicId, size: 5, maxDifficulty: m.difficulty, title: `More like this${m.topicName ? `: ${m.topicName}` : ''}` });
}

export const mistakeApi = {
  list: listMistakes,
  get: mistakeDetail,
  review: mistakeAction('review'),
  resolve: mistakeAction('resolve'),
  reopen: mistakeAction('reopen'),
  practiceMore,
  retry: retryMistake,
  archive: archiveMistake,
  simpler: (id) => http.post(`/mistakes/${id}/simpler-explanation`, {}, { ai: true }),
  // simpler: the backend's AI provider has this switched off (503), so the button stays hidden.
  capabilities: { retry: true, archive: true, simpler: false, review: true, resolve: false, reopen: true, search: 'server', dueDates: true },
  statuses: ['DUE', 'ACTIVE', 'REVIEWED', 'RESOLVED', 'ARCHIVED', 'ALL'],
};

/* ================================================================== progress, leaderboard, rewards */

async function getProgress() {
  const classId = classIdOf();
  const [s, topics, rewards, lb, curriculum] = await Promise.all([
    http.get('/progress/summary'),
    topicProgressMap(),
    http.get('/rewards/summary').catch(() => null),
    http.get('/leaderboard', { period: 'week', page: 1, limit: 1 }).catch(() => null),
    classTopics(classId).catch(() => ({ chapters: [], byId: new Map() })),
  ]);
  const a = s.activity || {};
  const l = s.learning || {};
  const o = s.overall || {};
  const p = s.performance || {};
  const m = s.mistakes || {};
  const g = mapSummary(rewards || s.gamification || {}, {});
  const totalTopics = curriculum.chapters.reduce((n, c) => n + c.topics.length, 0);
  const topicName = (t) => t?.name || t?.topicName || curriculum.byId.get(String(t?.topicId || t?._id || t))?.name || 'Topic';
  const topicRef = (t) => ({
    topicId: String(t?.topicId || t?._id || t),
    name: topicName(t),
    mastery: t?.masteryScore ?? t?.mastery ?? null,
    accuracy: t?.accuracy != null ? pct(t.accuracy) : null,
    activeMistakes: t?.activeMistakes ?? 0,
  });
  return {
    activity: {
      week: (a.strip || []).map((d) => ({ date: d.date, active: Boolean(d.active), challenge: Boolean(d.challengeCompleted), questions: d.questionsAnswered ?? 0 })),
      activeDaysWeek: a.activeDaysLast7 ?? 0,
      activeDaysMonth: a.activeDaysThisMonth ?? 0,
      currentStreak: g.currentStreak,
      longestStreak: g.longestStreak,
      timeSpentSec: a.timeSpentSeconds ?? 0,
    },
    learning: {
      chaptersOpened: l.chaptersOpened ?? 0,
      totalChapters: curriculum.chapters.length,
      topicsStudied: l.topicsStudied ?? 0,
      topicsCompleted: l.topicsCompleted ?? null,
      materialViews: l.materialViewed ?? 0,
      syllabusTouchedPct: pct(l.syllabusTouchedPercent ?? 0),
      totalTopics,
    },
    performance: {
      accuracyOverall: o.attempts ? pct(o.accuracy) : null,
      trend: (p.accuracyTrend || []).map((w, i) => ({
        week: w.weekStart ? formatDate(`${w.weekStart}T12:00:00+05:30`, { day: 'numeric', month: 'short' }) : formatDate(`${addDays(istDateKey(), (i - 3) * 7)}T12:00:00+05:30`, { day: 'numeric', month: 'short' }),
        accuracy: w.accuracy != null ? pct(w.accuracy) : null,
        questions: w.attempts ?? 0,
      })),
      strong: (p.strongTopics || []).map(topicRef),
      weak: (p.weakTopics || []).map(topicRef),
      avgTimePerQuestionSec: o.attempts ? Math.round(o.averageTimePerQuestionSeconds ?? 0) : null,
      testsAttempted: o.testsAttempted ?? 0,
      testsAvgScorePct: o.testsAttempted ? pct(o.averageTestScore) : null,
      questionsAttempted: o.attempts ?? 0,
    },
    mistakes: {
      total: m.total ?? 0,
      active: m.active ?? 0,
      resolved: m.resolved ?? 0,
      resolutionRate: m.total ? pct(m.resolutionRate) : null,
      mostRepeatedTopic: m.mostRepeatedTopic ? { topicId: m.mostRepeatedTopic.topicId, name: topicName(m.mostRepeatedTopic), count: m.mostRepeatedTopic.count ?? m.mostRepeatedTopic.mistakeCount ?? null } : null,
    },
    gamification: {
      totalXp: g.totalXp, level: g.level, levelProgress: g.levelProgress, xpToNextLevel: g.xpToNextLevel,
      currentStreak: g.currentStreak, goldCoins: g.goldCoins, rank: (lb?.me || lb?.currentUser)?.rank ?? null, classSize: lb?.pagination?.total ?? null,
      recentRewards: [],
    },
    mastery: curriculum.chapters.map(({ ch, topics: ts }, i) => ({
      chapterId: ch._id, name: ch.name, number: ch.chapterNumber ?? i + 1,
      topics: ts.map((t) => {
        const tp = topics.get(String(t._id)) || {};
        return { topicId: t._id, name: t.name, mastery: tp.mastery ?? null, attempts: tp.attempts || 0, accuracy: tp.accuracy ?? null };
      }),
    })),
    weights: null,
  };
}

async function getLeaderboard(period) {
  const apiPeriod = period === 'ALL_TIME' ? 'all-time' : 'week';
  const d = await http.get('/leaderboard', { period: apiPeriod, page: 1, limit: 20 });
  const user = me();
  const mine = d.me || d.currentUser || {};
  const top = list(d).map((r, i) => ({
    id: r.userId || `${r.rank}-${i}`,
    rank: r.rank ?? i + 1,
    displayName: r.displayName || 'Student',
    avatarId: r.avatarId || r.avatar || null,
    xp: r.xp ?? 0,
    streak: r.streak ?? 0,
    isMe: Boolean(r.isMe ?? r.isCurrentUser) || (mine.rank != null && r.rank === mine.rank),
  }));
  return {
    period,
    top,
    me: mine.rank != null ? { rank: mine.rank, xp: mine.xp ?? 0, streak: mine.streak ?? null, displayName: mine.displayName || user.displayName || user.name, avatarId: mine.avatarId || user.profile?.avatarId } : null,
    totalStudents: pageInfo(d).total,
    updatedAt: new Date().toISOString(),
    resetsAt: null,
  };
}

async function getRewards() {
  const [s, coins, xp, rules] = await Promise.all([
    http.get('/rewards/summary'),
    http.get('/rewards/coins/history', { page: 1, limit: 50 }),
    http.get('/rewards/xp/history', { page: 1, limit: 50 }),
    http.get('/rewards/how-to-earn').catch(() => null),
  ]);
  const g = mapSummary(s);
  const goals = g.dailyGoals;
  return {
    goldCoins: g.goldCoins,
    totalXp: g.totalXp,
    level: g.level,
    levelProgress: g.levelProgress,
    xpToNextLevel: g.xpToNextLevel,
    ledger: list(coins).map((e) => ({ id: e._id, label: e.description || e.source, awardedAt: e.createdAt, balanceAfter: e.balanceAfter, amount: e.amount })),
    xpHistory: list(xp).map((e) => ({ id: e._id, label: e.description || e.source, at: e.createdAt, amount: e.amount })),
    dailyGoals: goals,
    today: { challenge: Boolean(goals.find((x) => x.key === 'DAILY_CHALLENGE')?.completed), doubt: Boolean(goals.find((x) => x.key === 'DOUBT')?.completed) },
    rules: {
      xpList: (rules?.xp || []).map((r) => ({ label: r.description || r.source, amount: r.amount, source: r.source })),
      coinList: (rules?.coins || []).map((r) => ({ label: r.description || r.source, amount: r.amount, frequency: r.frequency, source: r.source })),
    },
    referral: { enabled: false },
    streak: { current: g.currentStreak, longest: g.longestStreak },
  };
}

const PARENT_DELIVERY_KEY = 'rv:parent-delivery';
const topicNames = (xs) => (xs || []).map((t) => (typeof t === 'string' ? t : t?.name)).filter(Boolean);
const mapGlance = (g = {}) => ({
  daysActive: g.daysActive ?? 0, challengesDone: g.challengesDone ?? 0, testsTaken: g.testsTaken ?? 0,
  accuracy: g.accuracy ?? null, accuracyChange: g.accuracyChange ?? null,
});

async function parentReportPreview() {
  const r = await http.get('/profile/parent-report/preview');
  return {
    live: true,
    weekStart: r.weekStart, weekEnd: r.weekEnd, atAGlance: mapGlance(r.atAGlance),
    strongTopics: topicNames(r.strongTopics), focusTopics: topicNames(r.focusTopics),
    sentTo: r.sentTo || null, nextSendAt: r.nextSendAt || null,
    lastDeliveryId: storage.get(PARENT_DELIVERY_KEY, null),
  };
}

async function deliverParentReport({ retry = false } = {}) {
  const r = await http.post('/profile/parent-report/deliver', retry ? { retry: true } : {});
  if (r?.deliveryId) storage.set(PARENT_DELIVERY_KEY, r.deliveryId);
  return { status: String(r?.status || 'UNKNOWN').toUpperCase(), reason: r?.reason || null, deliveryId: r?.deliveryId || null, duplicate: Boolean(r?.duplicate), expiresAt: r?.expiresAt || null };
}

async function revokeParentReport(deliveryId) {
  await http.post('/profile/parent-report/revoke', { deliveryId });
  storage.remove(PARENT_DELIVERY_KEY);
  return { revoked: true };
}

/** Public: authorised only by the signed token in the parent's email; no bearer token is sent. */
async function parentReportView(token) {
  const d = await http.get('/parent-report/view', { token }, { auth: false, skipAuthRedirect: true });
  const r = d.report || {};
  return {
    studentName: d.student?.displayName || 'Your child',
    weekStart: d.weekStart, weekEnd: d.weekEnd, expiresAt: d.expiresAt || null,
    atAGlance: mapGlance(r.atAGlance), strongTopics: topicNames(r.strongTopics), focusTopics: topicNames(r.focusTopics),
  };
}

export const progressApi = {
  get: getProgress, leaderboard: getLeaderboard, rewards: getRewards,
  parentReport: parentReportPreview, deliverParentReport, revokeParentReport, parentReportView,
};

/* ================================================================== account (/profile) */

const SETTING_KEYS = ['reminders', 'reminderTime', 'sound', 'parentReport'];

async function updateSettings(body) {
  const patch = {};
  if (body.name) patch.displayName = body.name.trim();
  if (body.avatarId !== undefined) patch.avatarId = body.avatarId || null;
  const settings = Object.fromEntries(SETTING_KEYS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
  if (settings.reminderTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.reminderTime)) throw new ApiError(ERROR_CODES.VALIDATION, 'Choose a valid time.');
  await Promise.all([
    Object.keys(patch).length ? http.patch('/profile', patch) : null,
    Object.keys(settings).length ? http.patch('/profile/settings', settings) : null,
  ]);
  return loadAppUser();
}

const REPORT_REASONS = ['WRONG_ANSWER', 'UNCLEAR', 'NOT_IN_SYLLABUS', 'OTHER'];
async function reportQuestion({ questionId, reason, note }) {
  if (!questionId) throw new ApiError(ERROR_CODES.VALIDATION, 'This question cannot be reported.');
  const r = await http.post(`/questions/${encodeURIComponent(questionId)}/report`, {
    reason: REPORT_REASONS.includes(reason) ? reason : 'OTHER',
    note: note ? String(note).trim().slice(0, 500) : undefined,
  });
  return { reported: true, reportId: r?.reportId || null };
}

/** F1-08: class change via the onboarding endpoint (history is kept per class on the server). */
async function changeClass(classId) {
  await http.put('/profile/onboarding', { classId });
  return loadAppUser();
}

const exportData = () => http.get('/profile/export');

async function deleteAccount(confirm) {
  if (confirm !== 'DELETE') throw new ApiError(ERROR_CODES.VALIDATION, 'Type DELETE to confirm.');
  await http.del('/profile');
  return { deleted: true, hardDeleteAfter: addDays(istDateKey(), 30), parentNotified: true };
}

export const accountApi = {
  updateSettings, changeClass, exportData, deleteAccount,
  reportQuestion,
  canReportQuestion: true,
  supportsReminders: true,
};

export { doubtApi };

export { explanationSteps };
