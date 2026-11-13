/**
 * Admin console adapter for the live backend (/admin/*, guarded by authenticate + authorize('admin')).
 *
 * The admin pages were built against the richer PRD contract (see adminMock.js). This module maps the
 * backend's shapes onto those page shapes and exposes `caps` so pages can hide what the backend does
 * not support yet (2FA, review queue, knowledge base, moderation, student export, …). Anything missing
 * rejects with NOT_AVAILABLE instead of inventing data.
 *
 * Contract: GyanGrid_Backend_Postman_Collection_Final.json. Only documented query/body fields are
 * sent, because the backend validates strictly.
 *
 * Mapping notes
 * - UI class selectors use the grade number (6–10); it is resolved to the backend class _id here.
 * - Curriculum `isActive` ⇄ UI status PUBLISHED / DRAFT.
 * - Question status PUBLISHED ⇄ UI APPROVED (the UI's "served to students" state).
 * - Question types MCQ / TRUE_FALSE / SHORT_ANSWER ⇄ UI MCQ_SINGLE / TRUE_FALSE / NUMERIC.
 * - Material status ARCHIVED ⇄ UI RETIRED.
 */
import { http } from '../../http';
import { ApiError, ERROR_CODES, notAvailable } from '../../errors';
import { firebaseSignIn, firebaseSignOut, currentFirebaseUser, authReady } from '../../auth/firebase';
import { maskContact } from '@/lib/format';
import { uploadToSignedUrl } from './uploads';
import { idOf, list, pageInfo, unwrap } from './mappers';

const enc = encodeURIComponent;
const SUBJECT = 'MATHEMATICS';
const KEYS = 'ABCDEFGH';
const MAX_LIMIT = 100;
const get = (path, params) => http.get(path, params);
const sortByOrder = (a, b) => (a.order ?? a.chapterNumber ?? a.topicNumber ?? 0) - (b.order ?? b.chapterNumber ?? b.topicNumber ?? 0);
const validation = (errors) => new ApiError(ERROR_CODES.VALIDATION, errors[0], { details: { errors } });

/* ------------------------------------------------------------------ capabilities */

export const caps = {
  twoFactor: true,
  roles: false, // the backend has a single "admin" role
  reviewQueue: false, // no IN_REVIEW status; questions go DRAFT → PUBLISHED
  questionSource: false,
  questionTypes: ['MCQ_SINGLE', 'TRUE_FALSE', 'NUMERIC'],
  answerTolerance: false,
  conceptNote: false,
  estimatedTime: false,
  testKinds: ['CHAPTER', 'FULL'],
  negativeMarking: true,
  reattemptPolicy: false, // the backend uses a numeric maxAttempts instead of an on/off switch
  maxAttempts: true,
  publishWindow: true,
  testInstructions: true,
  passingMarks: true,
  seriesUnlockMode: true,
  materialFormat: 'html',
  pdfUpload: true,
  versionHistory: true,
  kb: true,
  moderation: true,
  studentExport: true,
  bulkExport: true,
  studentStatuses: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'],
  curriculumStatuses: ['DRAFT', 'PUBLISHED'],
  dashboard: 'analytics',
  config: 'keys',
};

/* ------------------------------------------------------------------ auth */

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'];

const isTwoFactorError = (e) => e?.code === ERROR_CODES.TWO_FACTOR_REQUIRED
  || (e?.status === 403 && /2fa|two.?factor|mfa/i.test(`${e.details?.backendCode || ''} ${e.message || ''}`));

/** Any guarded admin read tells us whether this session has passed the server's 2FA guard. */
async function needsTwoFactor() {
  try {
    await get('/admin/config');
    return false;
  } catch (e) {
    if (isTwoFactorError(e)) return true;
    throw e;
  }
}

async function verifyAdmin() {
  const me = unwrap(await http.get('/auth/me', null, { skipAuthRedirect: true }), 'user') || {};
  const role = String(me.role || '').toUpperCase();
  if (!ADMIN_ROLES.includes(role)) {
    await firebaseSignOut();
    throw new ApiError(ERROR_CODES.FORBIDDEN, "This account doesn't have admin access.", { status: 403 });
  }
  const fb = currentFirebaseUser();
  return {
    uid: fb?.uid || idOf(me),
    name: me.displayName || me.name || fb?.displayName || (me.email || '').split('@')[0] || 'Admin',
    email: me.email || fb?.email || '',
    // Single backend role → full console access. Map finer roles here once the backend adds them.
    role: 'SUPER_ADMIN',
    backendRole: role,
    since: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ curriculum lookups */

// grade → class, plus topic → { chapterId, classId, boardId } learned while browsing (used for creates).
let classesPromise = null;
const topicIndex = new Map();
const chapterIndex = new Map();

function loadClasses() {
  if (!classesPromise) {
    classesPromise = get('/admin/curriculum/classes', { page: 1, limit: MAX_LIMIT })
      .then((d) => list(d, 'classes').map((c) => ({
        id: c._id,
        boardId: idOf(c.boardId),
        grade: Number(c.classNumber ?? c.grade ?? String(c.name || '').replace(/\D/g, '')) || null,
        name: c.name,
        isActive: c.isActive !== false,
      })))
      .catch((e) => { classesPromise = null; throw e; });
  }
  return classesPromise;
}

async function classFor(grade) {
  const classes = await loadClasses();
  const matches = classes.filter((c) => c.grade === Number(grade));
  return matches.find((c) => c.isActive) || matches[0] || null;
}

async function gradeOfClassId(classId) {
  if (!classId) return null;
  const id = idOf(classId);
  const c = (await loadClasses()).find((x) => x.id === id);
  return c?.grade ?? null;
}

const statusOfActive = (x) => (x?.isActive === false ? 'DRAFT' : 'PUBLISHED');

async function listChapters(classId, { includeTopics = false } = {}) {
  return list(await get('/admin/curriculum/chapters', { classId, includeTopics: includeTopics || undefined, page: 1, limit: MAX_LIMIT }), 'chapters').sort(sortByOrder);
}
async function listTopics(chapterId) {
  return list(await get('/admin/curriculum/topics', { chapterId, page: 1, limit: MAX_LIMIT }), 'topics').sort(sortByOrder);
}

async function curriculum(grade) {
  const cls = await classFor(grade);
  if (!cls) return { classId: Number(grade), backendClassId: null, chapters: [] };
  // One request: chapters with their topics nested (falls back to per-chapter calls on older servers).
  const chapters = await listChapters(cls.id, { includeTopics: true });
  const withTopics = await Promise.all(chapters.map(async (ch) => {
    chapterIndex.set(ch._id, { classId: cls.id, boardId: cls.boardId, name: ch.name });
    const topics = Array.isArray(ch.topics) ? [...ch.topics].sort(sortByOrder) : await listTopics(ch._id);
    return {
      id: ch._id,
      name: ch.name,
      number: ch.chapterNumber ?? null,
      status: statusOfActive(ch),
      order: ch.order ?? ch.chapterNumber ?? null,
      topics: topics.map((t) => {
        topicIndex.set(t._id, { chapterId: ch._id, classId: cls.id, boardId: cls.boardId, name: t.name, chapterName: ch.name });
        return { id: t._id, name: t.name, status: statusOfActive(t), order: t.order ?? t.topicNumber ?? null };
      }),
    };
  }));
  return { classId: Number(grade), backendClassId: cls.id, boardId: cls.boardId, chapters: withTopics };
}

async function setActive(kind, id, status) {
  return http.patch(`/admin/curriculum/${kind}/${enc(id)}/status`, { isActive: status === 'PUBLISHED' });
}

async function patchCurriculum(kind, id, body) {
  const { status, name } = body;
  const patch = {};
  if (name) patch.name = String(name).trim().slice(0, 120);
  if (Object.keys(patch).length) await http.patch(`/admin/curriculum/${kind}/${enc(id)}`, patch);
  if (status) await setActive(kind, id, status);
  return { ok: true };
}

/**
 * Order lives in chapterNumber / topicNumber, which are unique. Changed rows first move to free
 * numbers, then to their final ones; the existing set of numbers is reused so gaps stay as they are.
 */
async function renumber(kind, field, ids, items) {
  const current = new Map(items.map((x) => [x._id, x[field]]));
  const numbers = ids.map((id) => current.get(id)).sort((a, b) => a - b);
  const changed = ids.map((id, i) => ({ id, to: numbers[i] })).filter((x) => current.get(x.id) !== x.to);
  const top = Math.max(...items.map((x) => x[field] || 0));
  const save = (id, value) => http.patch(`/admin/curriculum/${kind}/${enc(id)}`, { [field]: value });
  for (let i = 0; i < changed.length; i += 1) await save(changed[i].id, top + 1 + i);
  for (const { id, to } of changed) await save(id, to);
  return { ok: true };
}

/* ------------------------------------------------------------------ materials */

const MATERIAL_STATUS_TO_API = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', RETIRED: 'ARCHIVED' };
const MATERIAL_STATUS_FROM_API = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'RETIRED' };
const materialType = (m) => String(m.type || '').toLowerCase();
const materialUrl = (m) => m.url || m.fileUrl || m.pdfUrl || m.videoUrl || m.contentUrl || (/^https?:/.test(m.content || '') ? m.content : '');

async function topicMaterials(topicId) {
  return list(await get('/admin/materials', { topicId, page: 1, limit: 50 }), 'materials');
}

async function material(topicId) {
  const items = await topicMaterials(topicId);
  const live = (m) => String(m.status).toUpperCase() !== 'ARCHIVED';
  const text = items.find((m) => materialType(m) === 'rich_text' && live(m)) || items.find((m) => materialType(m) === 'rich_text');
  const pdf = items.find((m) => materialType(m) === 'pdf');
  const video = items.find((m) => materialType(m) === 'video');
  const blocks = [{ type: 'TEXT', body: text?.content || '' }];
  if (pdf) blocks.push({ type: 'PDF', title: pdf.title || '', url: materialUrl(pdf), pages: pdf.pages || null });
  if (video) blocks.push({ type: 'VIDEO', title: video.title || '', url: materialUrl(video) });
  const t = topicIndex.get(topicId);
  return {
    topic: { id: topicId, name: t?.name || null, chapterName: t?.chapterName || null },
    material: {
      id: text?._id || null,
      title: text?.title || (t?.name ? `${t.name} — Notes` : ''),
      status: MATERIAL_STATUS_FROM_API[String(text?.status || 'DRAFT').toUpperCase()] || 'DRAFT',
      version: text ? (text.version ?? (text.__v != null ? text.__v + 1 : 1)) : 0,
      updatedAt: text?.updatedAt || null,
      blocks,
    },
    history: text?._id ? await materialHistory(text._id) : [],
    _ids: { text: text?._id || null, pdf: pdf?._id || null, video: video?._id || null },
    _statuses: { pdf: pdf?.status || null, video: video?.status || null },
  };
}

async function materialHistory(materialId) {
  try {
    const d = await get(`/admin/materials/${enc(materialId)}/history`);
    return (d?.events || []).map((h) => ({ action: h.action || 'UPDATE', by: h.adminEmail || null, updatedAt: h.createdAt || null }));
  } catch {
    return [];
  }
}

async function upsertMaterial({ id, topicId, type, title, content, status }) {
  const ctx = topicIndex.get(topicId);
  let materialId = id;
  const body = { title, content }; // pdf / video materials keep their https link in `content`
  if (materialId) {
    await http.patch(`/admin/materials/${enc(materialId)}`, body);
  } else {
    if (!ctx) throw new ApiError(ERROR_CODES.VALIDATION, 'Reload the page and choose the topic again.');
    const created = await http.post('/admin/materials', {
      boardId: ctx.boardId, classId: ctx.classId, chapterId: ctx.chapterId, topicId, type, status: 'draft', ...body,
    });
    materialId = idOf(unwrap(created, 'material'));
  }
  if (materialId && status) await http.patch(`/admin/materials/${enc(materialId)}/status`, { status: (MATERIAL_STATUS_TO_API[status] || 'DRAFT').toLowerCase() });
  return materialId;
}

/** Signed URL → direct PUT → server verification. Returns the public https link of the PDF. */
async function uploadPdf(file) {
  if (file.type !== 'application/pdf') throw validation(['Please choose a PDF file.']);
  if (file.size > 20 * 1024 * 1024) throw validation(['PDFs must be under 20 MB.']);
  const up = await http.post('/admin/uploads/signed-url', { contentType: 'application/pdf', sizeBytes: file.size });
  await uploadToSignedUrl(up, file);
  const done = await http.post(`/admin/uploads/${enc(up.uploadId)}/complete`, {});
  return done.publicUrl || up.publicUrl;
}

const HTTPS = /^https:\/\//i;
const VIDEO_HOSTS = /^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//i;

async function saveMaterial(topicId, body) {
  const errors = [];
  const title = String(body.title || '').trim().slice(0, 200);
  const content = String(body.body || '').trim();
  if (title.length < 3) errors.push('Enter a title (3+ characters).');
  if (!content) errors.push('Material content cannot be empty.');
  if (body.video?.url && !VIDEO_HOSTS.test(body.video.url)) errors.push('Video links must be https YouTube or Vimeo URLs.');
  if (body.pdf?.url && !HTTPS.test(body.pdf.url)) errors.push('PDF links must start with https://');
  if (errors.length) throw validation(errors);

  const current = await material(topicId);
  const status = body.status || 'DRAFT';
  await upsertMaterial({ id: current._ids.text, topicId, type: 'rich_text', title, content, status });
  if (body.video?.url) {
    await upsertMaterial({ id: current._ids.video, topicId, type: 'video', title: String(body.video.title || 'Video lesson').slice(0, 200), content: body.video.url, status });
  }
  if (body.pdf?.url) {
    await upsertMaterial({ id: current._ids.pdf, topicId, type: 'pdf', title: String(body.pdf.title || 'Notes (PDF)').slice(0, 200), content: body.pdf.url, status });
  }
  return (await material(topicId)).material;
}

/* ------------------------------------------------------------------ questions */

const Q_STATUS_TO_API = { DRAFT: 'DRAFT', IN_REVIEW: 'DRAFT', APPROVED: 'PUBLISHED', PUBLISHED: 'PUBLISHED', RETIRED: 'RETIRED' };
const Q_STATUS_FROM_API = { DRAFT: 'DRAFT', PUBLISHED: 'APPROVED', RETIRED: 'RETIRED', ARCHIVED: 'RETIRED' };
const Q_TYPE_TO_API = { MCQ_SINGLE: 'MCQ', TRUE_FALSE: 'TRUE_FALSE', NUMERIC: 'SHORT_ANSWER', SHORT_ANSWER: 'SHORT_ANSWER' };
const Q_TYPE_FROM_API = { MCQ: 'MCQ_SINGLE', TRUE_FALSE: 'TRUE_FALSE', SHORT_ANSWER: 'NUMERIC' };
const explanationLines = (e) => (Array.isArray(e) ? e : String(e || '').split('\n')).map((s) => String(s).trim()).filter(Boolean);

function mapQuestionRow(q) {
  const t = topicIndex.get(idOf(q.topicId));
  return {
    questionId: q._id || q.questionId,
    questionText: q.questionText || '',
    type: Q_TYPE_FROM_API[String(q.questionType || 'MCQ').toUpperCase()] || 'MCQ_SINGLE',
    difficulty: q.difficulty || null,
    status: Q_STATUS_FROM_API[String(q.status || 'DRAFT').toUpperCase()] || 'DRAFT',
    source: q.source ? String(q.source).toUpperCase() : null,
    topicId: idOf(q.topicId),
    topicName: (typeof q.topicId === 'object' && q.topicId?.name) || t?.name || null,
    chapterName: (typeof q.chapterId === 'object' && q.chapterId?.name) || t?.chapterName || null,
    stats: null,
    version: q.version ?? (q.__v != null ? q.__v + 1 : 1),
    updatedAt: q.updatedAt || null,
  };
}

async function questions(params = {}) {
  const cls = params.classId ? await classFor(params.classId) : null;
  const pageSize = Math.min(MAX_LIMIT, Number(params.pageSize) || 15);
  const page = Math.max(1, Number(params.page) || 1);
  const query = {
    classId: cls?.id,
    chapterId: params.chapterId || undefined,
    topicId: params.topicId || undefined,
    difficulty: params.difficulty || undefined,
    status: params.status ? Q_STATUS_TO_API[params.status] : undefined,
    search: params.q || undefined,
    page,
    limit: pageSize,
  };
  // `search` is documented on /questions; fall back to page-level filtering if the admin route rejects it.
  const data = await get('/admin/questions', query).catch((e) => {
    if (e.code === ERROR_CODES.VALIDATION && query.search) return get('/admin/questions', { ...query, search: undefined });
    throw e;
  });
  let items = list(data, 'questions').map(mapQuestionRow);
  if (params.q) {
    const s = params.q.toLowerCase();
    items = items.filter((r) => String(r.questionId).toLowerCase().includes(s) || r.questionText.toLowerCase().includes(s));
  }
  const info = pageInfo(data);
  return { total: info.total || items.length, page, pageSize, items };
}

function mapPerformance(p) {
  const d = unwrap(p, 'performance', 'stats') || {};
  const attempts = Number(d.totalAttempts ?? d.attempts ?? d.attemptCount ?? 0);
  const correct = Number(d.correctAttempts ?? d.correct ?? d.correctCount ?? (d.accuracy != null ? Math.round((attempts * Number(d.accuracy)) / 100) : 0));
  const avg = d.averageTimeSeconds ?? d.avgTimeSec ?? d.avgTimeSeconds ?? (d.averageTimeMs != null ? d.averageTimeMs / 1000 : null);
  return { attempts, correct, avgTimeSec: avg != null ? Math.round(Number(avg)) : '—' };
}

async function rawQuestion(id) {
  return unwrap(await get(`/admin/questions/${enc(id)}`), 'question');
}

async function question(id) {
  const [q, perf] = await Promise.all([rawQuestion(id), get(`/admin/questions/${enc(id)}/performance`).catch(() => null)]);
  const type = Q_TYPE_FROM_API[String(q.questionType || 'MCQ').toUpperCase()] || 'MCQ_SINGLE';
  const options = (q.options || []).map((o, i) => ({ key: KEYS[i], text: String(typeof o === 'object' ? o.text ?? '' : o) }));
  let correctAnswer = q.correctAnswer;
  if (type === 'MCQ_SINGLE') correctAnswer = options.find((o) => o.text === String(q.correctAnswer))?.key || 'A';
  else if (type === 'TRUE_FALSE') correctAnswer = String(q.correctAnswer).toLowerCase() === 'true' ? 'true' : 'false';
  else correctAnswer = String(q.correctAnswer ?? '');
  const topicId = idOf(q.topicId);
  return {
    ...mapQuestionRow(q),
    classId: await gradeOfClassId(q.classId),
    chapterId: idOf(q.chapterId),
    topicId,
    options,
    correctAnswer,
    answerTolerance: 0,
    explanation: explanationLines(q.explanation),
    conceptNote: '',
    estimatedTimeSec: 60,
    stats: perf ? mapPerformance(perf) : null,
  };
}

function validateQuestion(input) {
  const errs = [];
  if (!input.topicId) errs.push('Choose a class, chapter and topic.');
  if (!['MCQ_SINGLE', 'TRUE_FALSE', 'NUMERIC'].includes(input.type)) errs.push('Choose a question type.');
  if (!['EASY', 'MEDIUM', 'HARD'].includes(input.difficulty)) errs.push('Difficulty must be EASY, MEDIUM or HARD.');
  if (!input.questionText || input.questionText.trim().length < 5) errs.push('Question text is too short.');
  if (input.type === 'MCQ_SINGLE') {
    const opts = (input.options || []).map((o) => String(o?.text ?? o).trim()).filter(Boolean);
    if (opts.length < 2) errs.push('Add at least 2 options.');
    if (new Set(opts).size !== opts.length) errs.push('Options must be different from each other.');
    const idx = KEYS.indexOf(String(input.correctAnswer));
    if (idx < 0 || !opts[idx]) errs.push('Pick the correct option.');
  }
  if (input.type === 'TRUE_FALSE' && !['true', 'false'].includes(String(input.correctAnswer).toLowerCase())) errs.push('Choose True or False as the answer.');
  if (input.type === 'NUMERIC' && !String(input.correctAnswer ?? '').trim()) errs.push('Enter the correct answer.');
  return errs;
}

/** Editor payload (UI shape) → backend question body. */
function toBackendQuestion(input, { classId, chapterId, status }) {
  const type = Q_TYPE_TO_API[input.type] || 'MCQ';
  const options = type === 'MCQ' ? (input.options || []).map((o) => String(o?.text ?? o).trim()).filter(Boolean).slice(0, 6) : [];
  let correctAnswer = String(input.correctAnswer ?? '').trim();
  if (type === 'MCQ') correctAnswer = options[KEYS.indexOf(correctAnswer)] ?? correctAnswer;
  if (type === 'TRUE_FALSE') correctAnswer = correctAnswer.toLowerCase() === 'true' ? 'TRUE' : 'FALSE'; // stored as upper-case text
  const body = {
    classId,
    chapterId,
    topicId: input.topicId,
    subject: SUBJECT,
    questionType: type,
    difficulty: input.difficulty,
    questionText: String(input.questionText || '').trim().slice(0, 4000),
    correctAnswer,
    explanation: explanationLines(input.explanation).join('\n'),
    status,
  };
  if (type === 'MCQ') body.options = options;
  return body;
}

async function contextForTopic(topicId, fallback = {}) {
  const t = topicIndex.get(topicId);
  const classId = t?.classId || idOf(fallback.classId);
  const chapterId = t?.chapterId || idOf(fallback.chapterId);
  if (!classId || !chapterId) throw new ApiError(ERROR_CODES.VALIDATION, 'Choose the class, chapter and topic again.');
  return { classId, chapterId };
}

async function createQuestion(input) {
  const errs = validateQuestion(input);
  if (errs.length) throw validation(errs);
  const ctx = await contextForTopic(input.topicId);
  const created = unwrap(await http.post('/admin/questions', toBackendQuestion(input, { ...ctx, status: 'DRAFT' })), 'question');
  return mapQuestionRow(created);
}

async function updateQuestion(id, input) {
  const errs = validateQuestion(input);
  if (errs.length) throw validation(errs);
  const current = await rawQuestion(id);
  const sameTopic = input.topicId === idOf(current.topicId);
  const ctx = await contextForTopic(input.topicId, sameTopic ? current : {});
  const status = String(current.status || 'DRAFT').toUpperCase();
  await http.put(`/admin/questions/${enc(id)}`, toBackendQuestion(input, { ...ctx, status }));
  return question(id);
}

async function setQuestionStatus(id, status) {
  if (status === 'IN_REVIEW') throw notAvailable('Question review queue');
  if (status === 'APPROVED') {
    const q = await rawQuestion(id);
    if (!explanationLines(q.explanation).length) throw validation(['A question cannot be published without an explanation.']);
  }
  await http.patch(`/admin/questions/${enc(id)}/status`, { status: Q_STATUS_TO_API[status] || status });
  return question(id);
}

async function duplicateQuestion(id) {
  const q = await rawQuestion(id);
  const body = {
    classId: idOf(q.classId), chapterId: idOf(q.chapterId), topicId: idOf(q.topicId), subject: q.subject || SUBJECT,
    questionType: q.questionType, difficulty: q.difficulty,
    // The backend rejects two questions with the same text in one topic.
    questionText: `${q.questionText} (copy)`, correctAnswer: q.correctAnswer,
    explanation: q.explanation || '', status: 'DRAFT',
  };
  if (String(q.questionType).toUpperCase() === 'MCQ') body.options = q.options || [];
  return mapQuestionRow(unwrap(await http.post('/admin/questions', body), 'question'));
}

const deleteQuestion = (id) => http.del(`/admin/questions/${enc(id)}`);

/* ------------------------------------------------------------------ bulk import */

const IMPORT_COLUMNS = ['classId', 'chapterId', 'topicId', 'type', 'difficulty', 'questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'explanation'];
const importSpec = {
  columns: IMPORT_COLUMNS,
  note: 'classId, chapterId and topicId are the database ids shown in Curriculum. type: MCQ | TRUE_FALSE | SHORT_ANSWER. correctAnswer: option letter (MCQ), true/false, or the answer text. Steps separated by “|”.',
  template: `${IMPORT_COLUMNS.join(',')}
<classId>,<chapterId>,<topicId>,MCQ,EASY,"What is 8 × 7?",54,56,58,64,B,"8 × 7 = 56"
<classId>,<chapterId>,<topicId>,TRUE_FALSE,MEDIUM,"Every integer is a rational number.",,,,,true,"Any integer n can be written as n/1"
<classId>,<chapterId>,<topicId>,SHORT_ANSWER,HARD,"Find the HCF of 96 and 404.",,,,,4,"404 = 4 × 101|96 = 4 × 24|HCF = 4"`,
};

const ID_RE = /^[a-f0-9]{24}$/i;
const IMPORT_TYPE = { MCQ: 'MCQ_SINGLE', MCQ_SINGLE: 'MCQ_SINGLE', TRUE_FALSE: 'TRUE_FALSE', SHORT_ANSWER: 'NUMERIC', NUMERIC: 'NUMERIC' };

function normaliseImportRow(row) {
  const type = IMPORT_TYPE[String(row.type || '').trim().toUpperCase()] || null;
  const options = ['A', 'B', 'C', 'D'].map((k) => String(row[`option${k}`] || '').trim()).filter(Boolean).map((text) => ({ text }));
  let correctAnswer = String(row.correctAnswer ?? '').trim();
  if (type === 'MCQ_SINGLE') correctAnswer = correctAnswer.toUpperCase();
  return {
    classId: String(row.classId || '').trim(),
    chapterId: String(row.chapterId || '').trim(),
    topicId: String(row.topicId || '').trim(),
    type,
    difficulty: String(row.difficulty || '').trim().toUpperCase(),
    questionText: String(row.questionText || '').trim(),
    options,
    correctAnswer,
    explanation: String(row.explanation || '').split('|'),
  };
}

async function validateImportClient(rows) {
  const capped = (rows || []).slice(0, 1000);
  return {
    rows: capped.map((row, i) => {
      const q = normaliseImportRow(row);
      const errors = [];
      ['classId', 'chapterId', 'topicId'].forEach((k) => { if (!ID_RE.test(q[k])) errors.push(`${k} must be a valid id.`); });
      if (!q.type) errors.push('type must be MCQ, TRUE_FALSE or SHORT_ANSWER.');
      errors.push(...validateQuestion(q).filter((e) => !e.startsWith('Choose a class') && !e.startsWith('Choose a question type')));
      if (!explanationLines(q.explanation).length) errors.push('Add an explanation.');
      const t = topicIndex.get(q.topicId);
      if (t && (t.chapterId !== q.chapterId || t.classId !== q.classId)) errors.push('topicId does not belong to this class / chapter.');
      return { row: i + 2, questionText: q.questionText.slice(0, 80), topicName: t?.name || q.topicId, valid: errors.length === 0, errors, normalised: q };
    }),
  };
}

/** Client checks first (ids, required fields), then the server's row-level validation for the rest. */
async function validateImportServer(rows) {
  const report = await validateImportClient(rows);
  const candidates = report.rows.filter((r) => r.valid);
  if (!candidates.length) return report;
  try {
    const res = await http.post('/admin/questions/bulk-import/validate', {
      questions: candidates.map((r) => toBackendQuestion(r.normalised, { classId: r.normalised.classId, chapterId: r.normalised.chapterId, status: 'DRAFT' })),
    });
    const serverRows = list(res, 'rows', 'results');
    candidates.forEach((r, i) => {
      const sr = serverRows.find((x) => Number(x.row) === i + 1) || serverRows[i];
      if (sr && sr.valid === false) {
        const errs = (sr.errors || []).map((e) => (typeof e === 'string' ? e : e.message || JSON.stringify(e)));
        Object.assign(r, { valid: false, errors: errs.length ? errs : ['Rejected by the server.'] });
      }
    });
  } catch (e) {
    if (e.code !== ERROR_CODES.NOT_FOUND) throw e;
  }
  return report;
}

async function commitImport(rows) {
  const report = await validateImportServer(rows);
  const valid = report.rows.filter((r) => r.valid);
  if (!valid.length) throw validation(['There are no valid rows to import.']);
  const res = unwrap(await http.post('/admin/questions/bulk-import', {
    questions: valid.map((r) => toBackendQuestion(r.normalised, { classId: r.normalised.classId, chapterId: r.normalised.chapterId, status: 'DRAFT' })),
  }), 'result') || {};
  const imported = Number(res.successCount ?? res.insertedCount ?? res.imported ?? (Array.isArray(res.successful) ? res.successful.length : valid.length));
  return { imported, rejected: report.rows.length - imported };
}

/* ------------------------------------------------------------------ tests & series */

function mapTest(t) {
  const questionIds = (t.questionIds || []).map(idOf).filter(Boolean);
  const count = questionIds.length || Number(t.totalQuestions) || 0;
  const totalMarks = Number(t.totalMarks) || count;
  return {
    id: t._id,
    title: t.title || 'Untitled test',
    description: t.description || '',
    kind: String(t.testType || '').toUpperCase() === 'FULL_SYLLABUS' ? 'FULL' : 'CHAPTER',
    chapterIds: [idOf(t.chapterId)].filter(Boolean),
    questionIds,
    questionCount: count,
    durationSec: Number(t.durationSeconds) || 0,
    totalMarks,
    passingMarks: t.passingMarks ?? null,
    marksPerQ: count ? Math.round((totalMarks / count) * 100) / 100 : 1,
    negativeMarks: Number(t.negativeMarksPerQuestion ?? 0),
    allowNegativeTotal: Boolean(t.allowNegativeTotal),
    reattempt: true,
    maxAttempts: t.maxAttempts ?? null,
    publishFrom: t.publishFrom || null,
    publishTo: t.publishTo || null,
    instructions: Array.isArray(t.instructions) ? t.instructions : [],
    status: String(t.status || 'DRAFT').toUpperCase(),
  };
}

const mapSeries = (s) => ({
  id: s._id,
  title: s.title || 'Untitled series',
  description: s.description || '',
  testIds: (s.orderedTestIds || s.testIds || []).map(idOf).filter(Boolean),
  unlockMode: String(s.unlockMode || 'OPEN').toUpperCase() === 'SEQUENTIAL' ? 'SEQUENTIAL' : 'OPEN',
  status: String(s.status || 'DRAFT').toUpperCase(),
});

async function tests(grade) {
  const cls = await classFor(grade);
  if (!cls) return { tests: [], series: [] };
  const [t, s] = await Promise.all([
    get('/admin/tests', { classId: cls.id, subject: SUBJECT, page: 1, limit: MAX_LIMIT }),
    get('/admin/test-series', { classId: cls.id, subject: SUBJECT, page: 1, limit: MAX_LIMIT }),
  ]);
  return { tests: list(t, 'tests').map(mapTest), series: list(s, 'testSeries', 'series').map(mapSeries) };
}

/** The backend rejects an empty description, so it is only sent when there is one. */
const descriptionField = (body) => {
  const description = String(body.description || '').trim().slice(0, 1000);
  return description ? { description } : {};
};

async function testBody(body) {
  const cls = await classFor(body.classId);
  const errs = [];
  const questionIds = [...new Set(body.questionIds || [])];
  const marksPerQ = Number(body.marksPerQ) || 1;
  const totalMarks = Math.round(questionIds.length * marksPerQ * 100) / 100;
  const durationSeconds = Number(body.durationSec) || 0;
  if (!cls) errs.push('This class does not exist in the backend yet.');
  if (!body.title || body.title.trim().length < 4) errs.push('Enter a test title.');
  if (durationSeconds < 60) errs.push('Duration must be at least 1 minute.');
  if (body.kind === 'CHAPTER' && !body.chapterIds?.length) errs.push('Choose the chapter this test covers.');
  if (body.kind === 'CHAPTER' && body.chapterIds?.length > 1) errs.push('A chapter test covers exactly one chapter.');
  if (body.status === 'PUBLISHED' && !questionIds.length) errs.push('Attach at least one question.');
  const passingMarks = body.passingMarks != null && body.passingMarks !== '' ? Number(body.passingMarks) : Math.ceil(totalMarks * 0.4);
  if (passingMarks > totalMarks) errs.push('Passing marks cannot exceed total marks.');
  const negative = Number(body.negativeMarks) || 0;
  if (negative < 0) errs.push('Negative marks cannot be below 0.');
  const maxAttempts = body.maxAttempts === '' || body.maxAttempts == null ? null : Number(body.maxAttempts);
  if (maxAttempts != null && !(maxAttempts >= 1)) errs.push('Maximum attempts must be at least 1.');
  const publishFrom = body.publishFrom ? new Date(body.publishFrom).toISOString() : null;
  const publishTo = body.publishTo ? new Date(body.publishTo).toISOString() : null;
  if (publishFrom && publishTo && publishFrom >= publishTo) errs.push('The publish end must be after the start.');
  if (errs.length) throw validation(errs);
  const out = {
    title: body.title.trim().slice(0, 200),
    ...descriptionField(body),
    classId: cls.id,
    subject: SUBJECT,
    testType: body.kind === 'FULL' ? 'FULL_SYLLABUS' : 'CHAPTER',
    questionIds,
    durationSeconds,
    totalQuestions: questionIds.length,
    totalMarks,
    passingMarks,
    negativeMarksPerQuestion: negative,
    allowNegativeTotal: Boolean(body.allowNegativeTotal),
    instructions: (body.instructions || []).map((x) => String(x).trim()).filter(Boolean),
    status: body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
  };
  if (maxAttempts != null) out.maxAttempts = maxAttempts;
  if (publishFrom) out.publishFrom = publishFrom;
  if (publishTo) out.publishTo = publishTo;
  if (out.testType === 'CHAPTER') out.chapterId = body.chapterIds[0];
  return out;
}

async function seriesBody(body) {
  const cls = await classFor(body.classId);
  const errs = [];
  if (!cls) errs.push('This class does not exist in the backend yet.');
  if (!body.title || body.title.trim().length < 4) errs.push('Enter a series title.');
  if (body.status === 'PUBLISHED' && !body.testIds?.length) errs.push('Add at least one test to publish the series.');
  if (errs.length) throw validation(errs);
  return {
    title: body.title.trim().slice(0, 200),
    ...descriptionField(body),
    classId: cls.id,
    subject: SUBJECT,
    orderedTestIds: body.testIds || [],
    unlockMode: body.unlockMode === 'SEQUENTIAL' ? 'SEQUENTIAL' : 'OPEN',
    status: body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
  };
}

/* ------------------------------------------------------------------ config */

function configEntries(data) {
  const raw = unwrap(data, 'configs', 'config');
  if (Array.isArray(raw)) {
    return raw.map((c) => ({ key: c.key, value: c.value, description: c.description || null, updatedAt: c.updatedAt || null, updatedBy: c.updatedBy?.email || c.updatedBy || null }));
  }
  return Object.entries(raw || {}).map(([key, v]) => (v && typeof v === 'object' && 'value' in v
    ? { key, value: v.value, description: v.description || null, updatedAt: v.updatedAt || null, updatedBy: v.updatedBy?.email || v.updatedBy || null }
    : { key, value: v, description: null, updatedAt: null, updatedBy: null }))
    // updatedBy may be an internal id; only an email is meaningful to show.
    .map((e) => ({ ...e, updatedBy: typeof e.updatedBy === 'string' && e.updatedBy.includes('@') ? e.updatedBy : null }));
}

/* ------------------------------------------------------------------ students */

// The list has no consent fields; onboarding can only complete after consent is given.
const consentOf = (u) => Boolean(u.consentedAt || u.parentPermissionGranted || u.consent?.parentPermissionGranted || u.consent?.consentedAt)
  || String(u.onboardingStatus || '').toUpperCase() === 'COMPLETED';

async function mapStudentRow(u) {
  return {
    id: u.id || u._id,
    displayName: u.displayName || u.name || (u.email ? u.email.split('@')[0] : 'Student'),
    emailMasked: u.email ? maskContact(u.email) : '—',
    classId: u.class?.grade ?? await gradeOfClassId(u.classId),
    joinedAt: u.createdAt || null,
    lastActiveAt: u.lastActiveAt || u.lastLoginAt || null,
    consent: consentOf(u),
    status: String(u.status || 'ACTIVE').toUpperCase(),
  };
}

async function students(params = {}) {
  const cls = params.classId ? await classFor(params.classId) : null;
  const data = await get('/admin/students', { search: params.q || undefined, status: params.status || undefined, classId: cls?.id, page: 1, limit: MAX_LIMIT });
  let rows = await Promise.all(list(data, 'students', 'users').map(mapStudentRow));
  if (params.classId) rows = rows.filter((r) => r.classId === Number(params.classId));
  const info = pageInfo(data);
  return { total: params.classId ? rows.length : (info.total || rows.length), items: rows };
}

async function student(id) {
  const [data, consentData] = await Promise.all([get(`/admin/students/${enc(id)}`), get(`/admin/students/${enc(id)}/consent`).catch(() => null)]);
  const cd = consentData?.consent || {};
  const consent = cd.consent || {};
  const u = unwrap(data, 'student', 'user') || {};
  const g = data?.gamification || u.gamification || data?.summary || {};
  const streak = data?.streak || u.streak || {};
  const ls = u.learningSummary || {};
  const parent = u.parent || {};
  return {
    ...(await mapStudentRow(u)),
    parentMasked: cd.parentContactMasked || parent.contact || u.parentContactMasked || (u.parentContact ? maskContact(u.parentContact) : '—'),
    parentRelationship: cd.parentRelationship || parent.relationship || u.parentRelationship || null,
    consentAt: consent.consentedAt || u.consentedAt || u.consent?.consentedAt || null,
    lastLoginAt: u.lastLoginAt || null,
    consentMethod: consent.consentMethod ? String(consent.consentMethod).replace(/_/g, ' ').toLowerCase() : null,
    consentVersion: consent.consentVersion || null,
    summary: {
      // Only values the API actually sent; a missing number must not read as a real 0.
      totalXp: u.totalXp ?? g.totalXp ?? g.xp ?? null,
      goldCoins: u.coins ?? g.goldCoins ?? g.coins ?? g.coinBalance ?? null,
      currentStreak: u.currentStreak ?? streak.currentStreak ?? streak.current ?? g.currentStreak ?? null,
      attempts: ls.attempts ?? null,
      testsAttempted: ls.testsAttempted ?? null,
      accuracyOverall: ls.accuracy != null ? Math.round(ls.accuracy) : g.accuracy ?? null,
    },
  };
}

const STUDENT_ACTION_STATUS = { SUSPEND: 'SUSPENDED', UNSUSPEND: 'ACTIVE', REACTIVATE: 'ACTIVE', DEACTIVATE: 'DEACTIVATED', DELETE: 'DEACTIVATED' };

async function studentAction(id, action) {
  if (action === 'EXPORT') {
    const data = await http.post(`/admin/students/${enc(id)}/export`, {});
    return { ok: true, message: 'Data package downloaded. This export is logged.', download: data };
  }
  const status = STUDENT_ACTION_STATUS[action];
  if (!status) throw notAvailable(`Student action ${action}`);
  await http.patch(`/admin/students/${enc(id)}/status`, { status });
  const msg = { SUSPENDED: 'Student suspended.', ACTIVE: 'Student reinstated.', DEACTIVATED: 'Account deactivated.' }[status];
  return { ok: true, message: msg };
}

async function bulkExport() {
  const d = await get('/admin/students/export');
  return { rows: list(d, 'students') };
}

/* ------------------------------------------------------------------ analytics */

async function dashboard() {
  const to = new Date();
  const from = new Date(to.getTime() - 13 * 86400000);
  const day = (d) => d.toISOString().slice(0, 10);
  const [overview, daily, weak] = await Promise.all([
    get('/admin/analytics'),
    get('/admin/analytics/daily', { from: day(from), to: day(to) }).catch(() => null),
    get('/admin/analytics/weak-topics').catch(() => null),
  ]);
  const series = list(daily, 'analytics').map((r) => ({
    date: String(r.date || '').slice(5),
    dau: Number(r.dau ?? 0),
    registrations: Number(r.registrations ?? 0),
    challenges: Number(r.challengesCompleted ?? 0),
    doubts: Number(r.doubts ?? 0),
    aiCostInr: Number(r.aiCostInr ?? 0),
  })).sort((a, b) => a.date.localeCompare(b.date));
  const weakTopics = list(weak, 'weakTopics').map((t) => ({
    topicId: idOf(t.topicId), name: t.name || 'Topic', classId: t.classNumber ?? null, accuracy: Math.round(Number(t.accuracy ?? 0)), attempts: t.totalAttempts ?? null,
  }));
  return { analytics: unwrap(overview, 'analytics', 'overview') || {}, series, weakTopics };
}

/* ------------------------------------------------------------------ knowledge base */

async function kb() {
  const d = await get('/admin/kb', { page: 1, limit: MAX_LIMIT });
  const docs = list(d).map((x) => ({
    id: x._id,
    name: x.title || 'Document',
    description: x.description || '',
    fileType: x.fileType || null,
    status: String(x.status || 'INDEXING').toUpperCase(),
    chunks: Number(x.chunks ?? 0),
    lastSyncAt: x.lastSyncAt || x.indexedAt || null,
    error: x.error || x.errorMessage || null,
  }));
  return {
    docs,
    vectorStore: { totalChunks: docs.filter((x) => x.status === 'INDEXED').reduce((n, x) => n + x.chunks, 0), lastSyncAt: docs.map((x) => x.lastSyncAt).filter(Boolean).sort().pop() || null },
  };
}

async function createKbDoc({ title, description, file, sourceUrl }) {
  const name = String(title || '').trim();
  if (name.length < 3) throw validation(['Enter a document title.']);
  if (!file && !HTTPS.test(sourceUrl || '')) throw validation(['Upload a PDF or paste an https link.']);
  const url = file ? await uploadPdf(file) : sourceUrl.trim();
  return http.post('/admin/kb', {
    title: name.slice(0, 200),
    ...(description?.trim() ? { description: description.trim().slice(0, 1000) } : {}),
    fileType: 'application/pdf',
    sourceUrl: url,
  });
}

/* ------------------------------------------------------------------ moderation */

/** A reported doubt arrives with its messages: the question plus what the tutor answered. */
function doubtSnapshot(doubt) {
  const messages = doubt && typeof doubt === 'object' ? doubt.messages || [] : [];
  if (!messages.length) return null;
  const input = messages.find((x) => x.role === 'student')?.text || '';
  const steps = messages.filter((x) => x.role !== 'student').flatMap((x) => String(x.text || '').split(/\n+/)).map((x) => x.trim()).filter(Boolean);
  return { input, concept: null, steps: steps.length ? steps : null };
}

/** Question reports and AI-answer reports share one queue. */
function mapModeration(m) {
  const q = typeof m.questionId === 'object' && m.questionId ? m.questionId : m.question || null;
  const isDoubt = Boolean(m.doubtId) || String(m.type || m.targetType || '').toUpperCase().includes('DOUBT');
  return {
    id: m._id,
    type: isDoubt ? 'AI_ANSWER_REPORT' : 'QUESTION_REPORT',
    status: String(m.status || 'OPEN').toUpperCase(),
    reason: m.reason || null,
    note: m.note || '',
    questionId: idOf(m.questionId),
    question: q ? { text: q.questionText || '', status: Q_STATUS_FROM_API[String(q.status || '').toUpperCase()] || q.status } : null,
    at: m.createdAt || null,
    topicName: m.topicName || null,
    studentRef: null, // never a name or contact (F12-12)
    snapshot: m.snapshot ? { input: m.snapshot.input || m.snapshot.text || '', concept: m.snapshot.concept || null, steps: m.snapshot.steps || null } : doubtSnapshot(m.doubtId),
    resolution: m.resolution?.action || m.resolutionAction || m.action || null,
    // resolvedBy is a raw user id today; only ever show a readable email.
    resolvedBy: m.resolvedBy?.email || m.resolvedByEmail || null,
    resolutionNote: m.resolutionNote || null,
  };
}

async function moderation(status) {
  const d = await get('/admin/moderation', { status: status || undefined, page: 1, limit: MAX_LIMIT });
  return { items: list(d, 'reports').map(mapModeration) };
}

const resolveModeration = (id, { action, note }) => http.post(`/admin/moderation/${enc(id)}/resolve`, { action, ...(note?.trim() ? { note: note.trim() } : {}) });

/* ------------------------------------------------------------------ audit */

function mapAudit(a) {
  const actor = a.actor || a.user || a.userId || a.performedBy || a.adminId;
  return {
    id: a._id,
    at: a.createdAt || a.timestamp || null,
    actor: a.adminEmail || a.actorEmail || a.userEmail || (actor && typeof actor === 'object' ? actor.email || actor.displayName || actor._id : actor) || '—',
    role: (actor && typeof actor === 'object' ? actor.role : null) || a.role || '',
    action: a.action || '—',
    target: [a.resourceType || a.resource, a.resourceId && idOf(a.resourceId)].filter(Boolean).join(' · ') || '—',
    before: a.before ?? a.previousValue ?? a.changes?.before ?? null,
    after: a.after ?? a.newValue ?? a.changes?.after ?? a.metadata ?? null,
  };
}

async function audit(q) {
  const data = await get('/admin/audit-logs', { page: 1, limit: MAX_LIMIT });
  let items = list(data, 'logs', 'auditLogs').map(mapAudit);
  if (q) {
    const s = q.toLowerCase();
    items = items.filter((a) => `${a.actor} ${a.action} ${a.target}`.toLowerCase().includes(s));
  }
  return { items, total: pageInfo(data).total || items.length };
}

/* ------------------------------------------------------------------ export */

const na = (feature) => () => Promise.reject(notAvailable(feature));

export const adminApi = {
  caps,

  async login({ email, password }) {
    await firebaseSignIn({ email, password });
    const admin = await verifyAdmin();
    if (await needsTwoFactor()) return { twoFactor: true, admin };
    return { session: { token: admin.uid, admin } };
  },
  /** Returns the otpauth URL once. It contains the TOTP secret, so it is never stored or logged. */
  setupTwoFactor: async () => (await http.post('/admin/auth/2fa/setup', {})).otpauthUrl,
  async verifyTwoFactor(code) {
    await http.post('/admin/auth/2fa/verify', { code });
    const admin = await verifyAdmin();
    return { session: { token: admin.uid, admin } };
  },
  verify: na('Admin two-step verification'),
  /** Firebase still remembers the admin: used to go straight to the code step when 2FA lapses. */
  async signedInAdmin() {
    const fb = (await authReady()) || currentFirebaseUser();
    if (!fb) return null;
    try { return await verifyAdmin(); } catch { return null; }
  },
  async me() {
    const fb = (await authReady()) || currentFirebaseUser();
    if (!fb) throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Please sign in again.', { status: 401 });
    const admin = await verifyAdmin();
    if (await needsTwoFactor()) throw new ApiError(ERROR_CODES.TWO_FACTOR_REQUIRED, undefined, { status: 403 });
    return admin;
  },
  logout: () => firebaseSignOut(),

  dashboard,

  curriculum,
  // New items start hidden: the backend ignores isActive on create, so it is set right after.
  createChapter: async ({ classId, name }) => {
    const cls = await classFor(classId);
    if (!cls) throw validation([`Class ${classId} does not exist in the backend yet.`]);
    const chapters = await listChapters(cls.id);
    const n = Math.max(0, ...chapters.map((c) => c.chapterNumber || 0)) + 1;
    const chapter = unwrap(await http.post('/admin/curriculum/chapters', {
      classId: cls.id, name: String(name).trim().slice(0, 120), chapterNumber: n, subject: SUBJECT, order: n, isActive: false,
    }), 'chapter');
    await setActive('chapters', chapter._id, 'DRAFT');
    return chapter;
  },
  updateChapter: (id, body) => patchCurriculum('chapters', id, body),
  deleteChapter: (id) => http.del(`/admin/curriculum/chapters/${enc(id)}`),
  deleteTopic: (id) => http.del(`/admin/curriculum/topics/${enc(id)}`),
  reorderChapters: async ({ classId, chapterIds }) => {
    const cls = await classFor(classId);
    return renumber('chapters', 'chapterNumber', chapterIds, await listChapters(cls.id));
  },
  addTopic: async (chapterId, { name }) => {
    const topics = await listTopics(chapterId);
    const n = Math.max(0, ...topics.map((t) => t.topicNumber || 0)) + 1;
    const topic = unwrap(await http.post('/admin/curriculum/topics', {
      chapterId, name: String(name).trim().slice(0, 120), topicNumber: n, order: n, isActive: false,
    }).catch((e) => {
      if (e.code === ERROR_CODES.NOT_FOUND) throw validation(['Publish this chapter first, then add its topics.']);
      throw e;
    }), 'topic');
    await setActive('topics', topic._id, 'DRAFT');
    return topic;
  },
  reorderTopics: async (chapterId, topicIds) => renumber('topics', 'topicNumber', topicIds, await listTopics(chapterId)),
  updateTopic: (id, body) => patchCurriculum('topics', id, body),

  material,
  saveMaterial,
  uploadPdf,

  questions,
  question,
  createQuestion,
  updateQuestion,
  setQuestionStatus,
  duplicateQuestion,
  deleteQuestion,
  importSpec,
  validateImport: validateImportServer,
  commitImport,

  tests,
  createTest: async (body) => mapTest(unwrap(await http.post('/admin/tests', await testBody(body)), 'test')),
  updateTest: async (id, body) => mapTest(unwrap(await http.put(`/admin/tests/${enc(id)}`, await testBody(body)), 'test')),
  deleteTest: (id) => http.del(`/admin/tests/${enc(id)}`),
  createSeries: async (body) => mapSeries(unwrap(await http.post('/admin/test-series', await seriesBody(body)), 'testSeries', 'series')),
  updateSeries: async (id, body) => mapSeries(unwrap(await http.put(`/admin/test-series/${enc(id)}`, await seriesBody(body)), 'testSeries', 'series')),
  deleteSeries: (id) => http.del(`/admin/test-series/${enc(id)}`),

  kb,
  createKbDoc,
  reindexKb: (id) => http.post(`/admin/kb/${enc(id)}/reindex`, {}),
  removeKb: (id) => http.del(`/admin/kb/${enc(id)}`),

  config: async () => {
    const [cfg, hist] = await Promise.all([get('/admin/config'), get('/admin/config/history', { page: 1, limit: 30 }).catch(() => null)]);
    return {
      entries: configEntries(cfg),
      history: list(hist).map((h) => ({ key: h.key, before: h.before, after: h.after, by: h.byEmail || h.by || '—', at: h.createdAt })),
    };
  },
  saveConfigKey: (key, value) => http.patch(`/admin/config/${enc(key)}`, { value }),
  saveConfig: na('Versioned remote config'),

  students,
  student,
  studentAction,
  bulkExport,

  moderation,
  resolveModeration,

  audit,
};
