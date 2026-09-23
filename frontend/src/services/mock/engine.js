/**
 * Server-side business rules, simulated. In production every function here runs in the backend
 * ("the server owns truth", section 2.1). The client never computes balances, scores or streaks.
 */
import { istDateKey, addDays, weekStartKey } from '@/lib/date';
import { seeded, uid as makeId } from '@/lib/random';
import { levelFromXp } from '@/lib/format';
import { getDb, userState } from './db';
import { questionsForTopic, findGeneratedQuestion, isCorrect } from './content/questionBank';
import { getTopic, getChapter, allTopics, CURRICULUM } from './content/curriculum';
import { TEST_CATALOG } from './content/tests';

export const cfg = () => getDb().admin.config;
export const today = () => istDateKey();
const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ questions */

export function getQuestion(questionId) {
  const d = getDb();
  const custom = d.admin.customQuestions.find((q) => q.questionId === questionId);
  if (custom) return custom;
  const base = findGeneratedQuestion(questionId);
  if (!base) return null;
  const ov = d.admin.questionOverrides[questionId];
  return ov ? { ...base, ...ov } : base;
}

export function allQuestionsForTopic(topicId) {
  const d = getDb();
  const base = questionsForTopic(topicId).map((q) => {
    const ov = d.admin.questionOverrides[q.questionId];
    return ov ? { ...q, ...ov } : q;
  });
  return [...base, ...d.admin.customQuestions.filter((q) => q.topicId === topicId)];
}

/** Only APPROVED questions are ever served (section 9.1). */
export const servable = (topicId) => allQuestionsForTopic(topicId).filter((q) => q.status === 'APPROVED');

/* ------------------------------------------------------------------ curriculum (with admin overrides) */

export function curriculumFor(classId, { includeUnpublished = false } = {}) {
  const d = getDb();
  const ov = d.admin.curriculumOverrides;
  const base = (CURRICULUM[classId] || []).map((ch) => ({
    ...ch,
    ...(ov[ch.id] || {}),
    topics: ch.topics.map((t) => ({ ...t, ...(ov[t.id] || {}) }))
      .concat((ov[ch.id]?.extraTopics) || []),
  }));
  const custom = d.admin.customChapters[classId] || [];
  const list = [...base, ...custom]
    .map((ch, i) => ({ ...ch, order: ch.order ?? i + 1 }))
    .sort((a, b) => a.order - b.order);
  if (includeUnpublished) return list;
  return list
    .filter((ch) => ch.status === 'PUBLISHED')
    .map((ch) => ({ ...ch, topics: ch.topics.filter((t) => t.status === 'PUBLISHED').sort((a, b) => (a.order ?? a.number) - (b.order ?? b.number)) }));
}

export function topicMeta(topicId) {
  const t = getTopic(topicId);
  if (t) {
    const ov = getDb().admin.curriculumOverrides[topicId];
    return ov ? { ...t, ...ov } : t;
  }
  const d = getDb();
  for (const chapters of Object.values(d.admin.customChapters)) {
    for (const ch of chapters) {
      const found = ch.topics.find((x) => x.id === topicId);
      if (found) return { ...found, chapterName: ch.name };
    }
  }
  for (const o of Object.values(d.admin.curriculumOverrides)) {
    const found = (o.extraTopics || []).find((x) => x.id === topicId);
    if (found) return { ...found, chapterName: getChapter(found.chapterId)?.name };
  }
  return null;
}

/* ------------------------------------------------------------------ activity */

export function pushActivity(uid, entry, at = nowIso()) {
  const st = userState(uid);
  st.activity.unshift({ id: makeId('act_'), at, ...entry });
  st.activity = st.activity.slice(0, 60);
}

/* ------------------------------------------------------------------ attempts & mistakes */

function snapshot(q) {
  return {
    text: q.questionText,
    imageUrl: q.questionImageUrl || null,
    type: q.type,
    options: q.options,
    correctAnswer: q.correctAnswer,
    answerTolerance: q.answerTolerance,
    explanation: q.explanation,
    conceptNote: q.conceptNote || null,
    difficulty: q.difficulty,
  };
}

export function upsertMistake(uid, q, answer, source, { at = nowIso(), date = today() } = {}) {
  const st = userState(uid);
  const id = `${uid}_${q.questionId}`;
  const nextReviewAt = addDays(date, cfg().reviewCycleDays);
  const existing = st.mistakes[id];
  if (existing) {
    existing.wrongCount += 1;
    existing.attempts.push({ answer, at, source });
    if (existing.status !== 'ACTIVE') {
      existing.status = 'ACTIVE';
      existing.resolvedAt = null;
    }
    existing.nextReviewAt = nextReviewAt;
    existing.lastAttemptAt = at;
    return existing;
  }
  const m = {
    id,
    uid,
    questionId: q.questionId,
    topicId: q.topicId,
    chapterId: q.chapterId,
    classId: q.classId,
    kind: q.kind || 'QUESTION',
    questionSnapshot: snapshot(q),
    attempts: [{ answer, at, source }],
    wrongCount: 1,
    aiConcept: null,
    status: 'ACTIVE',
    source,
    nextReviewAt,
    reviewCount: 0,
    createdAt: at,
    lastAttemptAt: at,
    resolvedAt: null,
    schemaVersion: 1,
  };
  st.mistakes[id] = m;
  return m;
}

/**
 * Every attempt from every surface is recorded, and every wrong answer writes to the Mistake Bank
 * in the same "transaction" (F4-06, F5-09, section 13 absolute capture rule).
 */
export function recordAttempt(uid, q, answer, source, { timeSpentSec = 0, refId = null, at = nowIso(), date = today() } = {}) {
  const st = userState(uid);
  const correct = isCorrect(q, answer);
  st.attempts.push({
    id: makeId('att_'),
    questionId: q.questionId,
    topicId: q.topicId,
    chapterId: q.chapterId,
    classId: q.classId,
    answer,
    correct,
    timeSpentSec: Math.round(timeSpentSec || 0),
    source,
    refId,
    at,
    date,
  });
  if (!correct) upsertMistake(uid, q, answer, source, { at, date });
  st.recommendation = null; // invalidate on every submission (F9-08)
  return correct;
}

export const dueMistakes = (uid, classId) => Object.values(userState(uid).mistakes)
  .filter((m) => m.status === 'ACTIVE' && m.classId === classId && m.nextReviewAt <= today());

/* ------------------------------------------------------------------ XP & coins (idempotent ledgers) */

export function awardXp(uid, { type, amount, eventId, capKey = null, cap = null, label, at = nowIso(), date = today() }) {
  const st = userState(uid);
  if (st.xpLedger.some((e) => e.id === eventId)) return 0; // idempotent per event id (F10-03)
  let grant = amount;
  if (capKey && cap != null) {
    st.xpDaily[date] = st.xpDaily[date] || {};
    const used = st.xpDaily[date][capKey] || 0;
    grant = Math.max(0, Math.min(amount, cap - used));
    st.xpDaily[date][capKey] = used + grant;
  }
  if (grant <= 0) return 0;
  st.xpLedger.push({ id: eventId, type, amount: grant, label, at, date });
  return grant;
}

export const totalXp = (uid) => userState(uid).xpLedger.reduce((s, e) => s + e.amount, 0);
export const coinBalance = (uid) => userState(uid).coinLedger
  .filter((e) => e.currency === 'GOLD_COIN').reduce((s, e) => s + e.amount, 0);

/** Deterministic ledger id {uid}_{YYYY-MM-DD}_{TYPE} makes duplicates impossible (F10-06). */
export function awardCoins(uid, { type, amount, sourceEventId, label, at = nowIso(), date = today() }) {
  const st = userState(uid);
  const id = `${uid}_${date}_${type}`;
  const existing = st.coinLedger.find((e) => e.id === id);
  if (existing) return { awarded: false, entry: existing };
  const entry = {
    id, uid, type, label, currency: 'GOLD_COIN', amount,
    balanceAfter: coinBalance(uid) + amount, sourceEventId, ruleVersion: cfg().version,
    awardedAt: at, serverDate: date,
  };
  st.coinLedger.push(entry);
  return { awarded: true, entry };
}

/** Optional same-day bonus when both qualifying activities happen on one day (config-driven, off by default). */
export function maybeBothBonus(uid, date = today()) {
  const c = cfg().coins;
  if (!c.BOTH_BONUS.enabled) return null;
  const st = userState(uid);
  const has = (t) => st.coinLedger.some((e) => e.id === `${uid}_${date}_${t}`);
  if (has('DAILY_CHALLENGE') && has('DOUBT_SOLVED')) {
    const r = awardCoins(uid, { type: 'BOTH_BONUS', amount: c.BOTH_BONUS.amount, sourceEventId: `both_${date}`, label: 'Same-day double bonus', date });
    return r.awarded ? r.entry : null;
  }
  return null;
}

/* ------------------------------------------------------------------ streak (server day boundary) */

export function effectiveStreak(uid) {
  const s = userState(uid).streak;
  const t = today();
  const alive = s.lastDate === t || s.lastDate === addDays(t, -1);
  return { current: alive ? s.current : 0, longest: s.longest, lastDate: s.lastDate };
}

export function extendStreak(uid, date = today()) {
  const st = userState(uid);
  const s = st.streak;
  if (s.lastDate === date) return { current: s.current, extended: false, milestoneXp: 0 };
  s.current = s.lastDate === addDays(date, -1) ? s.current + 1 : 1;
  s.longest = Math.max(s.longest, s.current);
  s.lastDate = date;
  const bonus = cfg().xp.STREAK_MILESTONES[s.current] || 0;
  let milestoneXp = 0;
  if (bonus) {
    milestoneXp = awardXp(uid, { type: 'STREAK_MILESTONE', amount: bonus, eventId: `xp_streak_${s.current}_${date}`, label: `${s.current}-day streak milestone`, date });
  }
  return { current: s.current, extended: true, milestoneXp };
}

/* ------------------------------------------------------------------ topic stats & mastery (F9) */

export function topicStats(uid, classId) {
  const st = userState(uid);
  const map = {};
  st.attempts.filter((a) => a.classId === classId).forEach((a) => {
    const t = map[a.topicId] || (map[a.topicId] = {
      topicId: a.topicId, chapterId: a.chapterId, attempts: 0, correct: 0, results: [], totalTime: 0,
      mistakesCreated: 0, mistakesResolved: 0, activeMistakes: 0, lastAttemptAt: null,
    });
    t.attempts += 1;
    if (a.correct) t.correct += 1;
    t.results.push(a.correct);
    t.totalTime += a.timeSpentSec || 0;
    t.lastAttemptAt = a.at;
  });
  Object.values(st.mistakes).filter((m) => m.classId === classId).forEach((m) => {
    const t = map[m.topicId];
    if (!t) return;
    t.mistakesCreated += 1;
    if (m.status === 'RESOLVED') t.mistakesResolved += 1;
    if (m.status === 'ACTIVE') t.activeMistakes += 1;
  });
  const w = cfg().mastery;
  Object.values(map).forEach((t) => {
    const last20 = t.results.slice(-20);
    const last5 = t.results.slice(-5);
    const acc = last20.filter(Boolean).length / last20.length;
    let ws = 0;
    let wt = 0;
    last5.forEach((r, i) => { ws += (i + 1) * (r ? 1 : 0); wt += i + 1; });
    const recency = wt ? ws / wt : 0;
    const resolution = t.mistakesCreated ? t.mistakesResolved / t.mistakesCreated : 1;
    t.accuracy = Math.round((t.correct / t.attempts) * 100);
    t.last5 = last5;
    t.avgTimeSec = Math.round(t.totalTime / t.attempts);
    t.mastery = t.attempts >= w.minAttempts
      ? Math.round(100 * (w.accuracy * acc + w.recency * recency + w.mistakeResolution * resolution))
      : null;
    t.name = topicMeta(t.topicId)?.name || t.topicId;
    t.chapterName = topicMeta(t.topicId)?.chapterName || '';
    delete t.results;
  });
  return map;
}

export function strongWeak(uid, classId) {
  const stats = Object.values(topicStats(uid, classId)).filter((t) => t.mastery != null);
  const strong = [...stats].filter((t) => t.mastery >= 60).sort((a, b) => b.mastery - a.mastery).slice(0, 3);
  const weak = [...stats].filter((t) => t.mastery < 75 && !strong.includes(t))
    .sort((a, b) => a.mastery - b.mastery || b.activeMistakes - a.activeMistakes).slice(0, 3);
  return { strong, weak };
}

/* ------------------------------------------------------------------ recommendation (closed action set, F9-07/08) */

export function recommendation(uid, classId) {
  const st = userState(uid);
  const fresh = st.recommendation && Date.now() - new Date(st.recommendation.generatedAt).getTime() < 24 * 3600 * 1000;
  if (fresh && st.recommendation.classId === classId) return st.recommendation;

  const stats = topicStats(uid, classId);
  const { weak } = strongWeak(uid, classId);
  const challenge = st.challenges[today()];
  const byMistakes = Object.values(stats).filter((t) => t.activeMistakes >= 3).sort((a, b) => b.activeMistakes - a.activeMistakes);
  let rec;
  if (byMistakes.length) {
    const t = byMistakes[0];
    rec = { action: 'REVIEW_MISTAKES', targetId: t.topicId, reason: `You have ${t.activeMistakes} unresolved mistakes in ${t.name}. Fixing them is the fastest way to improve.`, ctaLabel: `Review ${t.name} mistakes` };
  } else if (weak[0] && !st.studied[weak[0].topicId]) {
    rec = { action: 'READ_MATERIAL', targetId: weak[0].topicId, reason: `A quick read of ${weak[0].name} will make practice much easier.`, ctaLabel: `Read ${weak[0].name}` };
  } else if (weak[0]) {
    rec = { action: 'PRACTICE_TOPIC', targetId: weak[0].topicId, reason: `Focus next on ${weak[0].name} — 10 questions will lift your mastery.`, ctaLabel: `Practise ${weak[0].name}` };
  } else if (!challenge || challenge.status !== 'SUBMITTED') {
    rec = { action: 'CONTINUE_CHALLENGE', targetId: `${uid}_${today()}`, reason: 'Your Daily Challenge is waiting — 5 questions keep your streak alive.', ctaLabel: "Start today's challenge" };
  } else {
    const first = allTopics(classId)[0];
    rec = { action: 'PRACTICE_TOPIC', targetId: first?.id, reason: `Great work today! Explore ${first?.name} to widen your coverage.`, ctaLabel: `Practise ${first?.name}` };
  }
  st.recommendation = { ...rec, classId, generatedAt: nowIso(), source: 'AI' };
  return st.recommendation;
}

/* ------------------------------------------------------------------ leaderboard (precomputed slice, F10-14..16) */

const NAMES = ['Aarav K.', 'Ananya S.', 'Vihaan R.', 'Diya P.', 'Arjun M.', 'Ishita G.', 'Reyansh T.', 'Saanvi B.', 'Kabir N.', 'Myra J.',
  'Advik D.', 'Kiara V.', 'Aditya L.', 'Anika C.', 'Rudra H.', 'Pari A.', 'Shaurya Y.', 'Navya F.', 'Atharv O.', 'Aadhya W.',
  'Krish E.', 'Sara Q.', 'Dhruv U.', 'Riya I.', 'Ayaan Z.', 'Meera X.', 'Vivaan K.', 'Tara S.', 'Arnav P.', 'Zara M.',
  'Ishaan R.', 'Avni T.', 'Yash B.', 'Kavya N.', 'Om J.', 'Siya D.', 'Parth V.', 'Nisha L.', 'Laksh C.', 'Aarohi H.'];
const AV = ['fox', 'owl', 'panda', 'tiger', 'robot', 'rocket', 'unicorn', 'dino', 'astronaut', 'star', 'koala', 'octopus'];

export function leaderboard(uid, classId, period = 'WEEKLY') {
  const r = seeded(`lb:${classId}:${period}:${weekStartKey()}`);
  const peers = NAMES.map((name, i) => {
    const weekly = r.int(40, 780);
    return {
      id: `peer_${i}`, displayName: name, avatarId: AV[i % AV.length],
      xp: period === 'WEEKLY' ? weekly : weekly * r.int(6, 14), streak: r.int(0, 24), attempts: r.int(20, 400), registeredAt: 1700000000000 + i * 1e7,
    };
  });
  const st = userState(uid);
  const user = getDb().users[uid];
  const since = weekStartKey();
  const myXp = period === 'WEEKLY'
    ? st.xpLedger.filter((e) => e.date >= since).reduce((s, e) => s + e.amount, 0)
    : totalXp(uid);
  const me = {
    id: uid, displayName: user.displayName, avatarId: user.profile?.avatarId || 'owl', xp: myXp,
    streak: effectiveStreak(uid).current, attempts: st.attempts.length, registeredAt: new Date(user.createdAt).getTime(), isMe: true,
  };
  const all = [...peers, me].sort((a, b) => b.xp - a.xp || b.streak - a.streak || a.attempts - b.attempts || a.registeredAt - b.registeredAt)
    .map((row, i) => ({ ...row, rank: i + 1 }));
  const mine = all.find((x) => x.isMe);
  return {
    period, classId, updatedAt: new Date(Math.floor(Date.now() / 900000) * 900000).toISOString(),
    resetsAt: `${addDays(since, 7)}T00:00:00+05:30`,
    top: all.slice(0, 20).map(({ attempts: _a, registeredAt: _r, ...rest }) => rest),
    me: mine ? { rank: mine.rank, xp: mine.xp, streak: mine.streak, displayName: mine.displayName, avatarId: mine.avatarId } : null,
    totalStudents: all.length,
  };
}

/* ------------------------------------------------------------------ summary (users/{uid}/summary/current) */

export function summary(uid) {
  const user = getDb().users[uid];
  const classId = user.profile.classId;
  const st = userState(uid);
  const xp = totalXp(uid);
  const lvl = levelFromXp(xp);
  const streak = effectiveStreak(uid);
  const ms = Object.values(st.mistakes).filter((m) => m.classId === classId);
  const attempts = st.attempts.filter((a) => a.classId === classId);
  const last7 = attempts.filter((a) => a.date >= addDays(today(), -6));
  const acc = (list) => (list.length ? Math.round((list.filter((a) => a.correct).length / list.length) * 100) : null);
  const { strong, weak } = strongWeak(uid, classId);
  return {
    totalXp: xp,
    level: lvl.level,
    levelProgress: lvl.progress,
    xpToNextLevel: lvl.levelSize - lvl.intoLevel,
    goldCoins: coinBalance(uid),
    referralPoints: 0,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    lastChallengeDate: streak.lastDate,
    mistakes: {
      total: ms.length,
      active: ms.filter((m) => m.status === 'ACTIVE').length,
      resolved: ms.filter((m) => m.status === 'RESOLVED').length,
      dueForReviewToday: dueMistakes(uid, classId).length,
    },
    accuracyOverall: acc(attempts),
    accuracyLast7d: acc(last7),
    strongTopics: strong.map((t) => t.topicId),
    weakTopics: weak.map((t) => t.topicId),
    rank: { classWeekly: leaderboard(uid, classId).me?.rank ?? null, updatedAt: nowIso() },
    recommendation: recommendation(uid, classId),
  };
}

export const testCatalog = () => {
  const d = getDb();
  const tests = [...TEST_CATALOG.tests.map((t) => ({ ...t, ...(d.admin.testOverrides[t.id] || {}) })), ...d.admin.customTests];
  const series = [...TEST_CATALOG.series.map((s) => ({ ...s, ...(d.admin.seriesOverrides[s.id] || {}) })), ...d.admin.customSeries];
  return { tests, series };
};

export const chapterOf = (topicId) => getChapter(topicMeta(topicId)?.chapterId);
