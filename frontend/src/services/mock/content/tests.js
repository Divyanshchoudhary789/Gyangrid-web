import { seeded } from '@/lib/random';
import { CURRICULUM } from './curriculum';
import { questionsForChapter } from './questionBank';

const INSTRUCTIONS = (mins, n, marks, neg) => [
  `This test has ${n} questions and lasts ${mins} minutes.`,
  `Each correct answer carries ${marks} mark${marks > 1 ? 's' : ''}.`,
  neg ? `${neg} mark is deducted for each wrong answer. Unanswered questions carry no penalty.` : 'There is no negative marking.',
  'The timer runs on our server — leaving the app does not pause it.',
  'Your answers are saved automatically every few seconds.',
  'When the time is up, your saved answers are submitted automatically.',
];

function pickQuestions(chapterIds, count, seed) {
  const r = seeded(seed);
  const pool = chapterIds.flatMap((id) => questionsForChapter(id));
  const byDiff = { EASY: [], MEDIUM: [], HARD: [] };
  r.shuffle(pool).forEach((q) => byDiff[q.difficulty].push(q));
  const want = { EASY: Math.round(count * 0.4), MEDIUM: Math.round(count * 0.4) };
  want.HARD = count - want.EASY - want.MEDIUM;
  return ['EASY', 'MEDIUM', 'HARD'].flatMap((d) => byDiff[d].slice(0, want[d])).map((q) => q.questionId);
}

function makeTest({ id, classId, title, kind, chapterIds, count, minutes, marksPerQ = 1, negativeMarks = 0, seriesId = null, order = null, reattempt = false }) {
  return {
    id,
    classId,
    boardId: 'NCERT_CBSE',
    title,
    kind,
    chapterIds,
    questionIds: pickQuestions(chapterIds, count, id),
    durationSec: minutes * 60,
    marksPerQ,
    negativeMarks,
    allowNegativeTotal: false,
    totalMarks: count * marksPerQ,
    instructions: INSTRUCTIONS(minutes, count, marksPerQ, negativeMarks),
    reattempt,
    seriesId,
    order,
    status: 'PUBLISHED',
    publishFrom: '2026-09-01T00:00:00+05:30',
    publishTo: '2027-03-31T23:59:00+05:30',
  };
}

function build() {
  const tests = [];
  const series = [];
  Object.entries(CURRICULUM).forEach(([cls, chapters]) => {
    const c = Number(cls);
    chapters.slice(0, 6).forEach((ch, i) => {
      tests.push(makeTest({
        id: `t_c${c}_ch${i + 1}`, classId: c, title: `${ch.name} — Chapter Test`, kind: 'CHAPTER',
        chapterIds: [ch.id], count: 10, minutes: 15, reattempt: true,
      }));
    });
    tests.push(makeTest({
      id: `t_c${c}_full1`, classId: c, title: `Class ${c} Full Syllabus Mock Test`, kind: 'FULL',
      chapterIds: chapters.map((ch) => ch.id), count: 20, minutes: 30, marksPerQ: 2, negativeMarks: 0.5,
    }));

    const seriesId = `s_c${c}_term1`;
    const groups = [chapters.slice(0, 3), chapters.slice(3, 6), chapters.slice(6, 9), chapters];
    const seriesTests = groups.map((g, i) => makeTest({
      id: `t_c${c}_s1_${i + 1}`, classId: c,
      title: i === 3 ? 'Grand Test — Term 1' : `Unit Test ${i + 1}: ${g.map((ch) => ch.name).slice(0, 2).join(' & ')}${g.length > 2 ? ' +' : ''}`,
      kind: 'SERIES', chapterIds: g.map((ch) => ch.id), count: i === 3 ? 15 : 10, minutes: i === 3 ? 25 : 15,
      seriesId, order: i + 1,
    }));
    tests.push(...seriesTests);
    series.push({
      id: seriesId, classId: c, title: `Class ${c} — Term 1 Mastery Series`,
      description: 'Four tests that build up to a full Term 1 grand test. Each test unlocks after the previous one.',
      unlockMode: 'SEQUENTIAL', status: 'PUBLISHED', testIds: seriesTests.map((t) => t.id),
    });
  });
  return { tests, series };
}

export const TEST_CATALOG = build();

/** Deterministic simulated cohort scores (percent) for rank/percentile (F6-08). */
export function cohortScores(testId) {
  const r = seeded(`cohort:${testId}`);
  const n = testId.endsWith('_s1_4') ? 7 : r.int(18, 140); // one test deliberately below the 10-attempt threshold
  return Array.from({ length: n }, () => Math.max(0, Math.min(100, Math.round(62 + (r.next() + r.next() + r.next() - 1.5) * 45))));
}
