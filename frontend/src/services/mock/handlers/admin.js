import { ApiError, ERROR_CODES } from '../../errors';
import { getDb, userState } from '../db';
import { seeded, uid as makeId } from '@/lib/random';
import { addDays, istDateKey } from '@/lib/date';
import { maskContact } from '@/lib/format';
import { CURRICULUM, getChapter } from '../content/curriculum';
import { questionsForClass } from '../content/questionBank';
import { defaultMaterialFor } from '../content/materials';
import { cfg, curriculumFor, getQuestion, topicMeta, testCatalog, summary, strongWeak } from '../engine';

const SA = 'SUPER_ADMIN';
const CM = 'CONTENT_MANAGER';
const SU = 'SUPPORT';
const nowIso = () => new Date().toISOString();

export const ADMIN_ACCOUNTS = [
  { email: 'superadmin@gyaangrid.in', password: 'Admin@1234', name: 'Venkat (Owner)', role: SA },
  { email: 'content@gyaangrid.in', password: 'Content@1234', name: 'Priya — Content', role: CM },
  { email: 'support@gyaangrid.in', password: 'Support@1234', name: 'Rahul — Support', role: SU },
];

/** F12-11: every content, config, role and student-data action is audited with before/after. */
function audit(admin, action, target, before = null, after = null) {
  getDb().admin.audit.unshift({ id: makeId('aud_'), at: nowIso(), actor: `${admin.name} <${admin.email}>`, role: admin.role, action, target, before, after });
}

const trimTo = (s, n) => String(s ?? '').trim().slice(0, n);

/* ------------------------------------------------------------------ auth with 2FA (F12-01, SEC-14) */

function adminLogin({ body }) {
  const acct = ADMIN_ACCOUNTS.find((a) => a.email === String(body.email || '').toLowerCase());
  if (!acct || acct.password !== body.password) throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Incorrect email or password.', { status: 401 });
  const challengeId = makeId('otp_');
  getDb().admin.pendingOtp[challengeId] = { email: acct.email, code: '123456', expiresAt: Date.now() + 5 * 60 * 1000, tries: 0 };
  return { challengeId, method: 'AUTHENTICATOR_APP', hint: 'Demo code: 123456' };
}

function adminVerify({ body }) {
  const d = getDb();
  const p = d.admin.pendingOtp[body.challengeId];
  if (!p || p.expiresAt < Date.now()) throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'This code has expired. Please sign in again.', { status: 401 });
  p.tries += 1;
  if (p.tries > 5) {
    delete d.admin.pendingOtp[body.challengeId];
    throw new ApiError(ERROR_CODES.RATE_LIMITED, 'Too many attempts. Please sign in again.', { status: 429 });
  }
  if (String(body.code) !== p.code) throw new ApiError(ERROR_CODES.VALIDATION, 'That code is not correct.');
  delete d.admin.pendingOtp[body.challengeId];
  const acct = ADMIN_ACCOUNTS.find((a) => a.email === p.email);
  const token = `adm.${makeId()}.${makeId()}`;
  const session = { email: acct.email, name: acct.name, role: acct.role, since: nowIso() };
  d.admin.adminSessions[token] = session;
  audit(session, 'ADMIN_SIGN_IN', acct.email);
  return { token, admin: session };
}

const adminMe = ({ admin }) => admin;
const adminLogout = ({ token }) => { delete getDb().admin.adminSessions[token]; return { ok: true }; };

/* ------------------------------------------------------------------ dashboard / analytics (F12-10) */

function dashboard() {
  const d = getDb();
  const r = seeded(`dash:${istDateKey()}`);
  const realStudents = Object.values(d.users).filter((u) => !u.deletedAt);
  const synthetic = d.admin.syntheticStudents || [];
  const days = Array.from({ length: 14 }, (_, i) => addDays(istDateKey(), i - 13));
  const series = days.map((date, i) => {
    const base = 1800 + i * 45;
    const dau = Math.round(base + r.int(-140, 180));
    return {
      date: date.slice(5),
      dau,
      challenges: Math.round(dau * (0.55 + r.next() * 0.12)),
      doubts: Math.round(dau * (0.38 + r.next() * 0.1)),
      registrations: r.int(40, 130),
      aiCostInr: Math.round(dau * 0.42 + r.int(-60, 60)),
    };
  });
  const last = series[series.length - 1];
  const weakTopics = [
    ['c8_ch03_t1', 41], ['c8_ch08_t2', 44], ['c7_ch07_t2', 46], ['c9_ch02_t3', 48], ['c10_ch08_t2', 51], ['c6_ch06_t3', 53],
  ].map(([id, acc]) => ({ topicId: id, name: topicMeta(id)?.name, classId: topicMeta(id)?.classId, accuracy: acc }));
  const openModeration = d.admin.moderation.filter((m) => m.status === 'OPEN').length;
  return {
    kpis: {
      registrations: 48210 + realStudents.length + synthetic.length,
      dau: last.dau,
      wau: Math.round(last.dau * 3.4),
      challengeCompletion: Math.round((last.challenges / last.dau) * 100),
      doubtsToday: last.doubts,
      aiTokensToday: last.doubts * 2350,
      aiCostTodayInr: last.aiCostInr,
      monthBudgetUsedPct: 63,
      openModeration,
      approvedQuestions: Object.keys(CURRICULUM).reduce((s, c) => s + questionsForClass(Number(c)).length, 0) + d.admin.customQuestions.filter((q) => q.status === 'APPROVED').length,
      reviewQueue: d.admin.customQuestions.filter((q) => q.status === 'IN_REVIEW').length,
    },
    series,
    weakTopics,
    configVersion: cfg().version,
  };
}

/* ------------------------------------------------------------------ curriculum (F12-02) */

function locateChapter(id) {
  const d = getDb();
  for (const [cls, list] of Object.entries(d.admin.customChapters)) {
    const ch = list.find((c) => c.id === id);
    if (ch) return { custom: true, ch, classId: Number(cls) };
  }
  const base = getChapter(id);
  if (base) return { custom: false, ch: base, classId: base.classId };
  throw new ApiError(ERROR_CODES.NOT_FOUND, 'Chapter not found.', { status: 404 });
}

function adminCurriculum({ query }) {
  const classId = Number(query.classId) || 8;
  return {
    classId,
    chapters: curriculumFor(classId, { includeUnpublished: true }).map((ch) => ({
      id: ch.id, name: ch.name, status: ch.status, order: ch.order, custom: Boolean(ch.custom),
      topics: [...ch.topics].sort((a, b) => (a.order ?? a.number) - (b.order ?? b.number)).map((t) => ({ id: t.id, name: t.name, status: t.status, order: t.order ?? t.number })),
    })),
  };
}

function createChapter({ admin, body }) {
  const classId = Number(body.classId);
  const name = trimTo(body.name, 80);
  if (!CURRICULUM[classId] || name.length < 3) throw new ApiError(ERROR_CODES.VALIDATION, 'Enter a chapter name (3+ characters).');
  const d = getDb();
  const list = d.admin.customChapters[classId] || (d.admin.customChapters[classId] = []);
  const count = curriculumFor(classId, { includeUnpublished: true }).length;
  const ch = { id: `c${classId}_x${makeId().slice(-5)}`, classId, boardId: 'NCERT_CBSE', subjectId: 'MATHS', number: count + 1, name, family: 'linear', code: 'NEW', status: 'DRAFT', order: count + 1, custom: true, topics: [] };
  list.push(ch);
  audit(admin, 'CHAPTER_CREATED', ch.id, null, { name, classId });
  return ch;
}

function updateChapter({ admin, params, body }) {
  const { custom, ch } = locateChapter(params.id);
  const d = getDb();
  const before = { name: ch.name, status: ch.status };
  const patch = {};
  if (body.name) patch.name = trimTo(body.name, 80);
  if (body.status && ['DRAFT', 'PUBLISHED', 'RETIRED'].includes(body.status)) patch.status = body.status;
  if (custom) Object.assign(ch, patch);
  else d.admin.curriculumOverrides[ch.id] = { ...(d.admin.curriculumOverrides[ch.id] || {}), ...patch };
  audit(admin, 'CHAPTER_UPDATED', ch.id, before, patch);
  return { ok: true };
}

function reorderChapters({ admin, body }) {
  const d = getDb();
  (body.chapterIds || []).forEach((id, i) => {
    const { custom, ch } = locateChapter(id);
    if (custom) ch.order = i + 1;
    else d.admin.curriculumOverrides[id] = { ...(d.admin.curriculumOverrides[id] || {}), order: i + 1 };
  });
  audit(admin, 'CHAPTERS_REORDERED', `class ${body.classId}`, null, { order: body.chapterIds });
  return { ok: true };
}

function addTopic({ admin, params, body }) {
  const { custom, ch } = locateChapter(params.id);
  const name = trimTo(body.name, 80);
  if (name.length < 3) throw new ApiError(ERROR_CODES.VALIDATION, 'Enter a topic name (3+ characters).');
  const d = getDb();
  const topic = { id: `${ch.id}_x${makeId().slice(-4)}`, chapterId: ch.id, classId: ch.classId, number: 99, order: 99, name, family: ch.family, status: 'DRAFT' };
  if (custom) ch.topics.push(topic);
  else {
    const ov = d.admin.curriculumOverrides[ch.id] || (d.admin.curriculumOverrides[ch.id] = {});
    ov.extraTopics = [...(ov.extraTopics || []), topic];
  }
  audit(admin, 'TOPIC_CREATED', topic.id, null, { name, chapterId: ch.id });
  return topic;
}

function updateTopic({ admin, params, body }) {
  const d = getDb();
  const t = topicMeta(params.id);
  if (!t) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Topic not found.', { status: 404 });
  const patch = {};
  if (body.name) patch.name = trimTo(body.name, 80);
  if (body.status && ['DRAFT', 'PUBLISHED', 'RETIRED'].includes(body.status)) patch.status = body.status;
  if (body.order != null) patch.order = Number(body.order);
  const { custom, ch } = locateChapter(t.chapterId);
  const extra = custom ? ch.topics : d.admin.curriculumOverrides[ch.id]?.extraTopics || [];
  const obj = extra.find((x) => x.id === t.id);
  if (obj) Object.assign(obj, patch);
  else d.admin.curriculumOverrides[t.id] = { ...(d.admin.curriculumOverrides[t.id] || {}), ...patch };
  audit(admin, 'TOPIC_UPDATED', t.id, { name: t.name, status: t.status }, patch);
  return { ok: true };
}

function reorderTopics({ admin, params, body }) {
  (body.topicIds || []).forEach((id, i) => updateTopic({ admin: { ...admin, silent: true }, params: { id }, body: { order: i + 1 } }));
  audit(admin, 'TOPICS_REORDERED', params.id, null, { order: body.topicIds });
  return { ok: true };
}

/* ------------------------------------------------------------------ study material (F12-03, F3-03/04) */

function getMaterial({ params }) {
  const t = topicMeta(params.topicId);
  if (!t) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Topic not found.', { status: 404 });
  const d = getDb();
  const current = d.admin.materials[params.topicId] || defaultMaterialFor(params.topicId) || { topicId: params.topicId, title: `${t.name} — Notes`, status: 'DRAFT', version: 0, blocks: [{ type: 'TEXT', body: `## ${t.name}\n` }] };
  return { topic: { id: t.id, name: t.name, chapterName: t.chapterName, classId: t.classId }, material: current, history: d.admin.materialHistory[params.topicId] || [] };
}

function saveMaterial({ admin, params, body }) {
  const t = topicMeta(params.topicId);
  if (!t) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Topic not found.', { status: 404 });
  const d = getDb();
  const prev = d.admin.materials[params.topicId] || defaultMaterialFor(params.topicId);
  const blocks = [];
  const text = String(body.body || '').slice(0, 20000);
  if (!text.trim()) throw new ApiError(ERROR_CODES.VALIDATION, 'Material text cannot be empty.');
  blocks.push({ type: 'TEXT', body: text });
  if (body.pdf?.title) blocks.push({ type: 'PDF', title: trimTo(body.pdf.title, 120), pages: Number(body.pdf.pages) || 1, url: body.pdf.url || `mock://pdf/${params.topicId}` });
  if (body.video?.url) {
    if (!/^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//.test(body.video.url) && !body.video.url.startsWith('mock://')) {
      throw new ApiError(ERROR_CODES.VALIDATION, 'Video links must be https YouTube or Vimeo URLs.');
    }
    blocks.push({ type: 'VIDEO', title: trimTo(body.video.title || 'Video lesson', 120), url: body.video.url, durationSec: Number(body.video.durationSec) || null });
  }
  const status = ['DRAFT', 'PUBLISHED', 'RETIRED'].includes(body.status) ? body.status : 'DRAFT';
  const next = { id: `mat_${params.topicId}`, topicId: params.topicId, title: trimTo(body.title || `${t.name} — Notes`, 120), status, version: (prev?.version || 0) + 1, updatedAt: nowIso(), updatedBy: admin.email, blocks };
  if (prev) (d.admin.materialHistory[params.topicId] = d.admin.materialHistory[params.topicId] || []).unshift({ version: prev.version, status: prev.status, updatedAt: prev.updatedAt, updatedBy: prev.updatedBy || 'seed' });
  d.admin.materials[params.topicId] = next;
  audit(admin, 'MATERIAL_SAVED', params.topicId, prev ? { version: prev.version, status: prev.status } : null, { version: next.version, status });
  return next;
}

/* ------------------------------------------------------------------ question bank (F12-04, F4-01..03) */

const QTYPES = ['MCQ_SINGLE', 'NUMERIC'];
const DIFFS = ['EASY', 'MEDIUM', 'HARD'];

function allAdminQuestions(classId) {
  const d = getDb();
  const base = questionsForClass(classId).map((q) => ({ ...q, ...(d.admin.questionOverrides[q.questionId] || {}) }));
  return [...d.admin.customQuestions.filter((q) => q.classId === classId), ...base];
}

function listQuestions({ query }) {
  const classId = Number(query.classId) || 8;
  let list = allAdminQuestions(classId);
  if (query.chapterId) list = list.filter((q) => q.chapterId === query.chapterId);
  if (query.topicId) list = list.filter((q) => q.topicId === query.topicId);
  if (query.difficulty) list = list.filter((q) => q.difficulty === query.difficulty);
  if (query.status) list = list.filter((q) => q.status === query.status);
  if (query.source) list = list.filter((q) => q.source === query.source);
  if (query.q) {
    const s = query.q.toLowerCase();
    list = list.filter((q) => q.questionId.toLowerCase().includes(s) || q.questionText.toLowerCase().includes(s));
  }
  const pageSize = Math.min(50, Number(query.pageSize) || 15);
  const page = Math.max(1, Number(query.page) || 1);
  return {
    total: list.length,
    page,
    pageSize,
    items: list.slice((page - 1) * pageSize, page * pageSize).map((q) => ({
      questionId: q.questionId, questionText: q.questionText, type: q.type, difficulty: q.difficulty, status: q.status, source: q.source,
      topicId: q.topicId, topicName: topicMeta(q.topicId)?.name, chapterName: topicMeta(q.topicId)?.chapterName, stats: q.stats, version: q.version, updatedAt: q.updatedAt,
    })),
  };
}

function getAdminQuestion({ params }) {
  const q = getQuestion(params.id);
  if (!q) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Question not found.', { status: 404 });
  return { ...q, topicName: topicMeta(q.topicId)?.name, chapterName: topicMeta(q.topicId)?.chapterName };
}

function validateQuestion(q, { forApproval = false } = {}) {
  const errs = [];
  const t = topicMeta(q.topicId);
  if (!t) errs.push('Choose a valid topic.');
  if (!QTYPES.includes(q.type)) errs.push('Type must be MCQ_SINGLE or NUMERIC.');
  if (!DIFFS.includes(q.difficulty)) errs.push('Difficulty must be EASY, MEDIUM or HARD.');
  if (!q.questionText || q.questionText.trim().length < 5) errs.push('Question text is too short.');
  if (q.type === 'MCQ_SINGLE') {
    const opts = (q.options || []).filter((o) => o.text && o.text.trim());
    if (opts.length < 2) errs.push('Add at least 2 options.');
    if (!opts.some((o) => o.key === q.correctAnswer)) errs.push('Pick the correct option.');
  }
  if (q.type === 'NUMERIC' && (q.correctAnswer === '' || Number.isNaN(Number(q.correctAnswer)))) errs.push('Correct answer must be a number.');
  const hasExplanation = Array.isArray(q.explanation) ? q.explanation.some((s) => s.trim()) : Boolean(String(q.explanation || '').trim());
  if (forApproval && !hasExplanation) errs.push('A question cannot be approved without an explanation.'); // F4-02
  return errs;
}

function normaliseQuestionInput(body, t) {
  const explanation = Array.isArray(body.explanation) ? body.explanation : String(body.explanation || '').split('\n');
  return {
    topicId: body.topicId,
    chapterId: t?.chapterId,
    classId: t?.classId,
    boardId: 'NCERT_CBSE',
    subjectId: 'MATHS',
    type: body.type,
    difficulty: body.difficulty,
    questionText: trimTo(body.questionText, 2000),
    questionImageUrl: body.questionImageUrl || null,
    options: body.type === 'MCQ_SINGLE' ? (body.options || []).slice(0, 6).map((o, i) => ({ key: 'ABCDEF'[i], text: trimTo(o.text, 400) })) : [],
    correctAnswer: String(body.correctAnswer ?? '').trim(),
    answerTolerance: Number(body.answerTolerance) || 0,
    explanation: explanation.map((s) => s.trim()).filter(Boolean),
    conceptNote: trimTo(body.conceptNote, 1500) || null,
    estimatedTimeSec: Number(body.estimatedTimeSec) || 60,
    tags: (body.tags || []).slice(0, 10),
  };
}

function createQuestion({ admin, body }) {
  const t = topicMeta(body.topicId);
  const q = normaliseQuestionInput(body, t);
  const errs = validateQuestion(q);
  if (errs.length) throw new ApiError(ERROR_CODES.VALIDATION, errs[0], { details: { errors: errs } });
  const d = getDb();
  const seq = String(9000 + d.admin.customQuestions.length).padStart(4, '0');
  const full = {
    ...q, questionId: `Q-C${t.classId}-${t.code || 'GEN'}-${seq}`, source: body.source === 'AI_GENERATED' ? 'AI_GENERATED' : 'CLIENT_APPROVED',
    status: body.submitForReview ? 'IN_REVIEW' : 'DRAFT', stats: { attempts: 0, correct: 0, avgTimeSec: 0 }, version: 1, createdBy: admin.email, updatedAt: nowIso(),
  };
  d.admin.customQuestions.unshift(full);
  audit(admin, 'QUESTION_CREATED', full.questionId, null, { status: full.status, topicId: full.topicId });
  return full;
}

function updateQuestion({ admin, params, body }) {
  const d = getDb();
  const current = getQuestion(params.id);
  if (!current) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Question not found.', { status: 404 });
  const t = topicMeta(body.topicId || current.topicId);
  const q = normaliseQuestionInput({ ...current, ...body }, t);
  const errs = validateQuestion(q, { forApproval: current.status === 'APPROVED' });
  if (errs.length) throw new ApiError(ERROR_CODES.VALIDATION, errs[0], { details: { errors: errs } });
  const patch = { ...q, version: (current.version || 1) + 1, updatedAt: nowIso(), updatedBy: admin.email };
  const custom = d.admin.customQuestions.find((x) => x.questionId === params.id);
  if (custom) Object.assign(custom, patch);
  else d.admin.questionOverrides[params.id] = { ...(d.admin.questionOverrides[params.id] || {}), ...patch };
  audit(admin, 'QUESTION_EDITED', params.id, { version: current.version, text: current.questionText.slice(0, 80) }, { version: patch.version, text: patch.questionText.slice(0, 80) });
  return getQuestion(params.id);
}

function setQuestionStatus({ admin, params, body }) {
  const d = getDb();
  const q = getQuestion(params.id);
  if (!q) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Question not found.', { status: 404 });
  const status = body.status;
  if (!['DRAFT', 'IN_REVIEW', 'APPROVED', 'RETIRED'].includes(status)) throw new ApiError(ERROR_CODES.VALIDATION, 'Invalid status.');
  if (status === 'APPROVED') {
    const errs = validateQuestion(q, { forApproval: true });
    if (errs.length) throw new ApiError(ERROR_CODES.VALIDATION, errs[0], { details: { errors: errs } });
  }
  const custom = d.admin.customQuestions.find((x) => x.questionId === params.id);
  if (custom) Object.assign(custom, { status, updatedAt: nowIso() });
  else d.admin.questionOverrides[params.id] = { ...(d.admin.questionOverrides[params.id] || {}), status, updatedAt: nowIso() };
  audit(admin, `QUESTION_${status}`, params.id, { status: q.status }, { status });
  return getQuestion(params.id);
}

function duplicateQuestion({ admin, params }) {
  const q = getQuestion(params.id);
  if (!q) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Question not found.', { status: 404 });
  return createQuestion({ admin, body: { ...q, questionText: `${q.questionText}`, submitForReview: false } });
}

/** Bulk import: row-level validation report before commit (F4-01). */
function validateImport({ body }) {
  const rows = (body.rows || []).slice(0, 2000);
  return {
    rows: rows.map((row, i) => {
      const t = topicMeta(row.topicId);
      const q = normaliseQuestionInput({
        ...row,
        options: row.type === 'MCQ_SINGLE' ? ['A', 'B', 'C', 'D'].map((k) => ({ text: row[`option${k}`] || '' })).filter((o) => o.text) : [],
        explanation: String(row.explanation || '').split('|'),
      }, t);
      const errors = validateQuestion(q, { forApproval: true });
      return { row: i + 2, questionText: q.questionText.slice(0, 80), topicName: t?.name || row.topicId, valid: errors.length === 0, errors, normalised: q };
    }),
  };
}

function commitImport({ admin, body }) {
  const report = validateImport({ body });
  const valid = report.rows.filter((r) => r.valid);
  valid.forEach((r) => createQuestion({ admin: { ...admin }, body: { ...r.normalised, submitForReview: true } }));
  audit(admin, 'QUESTIONS_BULK_IMPORTED', `${valid.length} rows`, null, { imported: valid.length, rejected: report.rows.length - valid.length });
  return { imported: valid.length, rejected: report.rows.length - valid.length };
}

/* ------------------------------------------------------------------ tests & series builder (F12-05, F6-01/02) */

function adminTests({ query }) {
  const classId = Number(query.classId) || 8;
  const { tests, series } = testCatalog();
  return {
    tests: tests.filter((t) => t.classId === classId).map((t) => ({ ...t, questionCount: t.questionIds.length, chapters: t.chapterIds.map((id) => getChapter(id)?.name || id) })),
    series: series.filter((s) => s.classId === classId),
  };
}

function validateTest(b) {
  const errs = [];
  if (!b.title || b.title.trim().length < 4) errs.push('Enter a test title.');
  if (!(b.durationSec >= 60)) errs.push('Duration must be at least 1 minute.');
  if (!(b.marksPerQ > 0)) errs.push('Marks per question must be positive.');
  if (b.negativeMarks < 0) errs.push('Negative marks cannot be below 0.');
  if (!b.questionIds?.length) errs.push('Attach at least one question.');
  const unapproved = (b.questionIds || []).filter((id) => getQuestion(id)?.status !== 'APPROVED');
  if (unapproved.length) errs.push(`${unapproved.length} question(s) are not approved.`);
  return errs;
}

function saveTest({ admin, params, body }) {
  const d = getDb();
  const payload = {
    title: trimTo(body.title, 120), kind: ['CHAPTER', 'FULL', 'SERIES'].includes(body.kind) ? body.kind : 'CHAPTER', classId: Number(body.classId),
    chapterIds: body.chapterIds || [], questionIds: [...new Set(body.questionIds || [])], durationSec: Number(body.durationSec), marksPerQ: Number(body.marksPerQ) || 1,
    negativeMarks: Number(body.negativeMarks) || 0, allowNegativeTotal: Boolean(body.allowNegativeTotal), reattempt: Boolean(body.reattempt),
    instructions: (body.instructions || []).map((s) => trimTo(s, 300)).filter(Boolean), status: ['DRAFT', 'PUBLISHED'].includes(body.status) ? body.status : 'DRAFT',
    publishFrom: body.publishFrom || null, publishTo: body.publishTo || null,
  };
  payload.totalMarks = payload.questionIds.length * payload.marksPerQ;
  if (payload.status === 'PUBLISHED') {
    const errs = validateTest(payload);
    if (errs.length) throw new ApiError(ERROR_CODES.VALIDATION, errs[0], { details: { errors: errs } });
  }
  if (params.id) {
    const custom = d.admin.customTests.find((t) => t.id === params.id);
    if (custom) Object.assign(custom, payload);
    else d.admin.testOverrides[params.id] = { ...(d.admin.testOverrides[params.id] || {}), ...payload };
    audit(admin, 'TEST_UPDATED', params.id, null, { status: payload.status, questions: payload.questionIds.length });
    return { id: params.id, ...payload };
  }
  const t = { id: `t_custom_${makeId().slice(-6)}`, seriesId: null, order: null, boardId: 'NCERT_CBSE', ...payload };
  d.admin.customTests.unshift(t);
  audit(admin, 'TEST_CREATED', t.id, null, { title: t.title, status: t.status });
  return t;
}

function saveSeries({ admin, params, body }) {
  const d = getDb();
  const payload = {
    title: trimTo(body.title, 120), description: trimTo(body.description, 400), classId: Number(body.classId),
    unlockMode: body.unlockMode === 'OPEN' ? 'OPEN' : 'SEQUENTIAL', status: ['DRAFT', 'PUBLISHED'].includes(body.status) ? body.status : 'DRAFT', testIds: body.testIds || [],
  };
  if (payload.title.length < 4) throw new ApiError(ERROR_CODES.VALIDATION, 'Enter a series title.');
  if (payload.status === 'PUBLISHED' && !payload.testIds.length) throw new ApiError(ERROR_CODES.VALIDATION, 'Add at least one test to publish the series.');
  const { tests } = testCatalog();
  const applyOrder = () => payload.testIds.forEach((id, i) => {
    const custom = d.admin.customTests.find((t) => t.id === id);
    const seriesId = params.id || payload.id;
    if (custom) Object.assign(custom, { seriesId, order: i + 1, kind: 'SERIES' });
    else if (tests.find((t) => t.id === id)) d.admin.testOverrides[id] = { ...(d.admin.testOverrides[id] || {}), seriesId, order: i + 1 };
  });
  if (params.id) {
    const custom = d.admin.customSeries.find((s) => s.id === params.id);
    if (custom) Object.assign(custom, payload);
    else d.admin.seriesOverrides[params.id] = { ...(d.admin.seriesOverrides[params.id] || {}), ...payload };
    applyOrder();
    audit(admin, 'SERIES_UPDATED', params.id, null, { status: payload.status, tests: payload.testIds.length });
    return { id: params.id, ...payload };
  }
  payload.id = `s_custom_${makeId().slice(-6)}`;
  d.admin.customSeries.unshift(payload);
  applyOrder();
  audit(admin, 'SERIES_CREATED', payload.id, null, { title: payload.title });
  return payload;
}

/* ------------------------------------------------------------------ AI knowledge base (F12-06) */

function refreshKb() {
  getDb().admin.kbDocs.forEach((doc) => {
    if (doc.status === 'INDEXING' && Date.now() - new Date(doc.syncStartedAt).getTime() > 4000) {
      doc.status = 'INDEXED';
      doc.lastSyncAt = nowIso();
      doc.chunks = Math.max(8, Math.round(doc.sizeKb / 6));
    }
  });
}

function listKb() {
  refreshKb();
  const docs = getDb().admin.kbDocs;
  return { docs, vectorStore: { id: 'vs_••••••3f9a', totalChunks: docs.filter((x) => x.status === 'INDEXED').reduce((s, x) => s + (x.chunks || 0), 0), lastSyncAt: docs.map((x) => x.lastSyncAt).filter(Boolean).sort().pop() || null } };
}

function uploadKb({ admin, body }) {
  const name = trimTo(body.name, 140);
  if (!/\.(pdf|docx|txt|md)$/i.test(name)) throw new ApiError(ERROR_CODES.VALIDATION, 'Upload a PDF, DOCX, TXT or MD file.');
  if (!(body.sizeKb > 0) || body.sizeKb > 20 * 1024) throw new ApiError(ERROR_CODES.VALIDATION, 'Files must be under 20 MB.');
  const doc = { id: makeId('kb_'), name, classId: Number(body.classId) || null, sizeKb: Math.round(body.sizeKb), status: 'INDEXING', uploadedBy: admin.email, uploadedAt: nowIso(), syncStartedAt: nowIso(), lastSyncAt: null, chunks: 0 };
  getDb().admin.kbDocs.unshift(doc);
  audit(admin, 'KB_DOCUMENT_UPLOADED', doc.id, null, { name });
  return doc;
}

function reindexKb({ admin, params }) {
  const doc = getDb().admin.kbDocs.find((x) => x.id === params.id);
  if (!doc) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Document not found.', { status: 404 });
  Object.assign(doc, { status: 'INDEXING', syncStartedAt: nowIso() });
  audit(admin, 'KB_REINDEX_TRIGGERED', doc.id);
  return doc;
}

function removeKb({ admin, params }) {
  const d = getDb();
  const doc = d.admin.kbDocs.find((x) => x.id === params.id);
  if (!doc) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Document not found.', { status: 404 });
  d.admin.kbDocs = d.admin.kbDocs.filter((x) => x.id !== params.id);
  audit(admin, 'KB_DOCUMENT_REMOVED', doc.id, { name: doc.name }, null);
  return { removed: true };
}

/* ------------------------------------------------------------------ remote config (F12-07) */

const getConfig = () => ({ config: cfg(), history: getDb().admin.configHistory.slice(0, 20) });

function putConfig({ admin, body }) {
  const d = getDb();
  const next = body.config;
  const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const errs = [];
  if (!num(next?.challenge?.size, 3, 15)) errs.push('Challenge size must be 3–15.');
  const mixTotal = Object.values(next?.challenge?.mix || {}).reduce((s, v) => s + v, 0);
  if (mixTotal !== next?.challenge?.size) errs.push('Difficulty mix must add up to the challenge size.');
  if (!num(next?.coins?.DAILY_CHALLENGE?.amount, 0, 1000) || !num(next?.coins?.DOUBT_SOLVED?.amount, 0, 1000)) errs.push('Coin values must be 0–1000.');
  if (!num(next?.coins?.DAILY_CHALLENGE?.minScorePct, 0, 100)) errs.push('Qualification score must be 0–100%.');
  if (!num(next?.reviewCycleDays, 1, 30)) errs.push('Review cycle must be 1–30 days.');
  const w = next?.mastery || {};
  if (Math.abs((w.accuracy || 0) + (w.recency || 0) + (w.mistakeResolution || 0) - 1) > 0.001) errs.push('Mastery weights must add up to 1.0.');
  if (!num(next?.ai?.doubtsPerDay, 1, 500) || !num(next?.ai?.imagesPerDay, 0, 100) || !num(next?.ai?.doubtsPerMonth, 1, 10000)) errs.push('AI limits are out of range.');
  Object.entries(next?.xp || {}).forEach(([k, v]) => { if (k !== 'STREAK_MILESTONES' && !num(v, 0, 5000)) errs.push(`XP value ${k} is out of range.`); });
  if (errs.length) throw new ApiError(ERROR_CODES.VALIDATION, errs[0], { details: { errors: errs } });
  const before = cfg();
  const version = before.version + 1;
  d.admin.configHistory.unshift({ version, at: nowIso(), by: admin.email, note: trimTo(body.note, 200) || 'Config updated', before: structuredClone(before) });
  d.admin.config = { ...structuredClone(next), version };
  audit(admin, 'CONFIG_UPDATED', `config v${version}`, { version: before.version }, { version, note: body.note || null });
  return getConfig();
}

/* ------------------------------------------------------------------ students (F12-08, masked) */

function studentRows() {
  const d = getDb();
  const real = Object.values(d.users).map((u) => {
    const st = userState(u.uid);
    return {
      id: u.uid, displayName: u.displayName, emailMasked: maskContact(u.email), classId: u.profile?.classId || null, joinedAt: u.createdAt,
      lastActiveAt: st.attempts[st.attempts.length - 1]?.at || u.createdAt, consent: Boolean(u.profile?.consent), status: u.deletedAt ? 'DELETION_PENDING' : u.suspended ? 'SUSPENDED' : 'ACTIVE', real: true,
    };
  });
  return [...real, ...(d.admin.syntheticStudents || [])];
}

function listStudents({ query }) {
  let rows = studentRows();
  if (query.classId) rows = rows.filter((r) => r.classId === Number(query.classId));
  if (query.status) rows = rows.filter((r) => r.status === query.status);
  if (query.q) {
    const s = query.q.toLowerCase();
    rows = rows.filter((r) => r.displayName.toLowerCase().includes(s) || r.id.toLowerCase().includes(s));
  }
  return { total: rows.length, items: rows.slice(0, 100) };
}

function getStudent({ admin, params }) {
  const d = getDb();
  const u = d.users[params.id];
  audit(admin, 'STUDENT_PROFILE_VIEWED', params.id); // SEC-14
  if (!u) {
    const s = (d.admin.syntheticStudents || []).find((x) => x.id === params.id);
    if (!s) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Student not found.', { status: 404 });
    return { ...s, parentMasked: '•••••••321', consentAt: s.joinedAt, summary: s.summary };
  }
  const sum = u.profile?.consent ? summary(u.uid) : null;
  const { strong, weak } = u.profile?.classId ? strongWeak(u.uid, u.profile.classId) : { strong: [], weak: [] };
  return {
    ...studentRows().find((r) => r.id === u.uid),
    parentMasked: u.profile?.parent?.contactMasked || '—', parentRelationship: u.profile?.parent?.relationship,
    consentAt: u.profile?.consent?.timestamp || null, consentMethod: u.profile?.consent?.method, consentVersion: u.profile?.consent?.version,
    summary: sum && { totalXp: sum.totalXp, goldCoins: sum.goldCoins, currentStreak: sum.currentStreak, accuracyOverall: sum.accuracyOverall, mistakes: sum.mistakes, strong: strong.map((t) => t.name), weak: weak.map((t) => t.name) },
    doubtsNote: 'Doubt conversations are private and only visible to support when flagged (F12-12).',
  };
}

function studentAction({ admin, params, body }) {
  const d = getDb();
  const u = d.users[params.id];
  const synthetic = (d.admin.syntheticStudents || []).find((x) => x.id === params.id);
  if (!u && !synthetic) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Student not found.', { status: 404 });
  const action = body.action;
  if (action === 'SUSPEND' || action === 'UNSUSPEND') {
    if (u) u.suspended = action === 'SUSPEND';
    else synthetic.status = action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';
  } else if (action === 'EXPORT') {
    // queued; delivered as JSON within 7 days (SEC-13)
  } else if (action === 'DELETE') {
    if (u) { u.deletedAt = nowIso(); u.hardDeleteAfter = addDays(istDateKey(), 30); } else synthetic.status = 'DELETION_PENDING';
  } else {
    throw new ApiError(ERROR_CODES.VALIDATION, 'Unknown action.');
  }
  audit(admin, `STUDENT_${action}`, params.id);
  return { ok: true, message: action === 'EXPORT' ? 'Export queued. The JSON file will be delivered to the parent contact within 7 days.' : 'Done.' };
}

function bulkExport({ admin }) {
  audit(admin, 'STUDENTS_BULK_EXPORT', 'all students', null, { rows: studentRows().length });
  return { rows: studentRows().map(({ real: _r, ...rest }) => rest) };
}

/* ------------------------------------------------------------------ moderation (F12-09, F12-12) */

function listModeration({ query }) {
  const items = getDb().admin.moderation.filter((m) => !query.status || m.status === query.status);
  return { items: items.map((m) => ({ ...m, question: m.questionId ? { text: getQuestion(m.questionId)?.questionText, status: getQuestion(m.questionId)?.status } : null })) };
}

function resolveModeration({ admin, params, body }) {
  const d = getDb();
  const item = d.admin.moderation.find((m) => m.id === params.id);
  if (!item) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Item not found.', { status: 404 });
  const action = body.action;
  if (!['CORRECTED', 'RETIRED_QUESTION', 'ANNOTATED_KB', 'DISMISSED', 'ESCALATED'].includes(action)) throw new ApiError(ERROR_CODES.VALIDATION, 'Choose an action.');
  if (action === 'RETIRED_QUESTION' && item.questionId) setQuestionStatus({ admin, params: { id: item.questionId }, body: { status: 'RETIRED' } });
  Object.assign(item, { status: 'RESOLVED', resolution: action, note: trimTo(body.note, 300), resolvedBy: admin.email, resolvedAt: nowIso() });
  audit(admin, `MODERATION_${action}`, item.id, { status: 'OPEN' }, { status: 'RESOLVED' });
  return item;
}

/* ------------------------------------------------------------------ audit log (read-only) */

function listAudit({ query }) {
  let items = getDb().admin.audit;
  if (query.q) {
    const s = query.q.toLowerCase();
    items = items.filter((a) => `${a.actor} ${a.action} ${a.target}`.toLowerCase().includes(s));
  }
  return { items: items.slice(0, 200), total: items.length };
}

const guard = (roles, route) => ({ ...route, auth: 'admin', roles });
const ALL = [SA, CM, SU];

export const adminRoutes = [
  { method: 'POST', path: '/admin/auth/login', auth: 'none', handler: adminLogin },
  { method: 'POST', path: '/admin/auth/verify', auth: 'none', handler: adminVerify },
  guard(ALL, { method: 'GET', path: '/admin/me', handler: adminMe }),
  guard(ALL, { method: 'POST', path: '/admin/auth/logout', handler: adminLogout }),
  guard(ALL, { method: 'GET', path: '/admin/dashboard', handler: dashboard }),
  guard(ALL, { method: 'GET', path: '/admin/curriculum', handler: adminCurriculum }),
  guard([SA, CM], { method: 'POST', path: '/admin/curriculum/chapters', handler: createChapter }),
  guard([SA, CM], { method: 'PATCH', path: '/admin/curriculum/chapters/:id', handler: updateChapter }),
  guard([SA, CM], { method: 'POST', path: '/admin/curriculum/reorder', handler: reorderChapters }),
  guard([SA, CM], { method: 'POST', path: '/admin/curriculum/chapters/:id/topics', handler: addTopic }),
  guard([SA, CM], { method: 'POST', path: '/admin/curriculum/chapters/:id/reorder-topics', handler: reorderTopics }),
  guard([SA, CM], { method: 'PATCH', path: '/admin/curriculum/topics/:id', handler: updateTopic }),
  guard(ALL, { method: 'GET', path: '/admin/materials/:topicId', handler: getMaterial }),
  guard([SA, CM], { method: 'PUT', path: '/admin/materials/:topicId', handler: saveMaterial }),
  guard(ALL, { method: 'GET', path: '/admin/questions', handler: listQuestions }),
  guard([SA, CM], { method: 'POST', path: '/admin/questions', handler: createQuestion }),
  guard([SA, CM], { method: 'POST', path: '/admin/questions/import/validate', handler: validateImport }),
  guard([SA, CM], { method: 'POST', path: '/admin/questions/import/commit', handler: commitImport }),
  guard(ALL, { method: 'GET', path: '/admin/questions/:id', handler: getAdminQuestion }),
  guard([SA, CM], { method: 'PATCH', path: '/admin/questions/:id', handler: updateQuestion }),
  guard([SA, CM], { method: 'POST', path: '/admin/questions/:id/status', handler: setQuestionStatus }),
  guard([SA, CM], { method: 'POST', path: '/admin/questions/:id/duplicate', handler: duplicateQuestion }),
  guard(ALL, { method: 'GET', path: '/admin/tests', handler: adminTests }),
  guard([SA, CM], { method: 'POST', path: '/admin/tests', handler: saveTest }),
  guard([SA, CM], { method: 'PATCH', path: '/admin/tests/:id', handler: saveTest }),
  guard([SA, CM], { method: 'POST', path: '/admin/series', handler: saveSeries }),
  guard([SA, CM], { method: 'PATCH', path: '/admin/series/:id', handler: saveSeries }),
  guard([SA, CM], { method: 'GET', path: '/admin/kb', handler: listKb }),
  guard([SA, CM], { method: 'POST', path: '/admin/kb', handler: uploadKb }),
  guard([SA, CM], { method: 'POST', path: '/admin/kb/:id/reindex', handler: reindexKb }),
  guard([SA, CM], { method: 'DELETE', path: '/admin/kb/:id', handler: removeKb }),
  guard([SA, CM], { method: 'GET', path: '/admin/config', handler: getConfig }),
  guard([SA], { method: 'PUT', path: '/admin/config', handler: putConfig }),
  guard([SA, SU], { method: 'GET', path: '/admin/students', handler: listStudents }),
  guard([SA], { method: 'POST', path: '/admin/students/export', handler: bulkExport }),
  guard([SA, SU], { method: 'GET', path: '/admin/students/:id', handler: getStudent }),
  guard([SA, SU], { method: 'POST', path: '/admin/students/:id/action', handler: studentAction }),
  guard(ALL, { method: 'GET', path: '/admin/moderation', handler: listModeration }),
  guard(ALL, { method: 'POST', path: '/admin/moderation/:id/resolve', handler: resolveModeration }),
  guard([SA, SU], { method: 'GET', path: '/admin/audit', handler: listAudit }),
];

