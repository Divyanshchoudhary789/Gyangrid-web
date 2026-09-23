import { ApiError, ERROR_CODES } from '../../errors';
import { userState } from '../db';
import { seeded, uid as makeId } from '@/lib/random';
import { addDays } from '@/lib/date';
import {
  cfg, today, getQuestion, servable, curriculumFor, topicMeta, topicStats, strongWeak, recordAttempt,
  awardXp, awardCoins, extendStreak, pushActivity, testCatalog, effectiveStreak, maybeBothBonus,
} from '../engine';
import { toPublicQuestion, isCorrect, answerLabel } from '../content/questionBank';
import { cohortScores } from '../content/tests';
import { explainMistake, reExplain, testSummary } from '../ai';
import { assertOwnClass } from './learning';

const nowIso = () => new Date().toISOString();
const reveal = (q, answer) => ({
  ...toPublicQuestion(q),
  correctAnswer: q.correctAnswer,
  answerTolerance: q.answerTolerance,
  explanation: q.explanation,
  conceptNote: q.conceptNote,
  yourAnswer: answer ?? null,
  yourAnswerLabel: answerLabel(q, answer),
  correctAnswerLabel: answerLabel(q, q.correctAnswer),
  correct: isCorrect(q, answer),
  skipped: answer == null || answer === '',
});

const classTopics = (classId) => curriculumFor(classId).flatMap((ch) => ch.topics.map((t) => t.id));

function diagnosisFor(uid, classId, topicIds) {
  const stats = topicStats(uid, classId);
  const st = userState(uid);
  return [...new Set(topicIds)].map((topicId) => {
    const recent = st.attempts.filter((a) => a.topicId === topicId).slice(-10);
    const acc = recent.length ? Math.round((recent.filter((a) => a.correct).length / recent.length) * 100) : 0;
    return {
      topicId,
      name: topicMeta(topicId)?.name,
      accuracy: acc,
      mastery: stats[topicId]?.mastery ?? null,
      status: acc >= 75 ? 'STRONG' : acc >= 50 ? 'PARTIAL' : 'NEEDS_PRACTICE',
    };
  });
}

/* ================================================================== DAILY CHALLENGE (F5-01..12) */

function selectChallengeQuestions(uid, classId, date) {
  const r = seeded(`${uid}:${date}:challenge`);
  const st = userState(uid);
  const stats = topicStats(uid, classId);
  const topics = classTopics(classId);
  const weak = strongWeak(uid, classId).weak.map((t) => t.topicId);
  const mistakeCounts = {};
  Object.values(st.mistakes).filter((m) => m.status === 'ACTIVE' && m.classId === classId)
    .forEach((m) => { mistakeCounts[m.topicId] = (mistakeCounts[m.topicId] || 0) + 1; });
  const mistakeTopics = Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const lastStudied = st.topicViews.find((v) => topicMeta(v.topicId)?.classId === classId)?.topicId;
  const stale = (id) => !stats[id] || stats[id].lastAttemptAt < addDays(date, -7);
  const spaced = r.shuffle(topics).sort((a, b) => Number(stale(b)) - Number(stale(a)));
  // Priority: weak → unresolved mistakes → recently studied → spaced coverage (F5-02)
  const priority = [...new Set([...weak, ...mistakeTopics, lastStudied, ...spaced].filter(Boolean))].filter((id) => topics.includes(id));

  const recentCorrect = new Set(st.attempts.filter((a) => a.correct && a.date >= addDays(date, -30)).map((a) => a.questionId));
  const mix = cfg().challenge.mix;
  const slots = Object.entries(mix).flatMap(([d, n]) => Array(n).fill(d)).slice(0, cfg().challenge.size);
  while (slots.length < cfg().challenge.size) slots.push('MEDIUM');

  const chosen = [];
  let cursor = 0;
  slots.forEach((diff) => {
    let picked = null;
    for (let k = 0; k < priority.length && !picked; k += 1) {
      const topicId = priority[(cursor + k) % priority.length];
      const pool = servable(topicId).filter((q) => q.difficulty === diff && !chosen.includes(q.questionId) && !recentCorrect.has(q.questionId));
      if (pool.length) {
        picked = r.pick(pool);
        cursor += k + 1;
      }
    }
    if (!picked) {
      // topic pool exhausted: widen to the whole class, then allow repeats (F4-05, F5-03)
      const pool = topics.flatMap((id) => servable(id)).filter((q) => !chosen.includes(q.questionId));
      picked = r.pick(pool.filter((q) => q.difficulty === diff)) || r.pick(pool);
    }
    if (picked) chosen.push(picked.questionId);
  });
  return chosen;
}

/** F5-11: a challenge left incomplete at the day boundary expires; answers still count as attempts. */
function expireOldChallenges(uid) {
  const st = userState(uid);
  Object.values(st.challenges).forEach((c) => {
    if (c.date < today() && (c.status === 'IN_PROGRESS' || c.status === 'NOT_STARTED')) {
      c.status = 'EXPIRED';
      Object.entries(c.answers).forEach(([qid, ans]) => {
        const q = getQuestion(qid);
        if (q) recordAttempt(uid, q, ans, 'CHALLENGE', { refId: c.id, timeSpentSec: c.times[qid], date: c.date, at: `${c.date}T23:59:59+05:30` });
      });
    }
  });
}

function challengePayload(c) {
  const questions = c.questionIds.map((id) => getQuestion(id)).filter(Boolean);
  const firstOpen = questions.findIndex((q) => c.answers[q.questionId] == null);
  return {
    id: c.id,
    date: c.date,
    status: c.status,
    total: questions.length,
    answers: c.answers,
    currentIndex: firstOpen === -1 ? questions.length - 1 : firstOpen,
    questions: c.status === 'SUBMITTED' ? questions.map((q) => reveal(q, c.answers[q.questionId])) : questions.map(toPublicQuestion),
    result: c.result || null,
  };
}

/** Generated server-side and pinned for the day — same challenge on every device (F5-04). */
function challengeToday({ uid, user }) {
  expireOldChallenges(uid);
  const st = userState(uid);
  const date = today();
  if (!st.challenges[date]) {
    st.challenges[date] = {
      id: `${uid}_${date}`,
      date,
      classId: user.profile.classId,
      questionIds: selectChallengeQuestions(uid, user.profile.classId, date),
      answers: {},
      times: {},
      status: 'NOT_STARTED',
      startedAt: null,
      submittedAt: null,
      result: null,
    };
  }
  return challengePayload(st.challenges[date]);
}

function challengeAnswer({ uid, body }) {
  const st = userState(uid);
  const c = st.challenges[today()];
  if (!c) throw new ApiError(ERROR_CODES.NOT_FOUND, "Today's challenge was not found. Please reopen it.", { status: 404 });
  if (c.status === 'SUBMITTED') return { saved: false, alreadySubmitted: true };
  if (!c.questionIds.includes(body.questionId)) throw new ApiError(ERROR_CODES.VALIDATION, 'This question is not part of today’s challenge.');
  if (body.answer == null || String(body.answer).trim() === '') throw new ApiError(ERROR_CODES.VALIDATION, 'Please choose or type an answer.');
  c.answers[body.questionId] = String(body.answer).slice(0, 50);
  c.times[body.questionId] = Math.min(3600, Number(body.timeSpentSec) || 0);
  if (c.status === 'NOT_STARTED') {
    c.status = 'IN_PROGRESS';
    c.startedAt = nowIso();
  }
  return { saved: true, answered: Object.keys(c.answers).length, total: c.questionIds.length }; // no correctness here
}

/** Transactional + idempotent submission (F5-08..F5-10, acceptance: second call returns alreadySubmitted). */
function challengeSubmit({ uid, user }) {
  const st = userState(uid);
  const c = st.challenges[today()];
  if (!c) throw new ApiError(ERROR_CODES.NOT_FOUND, "Today's challenge was not found.", { status: 404 });
  if (c.status === 'SUBMITTED') return { ...c.result, alreadySubmitted: true };
  const missing = c.questionIds.filter((id) => c.answers[id] == null);
  if (missing.length) throw new ApiError(ERROR_CODES.VALIDATION, `Answer all questions before submitting (${missing.length} left).`);

  const classId = user.profile.classId;
  const date = today();
  const questions = c.questionIds.map(getQuestion);
  let score = 0;
  let mistakesSaved = 0;
  questions.forEach((q) => {
    const ok = recordAttempt(uid, q, c.answers[q.questionId], 'CHALLENGE', { refId: c.id, timeSpentSec: c.times[q.questionId] });
    if (ok) score += 1; else mistakesSaved += 1;
  });
  const total = questions.length;
  const scorePct = Math.round((score / total) * 100);
  const xpc = cfg().xp;
  let xp = awardXp(uid, { type: 'DAILY_CHALLENGE', amount: xpc.DAILY_CHALLENGE, eventId: `xp_${c.id}`, label: 'Daily Challenge completed' });
  if (score === total) xp += awardXp(uid, { type: 'ALL_CORRECT_BONUS', amount: xpc.ALL_CORRECT_BONUS, eventId: `xp_${c.id}_perfect`, label: 'Perfect challenge bonus' });

  // Gold Coin reward check runs immediately after (F5-10, F10-05/06)
  const rule = cfg().coins.DAILY_CHALLENGE;
  let coins = 0;
  let coinReason = null;
  if (!user.emailVerified) {
    coinReason = 'Verify your email to start collecting Gold Coins.'; // F1-01
  } else if (scorePct >= rule.minScorePct) {
    const r = awardCoins(uid, { type: 'DAILY_CHALLENGE', amount: rule.amount, sourceEventId: c.id, label: 'Daily Challenge reward' });
    coins = r.awarded ? r.entry.amount : 0;
    const bonus = maybeBothBonus(uid, date);
    if (bonus) coins += bonus.amount;
  } else {
    coinReason = `Score ${rule.minScorePct}% or more to earn Gold Coins.`;
  }

  const streak = extendStreak(uid, date);
  xp += streak.milestoneXp;

  c.status = 'SUBMITTED';
  c.submittedAt = nowIso();
  c.result = {
    challengeId: c.id,
    date,
    score,
    total,
    scorePct,
    xpAwarded: xp,
    coinsAwarded: coins,
    coinReason,
    mistakesSaved,
    streak: { current: streak.current, extended: streak.extended, milestoneXp: streak.milestoneXp, longest: effectiveStreak(uid).longest },
    diagnosis: diagnosisFor(uid, classId, questions.map((q) => q.topicId)),
    questions: questions.map((q) => reveal(q, c.answers[q.questionId])),
    alreadySubmitted: false,
  };
  pushActivity(uid, { type: 'CHALLENGE', title: `Daily Challenge: ${score}/${total}`, detail: coins ? `+${xp} XP · +${coins} coins` : `+${xp} XP`, link: '/challenge/result' });
  return c.result;
}

function challengeResult({ uid }) {
  const c = userState(uid).challenges[today()];
  if (!c || c.status !== 'SUBMITTED') throw new ApiError(ERROR_CODES.NOT_FOUND, "You haven't finished today's challenge yet.", { status: 404 });
  return { ...c.result, alreadySubmitted: true };
}

/* ================================================================== FREE PRACTICE (F5-13..16) */

export function startPracticeSet(uid, user, { scope = 'TOPIC', targetId, size = 10, difficulty = 'MIXED', maxDifficulty = null, title = null }) {
  const classId = user.profile.classId;
  const st = userState(uid);
  const r = seeded(`${uid}:${Date.now()}`);
  let topicIds = [];
  let label = title;
  if (scope === 'TOPIC') {
    const t = assertOwnClass(user, targetId);
    topicIds = [t.id];
    label = label || t.name;
  } else if (scope === 'CHAPTER') {
    const ch = curriculumFor(classId).find((x) => x.id === targetId);
    if (!ch) throw new ApiError(ERROR_CODES.FORBIDDEN, 'This chapter is not part of your class.', { status: 403 });
    topicIds = ch.topics.map((t) => t.id);
    label = label || ch.name;
  } else if (scope === 'WEAK') {
    topicIds = strongWeak(uid, classId).weak.map((t) => t.topicId);
    if (!topicIds.length) {
      const stats = Object.values(topicStats(uid, classId)).sort((a, b) => b.activeMistakes - a.activeMistakes);
      topicIds = stats.slice(0, 3).map((t) => t.topicId);
    }
    if (!topicIds.length) topicIds = r.shuffle(classTopics(classId)).slice(0, 3);
    label = label || 'My weak topics';
  } else {
    throw new ApiError(ERROR_CODES.VALIDATION, 'Unknown practice scope.');
  }
  const n = [5, 10, 20].includes(Number(size)) ? Number(size) : 10;
  const order = { EASY: 1, MEDIUM: 2, HARD: 3 };
  const recentCorrect = new Set(st.attempts.filter((a) => a.correct && a.date >= addDays(today(), -30)).map((a) => a.questionId));
  const fits = (q) => (difficulty === 'MIXED' || q.difficulty === difficulty) && (!maxDifficulty || order[q.difficulty] <= order[maxDifficulty]);

  let pool = topicIds.flatMap((id) => servable(id)).filter(fits);
  let notice = null;
  let fresh = pool.filter((q) => !recentCorrect.has(q.questionId));
  if (fresh.length < n && scope === 'TOPIC') {
    // widen to chapter (F5-03 / empty pool handling in 22.1)
    const t = topicMeta(topicIds[0]);
    const chapterPool = curriculumFor(classId).find((ch) => ch.id === t.chapterId)?.topics.flatMap((x) => servable(x.id)).filter(fits) || [];
    if (chapterPool.length > pool.length) {
      notice = 'We added a few questions from the same chapter so you get a full set.';
      fresh = [...fresh, ...chapterPool.filter((q) => q.topicId !== t.id && !recentCorrect.has(q.questionId))];
      pool = chapterPool;
    }
  }
  let picked = r.shuffle(fresh).slice(0, n);
  if (picked.length < n) picked = [...picked, ...r.shuffle(pool.filter((q) => !picked.includes(q))).slice(0, n - picked.length)];
  if (!picked.length) throw new ApiError(ERROR_CODES.NOT_FOUND, 'New questions for this topic are being added. Try another topic for now.', { status: 404 });
  if (picked.length < n && !notice) notice = `Only ${picked.length} questions are available here right now — more are being added.`;

  const set = {
    id: makeId('ps_'), scope, targetId, title: label, difficulty, size: picked.length,
    questionIds: picked.map((q) => q.questionId), results: {}, status: 'IN_PROGRESS', createdAt: nowIso(), notice,
  };
  st.practiceSets[set.id] = set;
  return practicePayload(set);
}

function practicePayload(set) {
  return {
    id: set.id, title: set.title, scope: set.scope, targetId: set.targetId, difficulty: set.difficulty, status: set.status, notice: set.notice,
    questions: set.questionIds.map((id) => {
      const q = getQuestion(id);
      const res = set.results[id];
      return res ? { ...reveal(q, res.answer), xpAwarded: res.xp } : toPublicQuestion(q);
    }),
    answeredCount: Object.keys(set.results).length,
    summary: set.summary || null,
  };
}

const practiceStart = ({ uid, user, body }) => startPracticeSet(uid, user, body);

function practiceGet({ uid, params }) {
  const set = userState(uid).practiceSets[params.id];
  if (!set) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Practice set not found.', { status: 404 });
  return practicePayload(set);
}

/** POST /attempts/submit — immediate per-question feedback for practice (F5-14). */
function attemptSubmit({ uid, body }) {
  const st = userState(uid);
  const set = st.practiceSets[body.setId];
  if (!set) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Practice set not found.', { status: 404 });
  if (!set.questionIds.includes(body.questionId)) throw new ApiError(ERROR_CODES.VALIDATION, 'Question is not part of this set.');
  const q = getQuestion(body.questionId);
  const existing = set.results[body.questionId];
  if (existing) return { ...reveal(q, existing.answer), xpAwarded: existing.xp, mistakeSaved: !existing.correct, alreadyAnswered: true };
  if (body.answer == null || String(body.answer).trim() === '') throw new ApiError(ERROR_CODES.VALIDATION, 'Please choose or type an answer.');
  const answer = String(body.answer).slice(0, 50);
  const correct = recordAttempt(uid, q, answer, 'PRACTICE', { refId: set.id, timeSpentSec: body.timeSpentSec });
  const xpc = cfg().xp;
  const xp = correct ? awardXp(uid, { type: 'PRACTICE_QUESTION', amount: xpc.PRACTICE_QUESTION, eventId: `xp_${set.id}_${q.questionId}`, capKey: 'PRACTICE', cap: xpc.PRACTICE_DAILY_CAP, label: 'Practice question' }) : 0;
  set.results[q.questionId] = { answer, correct, xp, at: nowIso() };
  return { ...reveal(q, answer), xpAwarded: xp, mistakeSaved: !correct };
}

function practiceFinish({ uid, user, params }) {
  const set = userState(uid).practiceSets[params.id];
  if (!set) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Practice set not found.', { status: 404 });
  if (set.summary) return set.summary;
  const res = Object.entries(set.results);
  const correct = res.filter(([, r]) => r.correct).length;
  set.status = 'COMPLETED';
  set.summary = {
    total: set.questionIds.length,
    answered: res.length,
    correct,
    accuracy: res.length ? Math.round((correct / res.length) * 100) : 0,
    xpAwarded: res.reduce((s, [, r]) => s + r.xp, 0),
    mistakesSaved: res.length - correct,
    diagnosis: diagnosisFor(uid, user.profile.classId, set.questionIds.map((id) => getQuestion(id).topicId)),
  };
  pushActivity(uid, { type: 'PRACTICE', title: `Practised ${set.title}`, detail: `${correct}/${res.length} correct`, link: '/practice' });
  return set.summary;
}

/* ================================================================== TESTS & SERIES (F6) */

const GRACE_MS = 5000;

function studentTestState(uid, test, series) {
  const st = userState(uid);
  const attempts = Object.values(st.testAttempts).filter((a) => a.testId === test.id);
  const submitted = attempts.filter((a) => a.status === 'SUBMITTED').sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const inProgress = attempts.find((a) => a.status === 'IN_PROGRESS');
  let locked = false;
  if (series && series.unlockMode === 'SEQUENTIAL' && test.order > 1) {
    const prevId = series.testIds[test.order - 2];
    locked = !Object.values(st.testAttempts).some((a) => a.testId === prevId && a.status === 'SUBMITTED');
  }
  const first = submitted[0];
  return {
    status: locked ? 'LOCKED' : inProgress ? 'IN_PROGRESS' : first ? 'COMPLETED' : 'AVAILABLE',
    firstAttempt: first ? { attemptId: first.id, scorePct: first.result.scorePct, marks: first.result.marks, submittedAt: first.submittedAt } : null,
    attemptsCount: submitted.length,
    canReattempt: Boolean(first && test.reattempt),
    inProgressAttemptId: inProgress?.id || null,
  };
}

const testCard = (uid, t, series) => ({
  id: t.id, title: t.title, kind: t.kind, durationSec: t.durationSec, totalMarks: t.totalMarks, questionCount: t.questionIds.length,
  negativeMarks: t.negativeMarks, marksPerQ: t.marksPerQ, seriesId: t.seriesId, order: t.order, reattempt: t.reattempt,
  chapters: t.chapterIds.map((id) => curriculumFor(t.classId, { includeUnpublished: true }).find((c) => c.id === id)?.name).filter(Boolean),
  ...studentTestState(uid, t, series),
});

function seriesProgress(uid, s, tests) {
  const st = userState(uid);
  const results = s.testIds.map((id) => Object.values(st.testAttempts).filter((a) => a.testId === id && a.status === 'SUBMITTED')
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))[0]).filter(Boolean);
  const chapterAcc = {};
  results.forEach((a) => a.result.byChapter.forEach((c) => {
    const x = chapterAcc[c.chapterId] || (chapterAcc[c.chapterId] = { name: c.name, correct: 0, total: 0 });
    x.correct += c.correct;
    x.total += c.total;
  }));
  const ranked = Object.values(chapterAcc).filter((c) => c.total).map((c) => ({ ...c, acc: Math.round((c.correct / c.total) * 100) })).sort((a, b) => b.acc - a.acc);
  return {
    completed: results.length,
    total: tests.length,
    averageScorePct: results.length ? Math.round(results.reduce((sum, a) => sum + a.result.scorePct, 0) / results.length) : null,
    strongestChapter: ranked[0] || null,
    weakestChapter: ranked.length > 1 ? ranked[ranked.length - 1] : null,
  };
}

function listTests({ uid, user }) {
  const classId = user.profile.classId;
  const { tests, series } = testCatalog();
  const mine = tests.filter((t) => t.classId === classId && t.status === 'PUBLISHED');
  const mySeries = series.filter((s) => s.classId === classId && s.status === 'PUBLISHED');
  return {
    chapterTests: mine.filter((t) => t.kind === 'CHAPTER').map((t) => testCard(uid, t)),
    fullTests: mine.filter((t) => t.kind === 'FULL').map((t) => testCard(uid, t)),
    series: mySeries.map((s) => {
      const st = s.testIds.map((id) => mine.find((t) => t.id === id)).filter(Boolean);
      return { id: s.id, title: s.title, description: s.description, unlockMode: s.unlockMode, tests: st.map((t) => testCard(uid, t, s)), progress: seriesProgress(uid, s, st) };
    }),
  };
}

function findTest(user, id) {
  const { tests, series } = testCatalog();
  const t = tests.find((x) => x.id === id);
  if (!t || t.status !== 'PUBLISHED') throw new ApiError(ERROR_CODES.NOT_FOUND, 'This test is not available.', { status: 404 });
  if (t.classId !== user.profile.classId) throw new ApiError(ERROR_CODES.FORBIDDEN, 'This test is not for your class.', { status: 403 });
  return { test: t, series: t.seriesId ? series.find((s) => s.id === t.seriesId) : null };
}

function getTest({ uid, user, params }) {
  const { test, series } = findTest(user, params.id);
  return { ...testCard(uid, test, series), instructions: test.instructions, allowNegativeTotal: test.allowNegativeTotal, seriesTitle: series?.title || null };
}

function gradeTest(uid, test, attempt, { auto = false, at = nowIso(), date = today() } = {}) {
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  const byChapter = {};
  const byTopic = {};
  const perQ = Math.round(test.durationSec / test.questionIds.length);
  const questions = test.questionIds.map((id) => {
    const q = getQuestion(id);
    const ans = attempt.answers[id];
    const answered = ans != null && ans !== '';
    let ok = false;
    if (answered) ok = recordAttempt(uid, q, ans, 'TEST', { refId: attempt.id, timeSpentSec: perQ, at, date });
    if (!answered) skipped += 1; else if (ok) correct += 1; else incorrect += 1;
    const ch = byChapter[q.chapterId] || (byChapter[q.chapterId] = { chapterId: q.chapterId, name: topicMeta(q.topicId)?.chapterName, correct: 0, incorrect: 0, skipped: 0, total: 0 });
    const tp = byTopic[q.topicId] || (byTopic[q.topicId] = { topicId: q.topicId, name: topicMeta(q.topicId)?.name, correct: 0, total: 0 });
    ch.total += 1; tp.total += 1;
    if (!answered) ch.skipped += 1; else if (ok) { ch.correct += 1; tp.correct += 1; } else ch.incorrect += 1;
    return { ...reveal(q, ans), markedForReview: attempt.marked.includes(id) };
  });
  let marks = correct * test.marksPerQ - incorrect * test.negativeMarks;
  if (!test.allowNegativeTotal) marks = Math.max(0, marks);
  const scorePct = Math.round((marks / test.totalMarks) * 100);
  const st = userState(uid);
  const isFirst = !Object.values(st.testAttempts).some((a) => a.testId === test.id && a.status === 'SUBMITTED' && a.id !== attempt.id);

  // Rank / percentile only with >= 10 attempts (F6-08); first attempt counts
  const cohort = cohortScores(test.id);
  const all = isFirst ? [...cohort, scorePct] : cohort;
  const rank = all.length >= 10 ? { rank: 1 + cohort.filter((s) => s > scorePct).length, of: all.length, percentile: Math.round((cohort.filter((s) => s < scorePct).length / cohort.length) * 100) } : null;

  const xp = isFirst ? awardXp(uid, { type: 'TEST_COMPLETED', amount: cfg().xp.TEST_COMPLETED, eventId: `xp_test_${test.id}_first`, label: `Test completed: ${test.title}`, at, date }) : 0;
  const chapters = Object.values(byChapter).map((c) => ({ ...c, accuracy: Math.round((c.correct / c.total) * 100) }));
  const sorted = [...chapters].sort((a, b) => b.accuracy - a.accuracy);
  const topics = Object.values(byTopic).map((t) => ({ ...t, accuracy: Math.round((t.correct / t.total) * 100) }));
  const weakestTopic = [...topics].sort((a, b) => a.accuracy - b.accuracy)[0];
  const endMs = Math.min(new Date(at).getTime(), new Date(attempt.deadline).getTime());

  attempt.status = 'SUBMITTED';
  attempt.submittedAt = at;
  attempt.autoSubmitted = auto;
  attempt.result = {
    attemptId: attempt.id, testId: test.id, title: test.title, seriesId: test.seriesId,
    correct, incorrect, skipped, total: test.questionIds.length,
    marks, totalMarks: test.totalMarks, scorePct,
    accuracy: correct + incorrect ? Math.round((correct / (correct + incorrect)) * 100) : 0,
    timeTakenSec: Math.max(0, Math.round((endMs - new Date(attempt.startedAt).getTime()) / 1000)),
    durationSec: test.durationSec,
    negativeMarks: test.negativeMarks, marksPerQ: test.marksPerQ,
    byChapter: chapters, byTopic: topics,
    rank, xpAwarded: xp, isFirstAttempt: isFirst, autoSubmitted: auto,
    mistakesSaved: incorrect,
    aiSummary: testSummary({ scorePct, strongest: sorted.length > 1 ? sorted[0].name : null, weakest: weakestTopic && weakestTopic.accuracy < 75 ? weakestTopic.name : null, skipped }),
    weakestTopicId: weakestTopic?.topicId,
    questions,
  };
  pushActivity(uid, { type: 'TEST', title: `${test.title}`, detail: `${marks}/${test.totalMarks} marks${auto ? ' · auto-submitted' : ''}`, link: `/tests/result/${attempt.id}` }, at);
  return attempt.result;
}

function autoSubmitIfExpired(uid, attempt) {
  if (attempt.status === 'IN_PROGRESS' && Date.now() > new Date(attempt.deadline).getTime() + GRACE_MS) {
    const { tests } = testCatalog();
    gradeTest(uid, tests.find((t) => t.id === attempt.testId), attempt, { auto: true });
    return true;
  }
  return false;
}

/** Authoritative server timer: startedAt stored, leaving the app does not pause it (F6-06). */
function startTest({ uid, user, params }) {
  const { test, series } = findTest(user, params.id);
  const state = studentTestState(uid, test, series);
  if (state.status === 'LOCKED') throw new ApiError(ERROR_CODES.TEST_LOCKED, 'Finish the previous test in this series to unlock this one.', { status: 403 });
  const st = userState(uid);
  let attempt = state.inProgressAttemptId && st.testAttempts[state.inProgressAttemptId];
  if (attempt && autoSubmitIfExpired(uid, attempt)) {
    return { autoSubmitted: true, attemptId: attempt.id };
  }
  if (!attempt) {
    if (state.status === 'COMPLETED' && !test.reattempt) throw new ApiError(ERROR_CODES.ALREADY_ATTEMPTED, 'You have already taken this test.', { status: 409, details: { attemptId: state.firstAttempt.attemptId } });
    const startedAt = new Date();
    attempt = {
      id: makeId('ta_'), testId: test.id, classId: test.classId, startedAt: startedAt.toISOString(),
      deadline: new Date(startedAt.getTime() + test.durationSec * 1000).toISOString(),
      answers: {}, marked: [], status: 'IN_PROGRESS', savedAt: startedAt.toISOString(), autoSubmitted: false,
    };
    st.testAttempts[attempt.id] = attempt;
  }
  return {
    attemptId: attempt.id,
    test: { id: test.id, title: test.title, durationSec: test.durationSec, totalMarks: test.totalMarks, marksPerQ: test.marksPerQ, negativeMarks: test.negativeMarks },
    questions: test.questionIds.map((id) => toPublicQuestion(getQuestion(id))), // never the answers (F4-04)
    answers: attempt.answers,
    marked: attempt.marked,
    serverNow: nowIso(),
    remainingSec: Math.max(0, Math.round((new Date(attempt.deadline).getTime() - Date.now()) / 1000)),
    savedAt: attempt.savedAt,
  };
}

function sanitizeAnswers(test, answers = {}) {
  const out = {};
  Object.entries(answers).forEach(([k, v]) => {
    if (test.questionIds.includes(k) && v != null && String(v).trim() !== '') out[k] = String(v).slice(0, 50);
  });
  return out;
}

function autosaveTest({ uid, user, params, body }) {
  const { test } = findTest(user, params.id);
  const attempt = userState(uid).testAttempts[body.attemptId];
  if (!attempt || attempt.testId !== test.id) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Attempt not found.', { status: 404 });
  if (attempt.status === 'SUBMITTED') return { autoSubmitted: attempt.autoSubmitted, submitted: true, attemptId: attempt.id };
  if (autoSubmitIfExpired(uid, attempt)) return { autoSubmitted: true, submitted: true, attemptId: attempt.id };
  attempt.answers = sanitizeAnswers(test, body.answers);
  attempt.marked = (body.marked || []).filter((id) => test.questionIds.includes(id));
  attempt.savedAt = nowIso();
  return { savedAt: attempt.savedAt, remainingSec: Math.max(0, Math.round((new Date(attempt.deadline).getTime() - Date.now()) / 1000)) };
}

function submitTest({ uid, user, params, body }) {
  const { test } = findTest(user, params.id);
  const attempt = userState(uid).testAttempts[body.attemptId];
  if (!attempt || attempt.testId !== test.id) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Attempt not found.', { status: 404 });
  if (attempt.status === 'SUBMITTED') return { ...attempt.result, alreadySubmitted: true };
  const late = Date.now() > new Date(attempt.deadline).getTime() + GRACE_MS;
  // Late submissions are rejected; the saved answers are auto-submitted instead (F6-06)
  if (!late) {
    attempt.answers = sanitizeAnswers(test, body.answers);
    attempt.marked = (body.marked || []).filter((id) => test.questionIds.includes(id));
  }
  return gradeTest(uid, test, attempt, { auto: late || Boolean(body.timeUp) });
}

function testAttemptResult({ uid, params }) {
  const a = userState(uid).testAttempts[params.id];
  if (!a) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Result not found.', { status: 404 });
  if (a.status !== 'SUBMITTED') autoSubmitIfExpired(uid, a);
  if (a.status !== 'SUBMITTED') throw new ApiError(ERROR_CODES.CONFLICT, 'This test is still in progress.', { status: 409 });
  return a.result;
}

function getSeries({ uid, user, params }) {
  const { tests, series } = testCatalog();
  const s = series.find((x) => x.id === params.id && x.classId === user.profile.classId && x.status === 'PUBLISHED');
  if (!s) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Series not found.', { status: 404 });
  const st = s.testIds.map((id) => tests.find((t) => t.id === id)).filter(Boolean);
  return { id: s.id, title: s.title, description: s.description, unlockMode: s.unlockMode, tests: st.map((t) => testCard(uid, t, s)), progress: seriesProgress(uid, s, st) };
}

/* ================================================================== MISTAKE BANK (F8) */

function mistakeListItem(m) {
  const t = topicMeta(m.topicId);
  return {
    id: m.id, questionText: m.questionSnapshot.text, kind: m.kind, topicId: m.topicId, topicName: t?.name, chapterId: m.chapterId, chapterName: t?.chapterName,
    status: m.status, wrongCount: m.wrongCount, source: m.source, sources: [...new Set(m.attempts.map((a) => a.source))],
    createdAt: m.createdAt, lastAttemptAt: m.lastAttemptAt, nextReviewAt: m.nextReviewAt, reviewCount: m.reviewCount,
    due: m.status === 'ACTIVE' && m.nextReviewAt <= today(), difficulty: m.questionSnapshot.difficulty,
  };
}

function listMistakes({ uid, user, query }) {
  const classId = user.profile.classId;
  const all = Object.values(userState(uid).mistakes).filter((m) => m.classId === classId);
  let list = all;
  if (query.status && query.status !== 'ALL') list = list.filter((m) => m.status === query.status);
  if (query.due === 'true') list = list.filter((m) => m.status === 'ACTIVE' && m.nextReviewAt <= today());
  if (query.chapterId) list = list.filter((m) => m.chapterId === query.chapterId);
  if (query.topicId) list = list.filter((m) => m.topicId === query.topicId);
  if (query.source) list = list.filter((m) => m.attempts.some((a) => a.source === query.source));
  if (query.q) {
    const q = query.q.toLowerCase().slice(0, 80);
    list = list.filter((m) => m.questionSnapshot.text.toLowerCase().includes(q) || (topicMeta(m.topicId)?.name || '').toLowerCase().includes(q)
      || (topicMeta(m.topicId)?.chapterName || '').toLowerCase().includes(q));
  }
  list = [...list].sort(query.sort === 'REPEATED'
    ? (a, b) => b.wrongCount - a.wrongCount || b.lastAttemptAt.localeCompare(a.lastAttemptAt)
    : (a, b) => b.lastAttemptAt.localeCompare(a.lastAttemptAt));
  const chapters = [...new Map(all.map((m) => [m.chapterId, { id: m.chapterId, name: topicMeta(m.topicId)?.chapterName }])).values()];
  return {
    items: list.map(mistakeListItem),
    counts: {
      ALL: all.length,
      ACTIVE: all.filter((m) => m.status === 'ACTIVE').length,
      RESOLVED: all.filter((m) => m.status === 'RESOLVED').length,
      ARCHIVED: all.filter((m) => m.status === 'ARCHIVED').length,
      DUE: all.filter((m) => m.status === 'ACTIVE' && m.nextReviewAt <= today()).length,
    },
    chapters,
  };
}

function ownMistake(uid, id) {
  const m = userState(uid).mistakes[id];
  if (!m) throw new ApiError(ERROR_CODES.NOT_FOUND, 'This mistake could not be found.', { status: 404 });
  return m;
}

function mistakeDetail(m) {
  const s = m.questionSnapshot;
  return {
    ...mistakeListItem(m),
    question: { text: s.text, imageUrl: s.imageUrl, type: s.type, options: s.options, difficulty: s.difficulty },
    yourAnswer: m.attempts[m.attempts.length - 1]?.answer ?? null,
    yourAnswerLabel: answerLabel(s, m.attempts[m.attempts.length - 1]?.answer),
    correctAnswer: s.correctAnswer,
    correctAnswerLabel: answerLabel(s, s.correctAnswer),
    explanation: s.explanation,
    conceptNote: s.conceptNote,
    aiConcept: m.aiConcept,
    attempts: m.attempts.map((a) => ({ ...a, label: answerLabel(s, a.answer) })),
    resolvedAt: m.resolvedAt,
  };
}

/** F8-05: generate + cache the concept explanation on first open so it is never empty. */
function getMistake({ uid, params }) {
  const m = ownMistake(uid, params.id);
  if (!m.aiConcept) m.aiConcept = explainMistake(m, topicMeta(m.topicId)?.family);
  return mistakeDetail(m);
}

/** F8-06 / F8-08 retry semantics. Graded against the snapshot so later bank edits never change history. */
function retryMistake({ uid, params, body }) {
  const m = ownMistake(uid, params.id);
  if (body.answer == null || String(body.answer).trim() === '') throw new ApiError(ERROR_CODES.VALIDATION, 'Please choose or type an answer.');
  const answer = String(body.answer).slice(0, 50);
  const ok = isCorrect(m.questionSnapshot, answer);
  const st = userState(uid);
  const at = nowIso();
  st.attempts.push({ id: makeId('att_'), questionId: m.questionId, topicId: m.topicId, chapterId: m.chapterId, classId: m.classId, answer, correct: ok, timeSpentSec: Number(body.timeSpentSec) || 0, source: 'REVIEW', refId: m.id, at, date: today() });
  st.recommendation = null;
  m.reviewCount += 1;
  let xp = 0;
  if (ok) {
    m.status = 'RESOLVED';
    m.resolvedAt = at;
    const xpc = cfg().xp;
    xp = awardXp(uid, { type: 'MISTAKE_RESOLVED', amount: xpc.MISTAKE_RESOLVED, eventId: `xp_resolve_${m.id}_${m.reviewCount}`, capKey: 'MISTAKE', cap: xpc.MISTAKE_DAILY_CAP, label: 'Mistake resolved' });
    pushActivity(uid, { type: 'MISTAKE_RESOLVED', title: 'Resolved a mistake', detail: topicMeta(m.topicId)?.name, link: `/mistakes/${m.id}` });
  } else {
    m.wrongCount += 1;
    m.attempts.push({ answer, at, source: 'REVIEW' });
    m.status = 'ACTIVE';
    m.lastAttemptAt = at;
    m.nextReviewAt = addDays(today(), cfg().reviewCycleDays);
  }
  return { correct: ok, xpAwarded: xp, mistake: mistakeDetail(m) };
}

function archiveMistake({ uid, params, body }) {
  const m = ownMistake(uid, params.id);
  if (body.archived) {
    if (m.status === 'RESOLVED') throw new ApiError(ERROR_CODES.VALIDATION, 'Resolved mistakes stay in your bank — no need to archive them.');
    m.status = 'ARCHIVED';
  } else if (m.status === 'ARCHIVED') {
    m.status = 'ACTIVE';
    m.nextReviewAt = today();
  }
  return mistakeDetail(m);
}

function simplerExplanation({ uid, params }) {
  const m = ownMistake(uid, params.id);
  const e = reExplain({ family: topicMeta(m.topicId)?.family || 'linear', seed: m.id, round: Math.min(2, m.reviewCount || 1) });
  return { intro: e.intro, concept: e.concept, steps: e.step_by_step };
}

/** F8-09: 5 questions from the same topic at the same or lower difficulty. */
function practiceMore({ uid, user, params }) {
  const m = ownMistake(uid, params.id);
  return startPracticeSet(uid, user, { scope: 'TOPIC', targetId: m.topicId, size: 5, maxDifficulty: m.questionSnapshot.difficulty || 'HARD', title: `More like this: ${topicMeta(m.topicId)?.name}` });
}

export const assessmentRoutes = [
  { method: 'POST', path: '/challenge/today', auth: 'student', consent: true, handler: challengeToday },
  { method: 'POST', path: '/challenge/answer', auth: 'student', consent: true, handler: challengeAnswer },
  { method: 'POST', path: '/challenge/submit', auth: 'student', consent: true, handler: challengeSubmit },
  { method: 'GET', path: '/challenge/result', auth: 'student', consent: true, handler: challengeResult },
  { method: 'POST', path: '/practice/start', auth: 'student', consent: true, handler: practiceStart },
  { method: 'GET', path: '/practice/:id', auth: 'student', consent: true, handler: practiceGet },
  { method: 'POST', path: '/practice/:id/finish', auth: 'student', consent: true, handler: practiceFinish },
  { method: 'POST', path: '/attempts/submit', auth: 'student', consent: true, handler: attemptSubmit },
  { method: 'GET', path: '/tests', auth: 'student', consent: true, handler: listTests },
  { method: 'GET', path: '/tests/:id', auth: 'student', consent: true, handler: getTest },
  { method: 'POST', path: '/tests/:id/start', auth: 'student', consent: true, handler: startTest },
  { method: 'POST', path: '/tests/:id/autosave', auth: 'student', consent: true, handler: autosaveTest },
  { method: 'POST', path: '/tests/:id/submit', auth: 'student', consent: true, handler: submitTest },
  { method: 'GET', path: '/test-attempts/:id', auth: 'student', consent: true, handler: testAttemptResult },
  { method: 'GET', path: '/test-series/:id', auth: 'student', consent: true, handler: getSeries },
  { method: 'GET', path: '/mistakes', auth: 'student', consent: true, handler: listMistakes },
  { method: 'GET', path: '/mistakes/:id', auth: 'student', consent: true, handler: getMistake },
  { method: 'POST', path: '/mistakes/:id/retry', auth: 'student', consent: true, handler: retryMistake },
  { method: 'POST', path: '/mistakes/:id/archive', auth: 'student', consent: true, handler: archiveMistake },
  { method: 'POST', path: '/mistakes/:id/simpler', auth: 'student', consent: true, handler: simplerExplanation },
  { method: 'POST', path: '/mistakes/:id/practice-more', auth: 'student', consent: true, handler: practiceMore },
];

export { gradeTest };
