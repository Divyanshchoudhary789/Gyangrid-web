import { getDb, userState, persist } from './db';
import { seeded, hashString, uid as makeId } from '@/lib/random';
import { addDays } from '@/lib/date';
import { maskContact } from '@/lib/format';
import { CONSENT_TEXT_VERSION } from '@/config/constants';
import { CURRICULUM } from './content/curriculum';
import { TEST_CATALOG } from './content/tests';
import {
  today, servable, recordAttempt, awardXp, awardCoins, extendStreak, pushActivity, cfg, getQuestion,
} from './engine';
import { callDoubtSolver, refusal } from './ai';
import { createUser, pwHash } from './handlers/student';
import { gradeTest } from './handlers/assessment';

export const DEMO_STUDENT = { email: 'demo@gyaangrid.in', password: 'Demo@1234', name: 'Aarav Kumar' };

const at = (date, hh, mm) => `${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`;

function seedDemoStudent() {
  const u = createUser({ email: DEMO_STUDENT.email, name: DEMO_STUDENT.name, providers: ['password'], passwordHash: pwHash(DEMO_STUDENT.email, DEMO_STUDENT.password), emailVerified: true });
  const T = today();
  u.createdAt = at(addDays(T, -24), 16, 5);
  const contact = 'sunita.kumar@example.com';
  u.profile = {
    classId: 8,
    boardId: 'NCERT_CBSE',
    avatarId: 'fox',
    parent: { name: 'Sunita Kumar', relationship: 'Mother', contactType: 'EMAIL', contactMasked: maskContact(contact), contactHash: `h_${hashString(contact).toString(16)}`, contactEnc: 'enc:seed' },
    consent: { version: CONSENT_TEXT_VERSION, timestamp: u.createdAt, method: 'STUDENT_SELF_DECLARATION', contactHash: `h_${hashString(contact).toString(16)}`, selfDeclared: true },
    onboardedAt: u.createdAt,
  };
  const uid = u.uid;
  const st = userState(uid);
  const r = seeded('demo-history-v2');

  // Per-chapter skill so Progress shows clear strong / partial / weak topics
  const skill = { c8_ch01: 0.8, c8_ch02: 0.9, c8_ch03: 0.36, c8_ch05: 0.88, c8_ch07: 0.6, c8_ch08: 0.4, c8_ch09: 0.62, c8_ch10: 0.5, c8_ch11: 0.72 };
  const topicIds = CURRICULUM[8].filter((c) => skill[c.id] != null).flatMap((c) => c.topics.map((t) => ({ id: t.id, p: skill[c.id] })));
  const answerFor = (q, ok) => {
    if (ok) return q.correctAnswer;
    if (q.type === 'NUMERIC') {
      const c = Number(q.correctAnswer);
      return String(r.pick([c + r.int(1, 5), c - r.int(1, 4), -c || 3, c * 2 || 7]));
    }
    return r.pick(q.options.filter((o) => o.key !== q.correctAnswer)).key;
  };

  for (let back = 20; back >= 1; back -= 1) {
    const date = addDays(T, -back);
    const active = back <= 6 || (back !== 7 && r.next() > 0.3);
    if (!active) continue;

    if (back <= 6 || r.next() > 0.35) {
      const picks = r.shuffle(topicIds).slice(0, 5);
      const cid = `${uid}_${date}`;
      let score = 0;
      const qids = [];
      picks.forEach((t, i) => {
        const q = r.pick(servable(t.id).filter((x) => x.difficulty === ['EASY', 'EASY', 'MEDIUM', 'MEDIUM', 'HARD'][i]));
        const ok = r.next() < t.p;
        recordAttempt(uid, q, answerFor(q, ok), 'CHALLENGE', { refId: cid, timeSpentSec: r.int(30, 140), at: at(date, 18, 10 + i * 2), date });
        if (ok) score += 1;
        qids.push(q.questionId);
      });
      const scorePct = Math.round((score / 5) * 100);
      let xp = awardXp(uid, { type: 'DAILY_CHALLENGE', amount: cfg().xp.DAILY_CHALLENGE, eventId: `xp_${cid}`, label: 'Daily Challenge completed', at: at(date, 18, 22), date });
      if (score === 5) xp += awardXp(uid, { type: 'ALL_CORRECT_BONUS', amount: cfg().xp.ALL_CORRECT_BONUS, eventId: `xp_${cid}_perfect`, label: 'Perfect challenge bonus', at: at(date, 18, 22), date });
      let coins = 0;
      if (scorePct >= cfg().coins.DAILY_CHALLENGE.minScorePct) {
        coins = awardCoins(uid, { type: 'DAILY_CHALLENGE', amount: cfg().coins.DAILY_CHALLENGE.amount, sourceEventId: cid, label: 'Daily Challenge reward', at: at(date, 18, 22), date }).entry.amount;
      }
      const s = extendStreak(uid, date);
      st.challenges[date] = {
        id: cid, date, classId: 8, questionIds: qids, answers: {}, times: {}, status: 'SUBMITTED', startedAt: at(date, 18, 10), submittedAt: at(date, 18, 22),
        result: { challengeId: cid, date, score, total: 5, scorePct, xpAwarded: xp + s.milestoneXp, coinsAwarded: coins, mistakesSaved: 5 - score, diagnosis: [], questions: [], streak: { current: s.current } },
      };
      pushActivity(uid, { type: 'CHALLENGE', title: `Daily Challenge: ${score}/5`, detail: coins ? `+${xp} XP · +${coins} coins` : `+${xp} XP`, link: '/progress' }, at(date, 18, 22));
    }

    if (r.next() > 0.35) {
      const t = r.pick(topicIds);
      const setId = `ps_seed_${date}`;
      const n = r.int(4, 9);
      let correct = 0;
      r.shuffle(servable(t.id)).slice(0, n).forEach((q, i) => {
        const ok = r.next() < t.p;
        recordAttempt(uid, q, answerFor(q, ok), 'PRACTICE', { refId: setId, timeSpentSec: r.int(25, 120), at: at(date, 19, 5 + i), date });
        if (ok) {
          correct += 1;
          awardXp(uid, { type: 'PRACTICE_QUESTION', amount: cfg().xp.PRACTICE_QUESTION, eventId: `xp_${setId}_${q.questionId}`, capKey: 'PRACTICE', cap: cfg().xp.PRACTICE_DAILY_CAP, label: 'Practice question', at: at(date, 19, 5 + i), date });
        }
      });
      const topicName = CURRICULUM[8].flatMap((c) => c.topics).find((x) => x.id === t.id).name;
      pushActivity(uid, { type: 'PRACTICE', title: `Practised ${topicName}`, detail: `${correct}/${n} correct`, link: `/learn/topic/${t.id}` }, at(date, 19, 20));
    }
  }

  // Resolve a share of older mistakes via review, so the Mistake Bank has all three states
  Object.values(st.mistakes).forEach((m) => {
    const created = m.createdAt.slice(0, 10);
    if (created <= addDays(T, -6) && r.next() < 0.45) {
      const resolvedDate = addDays(created, 3);
      m.status = 'RESOLVED';
      m.resolvedAt = at(resolvedDate, 17, 40);
      m.reviewCount = 1;
      awardXp(uid, { type: 'MISTAKE_RESOLVED', amount: cfg().xp.MISTAKE_RESOLVED, eventId: `xp_resolve_${m.id}_1`, capKey: 'MISTAKE', cap: cfg().xp.MISTAKE_DAILY_CAP, label: 'Mistake resolved', at: m.resolvedAt, date: resolvedDate });
    }
  });
  const archivable = Object.values(st.mistakes).find((m) => m.status === 'ACTIVE' && /^c8_ch0[125]/.test(m.topicId));
  if (archivable) archivable.status = 'ARCHIVED';

  // Tests: one chapter test and the first series test already taken
  [['t_c8_ch2', 5, 0.85], ['t_c8_s1_1', 3, 0.6]].forEach(([testId, back, p]) => {
    const test = TEST_CATALOG.tests.find((t) => t.id === testId);
    const date = addDays(T, -back);
    const attempt = {
      id: makeId('ta_'), testId, classId: 8, startedAt: at(date, 17, 0), deadline: new Date(new Date(at(date, 17, 0)).getTime() + test.durationSec * 1000).toISOString(),
      answers: {}, marked: [], status: 'IN_PROGRESS', savedAt: at(date, 17, 10), autoSubmitted: false,
    };
    test.questionIds.forEach((qid, i) => {
      if (i === test.questionIds.length - 1 && testId === 't_c8_s1_1') return; // one skipped
      const q = getQuestion(qid);
      attempt.answers[qid] = answerFor(q, r.next() < p);
    });
    st.testAttempts[attempt.id] = attempt;
    gradeTest(uid, test, attempt, { at: at(date, 17, 12), date });
  });

  // Study history (feeds Continue Learning + Learning stats)
  [['c8_ch02_t1', 6], ['c8_ch09_t1', 4], ['c8_ch05_t2', 3], ['c8_ch09_t2', 1]].forEach(([topicId, back]) => {
    const d = addDays(T, -back);
    st.studied[topicId] = { at: at(d, 16, 30), date: d };
    st.topicViews.unshift({ topicId, at: at(d, 16, 30), seconds: 140 });
    pushActivity(uid, { type: 'STUDIED', title: 'Studied a topic', detail: CURRICULUM[8].flatMap((c) => c.topics).find((x) => x.id === topicId).name, link: `/learn/topic/${topicId}` }, at(d, 16, 31));
  });

  // Doubt history
  [
    { text: 'Solve 5x - 3 = 2x + 9', back: 2, outcome: 'UNDERSTOOD' },
    { text: 'Find the area of a triangle whose base is 14 cm and height is 9 cm', back: 4, outcome: 'UNDERSTOOD' },
    { text: 'Who is the prime minister of India?', back: 6, outcome: 'REFUSED' },
  ].forEach(({ text, back, outcome }, i) => {
    const date = addDays(T, -back);
    const id = `dbt_seed_${i}`;
    const base = { id, uid, classId: 8, inputType: 'TEXT', date, createdAt: at(date, 20, 15), input: { text, transcript: null, imageRef: null, ocrText: null }, imageDataUrl: null, rounds: [], followUps: [], rating: outcome === 'UNDERSTOOD' ? 'UP' : null, reported: false, flagged: false };
    if (outcome === 'REFUSED') {
      st.doubts.unshift({ ...base, scope: 'OUT_OF_SCOPE', status: 'CLOSED', response: refusal('OUT_OF_SCOPE') });
    } else {
      const response = callDoubtSolver({ text, classId: 8, seed: id });
      st.doubts.unshift({ ...base, scope: 'IN_SYLLABUS', status: 'UNDERSTOOD', family: i === 0 ? 'linear' : 'mensuration', topicId: response.topic_id, topicName: response.topic_name, response, reexplainCount: 0,
        followUps: [{ answer: String(response.follow_up_question.expected_answer), correct: true, at: at(date, 20, 18), expected: response.follow_up_question.expected_answer, explanation: response.follow_up_question.explanation }] });
      awardXp(uid, { type: 'DOUBT_UNDERSTOOD', amount: cfg().xp.DOUBT_UNDERSTOOD, eventId: `xp_${id}`, capKey: 'DOUBT', cap: cfg().xp.DOUBT_DAILY_CAP, label: 'Doubt understood', at: at(date, 20, 18), date });
      awardCoins(uid, { type: 'DOUBT_SOLVED', amount: cfg().coins.DOUBT_SOLVED.amount, sourceEventId: id, label: 'Doubt solved reward', at: at(date, 20, 18), date });
      pushActivity(uid, { type: 'DOUBT_UNDERSTOOD', title: 'Doubt solved', detail: response.topic_name, link: `/doubts/${id}` }, at(date, 20, 18));
    }
    st.doubtUsage[date] = { count: 1, images: 0 };
  });
  st.activity.sort((a, b) => b.at.localeCompare(a.at));
  st.coinLedger.sort((a, b) => a.awardedAt.localeCompare(b.awardedAt));
  let bal = 0;
  st.coinLedger.forEach((e) => { bal += e.amount; e.balanceAfter = bal; });
  return uid;
}

function seedAdmin(d, demoUid) {
  const T = today();
  const r = seeded('admin-seed');
  const first = ['Aditi', 'Rohan', 'Meera', 'Kabir', 'Ishaan', 'Tanvi', 'Arjun', 'Nisha', 'Vivaan', 'Sara', 'Dev', 'Anaya', 'Reyansh', 'Kiara', 'Om', 'Riya', 'Yash', 'Pari'];
  const last = ['S.', 'M.', 'P.', 'R.', 'K.', 'G.', 'N.', 'T.', 'B.', 'D.'];
  d.admin.syntheticStudents = Array.from({ length: 36 }, (_, i) => {
    const classId = 6 + (i % 5);
    const joined = addDays(T, -r.int(3, 120));
    return {
      id: `stu_${1000 + i}`, displayName: `${r.pick(first)} ${r.pick(last)}`, emailMasked: `${'abcdefghij'[i % 10]}${'klmnop'[i % 6]}•••@gmail.com`, classId,
      joinedAt: `${joined}T10:00:00+05:30`, lastActiveAt: `${addDays(T, -r.int(0, 9))}T19:00:00+05:30`, consent: true, status: i === 7 ? 'SUSPENDED' : 'ACTIVE', real: false,
      summary: { totalXp: r.int(120, 4200), goldCoins: r.int(10, 260), currentStreak: r.int(0, 21), accuracyOverall: r.int(38, 91), mistakes: { total: r.int(5, 80), active: r.int(1, 25), resolved: r.int(3, 50), dueForReviewToday: r.int(0, 6) }, strong: [], weak: [] },
    };
  });
  d.admin.kbDocs = [
    { id: 'kb_1', name: 'NCERT Class 8 Mathematics (2026-27).pdf', classId: 8, sizeKb: 14200, status: 'INDEXED', uploadedBy: 'content@gyaangrid.in', uploadedAt: `${addDays(T, -30)}T11:00:00+05:30`, lastSyncAt: `${addDays(T, -2)}T02:00:00+05:30`, chunks: 2360 },
    { id: 'kb_2', name: 'NCERT Class 9 Mathematics (2026-27).pdf', classId: 9, sizeKb: 16800, status: 'INDEXED', uploadedBy: 'content@gyaangrid.in', uploadedAt: `${addDays(T, -30)}T11:05:00+05:30`, lastSyncAt: `${addDays(T, -2)}T02:00:00+05:30`, chunks: 2710 },
    { id: 'kb_3', name: 'Gyaangrid worked-solutions handbook — Algebra.docx', classId: null, sizeKb: 860, status: 'INDEXED', uploadedBy: 'content@gyaangrid.in', uploadedAt: `${addDays(T, -12)}T15:20:00+05:30`, lastSyncAt: `${addDays(T, -12)}T15:24:00+05:30`, chunks: 140 },
    { id: 'kb_4', name: 'Common misconceptions — Geometry (teacher notes).pdf', classId: null, sizeKb: 2100, status: 'FAILED', error: 'Scanned PDF without a text layer. Upload a searchable PDF.', uploadedBy: 'content@gyaangrid.in', uploadedAt: `${addDays(T, -1)}T09:10:00+05:30`, lastSyncAt: null, chunks: 0 },
  ];
  const q1 = CURRICULUM[8][2].topics[0].id;
  d.admin.moderation = [
    { id: 'mod_1', type: 'QUESTION_REPORT', status: 'OPEN', questionId: servable(q1)[3].questionId, reason: 'WRONG_ANSWER', note: 'I think the answer should be different', reportedBy: 'stu_1004', at: `${addDays(T, -1)}T18:40:00+05:30` },
    { id: 'mod_2', type: 'AI_ANSWER_REPORT', status: 'OPEN', doubtId: 'dbt_x91', reason: 'The steps skipped a part I did not understand', at: `${addDays(T, -1)}T21:05:00+05:30`, studentRef: 'stu_101…', topicName: 'Standard Identities', snapshot: { input: 'expand (2x+3)^2', concept: 'Algebraic identities and simplification', steps: ['Use (a + b)^2 = a^2 + 2ab + b^2', 'a = 2x, b = 3', '4x^2 + 12x + 9'] } },
    { id: 'mod_3', type: 'QUESTION_REPORT', status: 'OPEN', questionId: servable(CURRICULUM[8][6].topics[1].id)[8].questionId, reason: 'UNCLEAR', note: 'Not sure what GST means here', reportedBy: 'stu_1011', at: `${addDays(T, -2)}T17:12:00+05:30` },
    { id: 'mod_4', type: 'AI_ANSWER_REPORT', status: 'RESOLVED', resolution: 'ANNOTATED_KB', doubtId: 'dbt_x55', reason: 'Used a formula we have not learnt', at: `${addDays(T, -5)}T20:00:00+05:30`, resolvedBy: 'support@gyaangrid.in', resolvedAt: `${addDays(T, -4)}T10:00:00+05:30`, studentRef: 'stu_102…', topicName: 'Compound Interest' },
  ];
  d.admin.audit = [
    { id: 'aud_s1', at: `${addDays(T, -1)}T10:15:00+05:30`, actor: 'Venkat (Owner) <superadmin@gyaangrid.in>', role: 'SUPER_ADMIN', action: 'CONFIG_UPDATED', target: 'config v7', before: { version: 6 }, after: { version: 7, note: 'Coin value for Daily Challenge 8 → 10' } },
    { id: 'aud_s2', at: `${addDays(T, -2)}T12:30:00+05:30`, actor: 'Priya — Content <content@gyaangrid.in>', role: 'CONTENT_MANAGER', action: 'QUESTIONS_BULK_IMPORTED', target: '120 rows', before: null, after: { imported: 117, rejected: 3 } },
    { id: 'aud_s3', at: `${addDays(T, -2)}T12:45:00+05:30`, actor: 'Priya — Content <content@gyaangrid.in>', role: 'CONTENT_MANAGER', action: 'TEST_CREATED', target: 't_c8_full1', before: null, after: { status: 'PUBLISHED' } },
    { id: 'aud_s4', at: `${addDays(T, -3)}T09:00:00+05:30`, actor: 'Rahul — Support <support@gyaangrid.in>', role: 'SUPPORT', action: 'MODERATION_ANNOTATED_KB', target: 'mod_4', before: { status: 'OPEN' }, after: { status: 'RESOLVED' } },
    { id: 'aud_s5', at: `${addDays(T, -6)}T16:20:00+05:30`, actor: 'Venkat (Owner) <superadmin@gyaangrid.in>', role: 'SUPER_ADMIN', action: 'STUDENT_SUSPEND', target: 'stu_1007', before: { status: 'ACTIVE' }, after: { status: 'SUSPENDED' } },
  ];
  d.admin.configHistory = [{ version: 7, at: `${addDays(T, -1)}T10:15:00+05:30`, by: 'superadmin@gyaangrid.in', note: 'Coin value for Daily Challenge 8 → 10', before: null }];
  return demoUid;
}

let seeding = false;
export function ensureSeeded() {
  const d = getDb();
  if (d.seeded || seeding) return;
  seeding = true;
  try {
    const uid = seedDemoStudent();
    seedAdmin(d, uid);
    d.seeded = true;
    persist();
  } finally {
    seeding = false;
  }
}
