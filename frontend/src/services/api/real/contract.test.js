import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/firebase', () => ({
  firebaseSignIn: vi.fn(), firebaseSignOut: vi.fn(), firebaseSignUp: vi.fn(), firebaseGoogleSignIn: vi.fn(), firebaseResetPassword: vi.fn(),
  firebaseReloadUser: vi.fn(async () => ({ emailVerified: true })), firebaseResendVerification: vi.fn(), authReady: vi.fn(async () => null),
  currentFirebaseUser: vi.fn(() => ({ uid: 'u1', email: 'student@example.com', emailVerified: false, providerData: [] })),
  getIdToken: vi.fn(async () => 'token'), firebaseConfigured: () => true,
}));

const { doubtApi } = await import('./doubts');
const { challengeApi, mistakeApi, practiceApi, progressApi, testApi } = await import('./student');
const { adminApi } = await import('./admin');
const { mapBackendError, ERROR_CODES } = await import('../../errors');

/** Responses are the saved examples from GyanGrid_Backend_Postman_Collection_Final.json. */
let routes;
const calls = [];
const ok = (data, status = 200) => ({ status, body: { success: true, message: 'ok', data } });
const fail = (status, errorCode, message) => ({ status, body: { success: false, message, errorCode } });

beforeEach(() => {
  routes = {};
  calls.length = 0;
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const u = new URL(url, 'http://x');
    const path = u.pathname.replace(/^.*\/api\/v1/, '');
    const method = init.method || 'GET';
    calls.push({ method, path, search: u.search, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    const hit = routes[`${method} ${path}`] || fail(404, 'NOT_FOUND', 'Route not found');
    return { ok: hit.status < 400, status: hit.status, json: async () => hit.body };
  }));
});
afterEach(() => vi.unstubAllGlobals());
const called = (method, path) => calls.find((c) => c.method === method && c.path === path);

describe('AI doubts', () => {
  it('maps the structured answer', async () => {
    routes['POST /doubts'] = ok({ doubtId: 'd1', status: 'ANSWERED', refused: false, answer: { steps: ['Step 1'], finalAnswer: '$A$', conceptNote: 'Half' } }, 201);
    const r = await doubtApi.create({ text: 'Why half base times height?' });
    expect(r).toEqual({ id: 'd1', refused: false, answer: { steps: ['Step 1'], finalAnswer: '$A$', conceptNote: 'Half' } });
    expect(called('POST', '/doubts').body).toEqual({ text: 'Why half base times height?' });
  });

  it('surfaces a maths-only refusal without a doubt id', async () => {
    routes['POST /doubts'] = ok({ doubtId: null, status: 'REFUSED', refused: true, refusal: 'Maths only' });
    expect(await doubtApi.create({ text: 'Who won the match?' })).toEqual({ id: null, refused: true, refusal: 'Maths only' });
  });

  it('counts follow-ups from the message history', async () => {
    routes['GET /doubts/d1'] = ok({ doubtId: 'd1', status: 'ANSWERED', messages: [
      { role: 'student', text: 'q', imageUrl: null, createdAt: '2026-10-28T09:00:00.000Z' }, { role: 'tutor', text: 'a', imageUrl: null },
      { role: 'student', text: 'again', imageUrl: null }, { role: 'tutor', text: 'b', imageUrl: null },
    ] });
    const d = await doubtApi.get('d1');
    expect(d.followUpsUsed).toBe(1);
    expect(d.followUpsLeft).toBe(1);
  });

  it('never renders a non-https image url', async () => {
    routes['GET /doubts/d1'] = ok({ doubtId: 'd1', messages: [{ role: 'student', text: 'q', imageUrl: 'javascript:alert(1)' }] });
    expect((await doubtApi.get('d1')).messages[0].imageUrl).toBeNull();
  });

  it('maps quota fields', async () => {
    routes['GET /doubts/quota'] = ok({ perDay: 5, usedToday: 1, perMonth: 50, usedThisMonth: 4, imagesPerDay: 2, imagesUsedToday: 1, resetsAt: '2026-10-29T18:30:00.000Z' });
    expect(await doubtApi.quota()).toMatchObject({ limit: 5, usedToday: 1, imageLimit: 2, imagesUsed: 1 });
  });

  it('treats a duplicate report as already reported', async () => {
    routes['POST /doubts/d1/report'] = fail(409, 'DUPLICATE_REPORT', 'already reported');
    expect(await doubtApi.report('d1', { reason: 'UNCLEAR' })).toEqual({ reported: true, duplicate: true });
  });

  it('uploads a photo before asking, without sending the bearer token to storage', async () => {
    routes['POST /uploads/signed-url'] = ok({ uploadId: 'up1', url: 'https://storage.example/put', headers: { 'Content-Type': 'image/jpeg' } }, 201);
    routes['PUT /put'] = { status: 200, body: null };
    routes['POST /doubts'] = ok({ doubtId: 'd2', status: 'ANSWERED', refused: false, answer: { steps: [] } }, 201);
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const put = vi.fn(async () => ({ ok: true, status: 200 }));
    const base = globalThis.fetch;
    vi.stubGlobal('fetch', (url, init) => (String(url).startsWith('https://storage.example') ? put(url, init) : base(url, init)));
    await doubtApi.create({ imageBlob: blob });
    expect(put.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(called('POST', '/uploads/signed-url').body).toEqual({ kind: 'IMAGE', contentType: 'image/jpeg', sizeBytes: 1 });
    expect(called('POST', '/doubts').body).toEqual({ imageUploadId: 'up1' });
  });
});

describe('error codes', () => {
  it.each([
    [503, 'SERVICE_UNAVAILABLE', ERROR_CODES.SERVICE_UNAVAILABLE],
    [429, 'QUOTA_EXCEEDED', ERROR_CODES.QUOTA_EXCEEDED],
    [429, 'FOLLOW_UP_LIMIT_EXCEEDED', ERROR_CODES.FOLLOW_UP_LIMIT],
    [429, 'RATE_LIMIT_EXCEEDED', ERROR_CODES.RATE_LIMITED],
    [409, 'DUPLICATE_REPORT', ERROR_CODES.CONFLICT],
  ])('%s %s', (status, errorCode, expected) => {
    expect(mapBackendError(status, { errorCode, message: 'x' }).code).toBe(expected);
  });

  it('never shows raw 5xx messages', () => {
    expect(mapBackendError(503, { errorCode: 'SERVICE_UNAVAILABLE', message: 'Set FIREBASE_STORAGE_BUCKET' }).message).not.toMatch(/FIREBASE/);
  });
});

describe('mistake bank queries', () => {
  beforeEach(() => {
    routes['GET /mistakes'] = ok({ items: [{ _id: 'm1', status: 'ACTIVE', isArchived: true, question: { questionText: 'q' } }], pagination: { total: 1 } });
    routes['GET /curriculum/classes/undefined/chapters'] = ok({ chapters: [] });
  });

  it('uses dueOnly for the due tab', async () => {
    await mistakeApi.list({ status: 'DUE' });
    expect(calls.find((c) => c.search.includes('limit=50')).search).toContain('dueOnly=true');
  });

  it('uses isArchived, never an ARCHIVED status', async () => {
    const r = await mistakeApi.list({ status: 'ARCHIVED' });
    const q = calls.find((c) => c.search.includes('limit=50')).search;
    expect(q).toContain('isArchived=true');
    expect(q).not.toContain('status=ARCHIVED');
    expect(r.items[0].status).toBe('ARCHIVED');
  });
});

/** Responses captured from the live API; the first version of the adapters broke on each of these. */
describe('live response shapes', () => {
  const question = { questionId: 'q1', questionText: 'Q', questionType: 'MCQ', options: ['1', '2'], yourAnswer: '2', correctAnswer: '2', isCorrect: true, topicId: 't1', topicName: 'Topic One', chapterId: 'c1', chapterName: 'Chapter One',
    breakdown: { chapters: [{ chapterId: 'c1', chapterName: null, correct: 1, total: 1 }], topics: [{ topicId: 't1', topicName: null, correct: 1, total: 1 }, { topicId: 't2', topicName: null, correct: 0, total: 1 }] } };

  it('reads a numeric score and ledger-style awards on challenge completion', async () => {
    routes['GET /daily-challenge'] = ok({ challenge: { _id: 'dc1', status: 'ACTIVE', totalQuestions: 1 }, questions: [{ _id: 'q1', questionText: 'Q', questionType: 'MCQ', options: ['1', '2'] }] });
    routes['POST /daily-challenge/dc1/complete'] = ok({ score: 1, total: 1, awarded: { xp: { awarded: true, transaction: { amount: 50 } }, coins: { awarded: true, transaction: { amount: 10 } } }, streak: { currentStreak: 1, longestStreak: 1 }, questions: [question] });
    const r = await challengeApi.submit();
    expect(r).toMatchObject({ score: 1, total: 1, scorePct: 100, xpAwarded: 50, coinsAwarded: 10 });
    expect(r.diagnosis[0]).toMatchObject({ name: 'Topic One', status: 'STRONG' });
  });

  it('treats an award that was not given as zero', async () => {
    routes['GET /daily-challenge'] = ok({ challenge: { _id: 'dc1', status: 'ACTIVE', totalQuestions: 1 }, questions: [] });
    routes['POST /daily-challenge/dc1/complete'] = ok({ score: 0, total: 1, awarded: { xp: { awarded: false }, coins: { awarded: false } } });
    await challengeApi.today();
    expect(await challengeApi.submit()).toMatchObject({ xpAwarded: 0, coinsAwarded: 0 });
  });

  it('never marks topics of skipped questions as weak when practice ends early', async () => {
    routes['POST /practice/p1/complete'] = ok({ score: 1, total: 5, awarded: { xp: null, coins: null }, questions: [question, { ...question, questionId: 'q2', topicId: 't2', yourAnswer: null, breakdown: undefined }] });
    routes['GET /rewards/xp/history'] = ok({ items: [{ sourceId: 'p1', amount: 10 }] });
    routes['GET /rewards/coins/history'] = ok({ items: [] });
    const r = await practiceApi.finish('p1');
    expect(r).toMatchObject({ total: 5, answered: 1, correct: 1, accuracy: 100, xpAwarded: 10 });
    expect(r.diagnosis.map((d) => d.topicId)).toEqual(['t1']);
  });

  it('turns an ISO review time into an IST date key so dates format safely', async () => {
    routes['GET /mistakes'] = ok({ items: [{ _id: 'm1', status: 'ACTIVE', nextReviewAt: '2026-11-03T10:25:23.643Z', dueToday: false, question: { questionText: 'q' } }], pagination: { total: 1 } });
    routes['GET /curriculum/classes/undefined/chapters'] = ok({ chapters: [] });
    expect((await mistakeApi.list({})).items[0].nextReviewAt).toBe('2026-11-03');
  });

  it('derives the attempt score from history rows and time from the session', async () => {
    routes['GET /tests/sessions/s1/result'] = ok({ test: { title: 'T', durationSeconds: 900 }, result: { testId: 't1', totalQuestions: 2, correctCount: 1, incorrectCount: 1, totalMarks: 4, obtainedMarks: 2, percentage: 50, submittedAt: '2026-10-31T10:35:41.000Z' }, questions: [question] });
    routes['GET /tests/history'] = ok({ items: [{ sessionId: 's1', startedAt: '2026-10-31T10:34:41.000Z' }] });
    routes['GET /rewards/xp/history'] = ok({ items: [] });
    routes['GET /rewards/coins/history'] = ok({ items: [] });
    const r = await testApi.result('s1');
    expect(r.timeTakenSec).toBe(60);
    expect(r.byChapter[0]).toMatchObject({ name: 'Chapter One', accuracy: 100 });
  });
});

describe('parent report', () => {
  it('flattens topic objects', async () => {
    routes['GET /profile/parent-report/preview'] = ok({ weekStart: '2026-10-19', weekEnd: '2026-10-25', atAGlance: { daysActive: 5, challengesDone: 4, testsTaken: 1, accuracy: 72, accuracyChange: 6 }, strongTopics: [{ topicId: 't', name: 'Linear Equations' }], focusTopics: [], sentTo: 'p***@example.com', nextSendAt: '2026-11-01T02:30:00.000Z' });
    const r = await progressApi.parentReport();
    expect(r.strongTopics).toEqual(['Linear Equations']);
    expect(r.atAGlance.accuracy).toBe(72);
  });

  it('remembers the delivery id so the link can be revoked', async () => {
    routes['POST /profile/parent-report/deliver'] = ok({ accepted: true, status: 'ACCEPTED', deliveryId: 'x1' });
    routes['POST /profile/parent-report/revoke'] = ok({ revoked: true, deliveryId: 'x1' });
    expect((await progressApi.deliverParentReport()).status).toBe('ACCEPTED');
    await progressApi.revokeParentReport('x1');
    expect(called('POST', '/profile/parent-report/revoke').body).toEqual({ deliveryId: 'x1' });
  });

  it('sends only retry:true on a retry', async () => {
    routes['POST /profile/parent-report/deliver'] = ok({ status: 'UNCONFIGURED', reason: 'EMAIL_NOT_CONFIGURED' });
    const r = await progressApi.deliverParentReport({ retry: true });
    expect(called('POST', '/profile/parent-report/deliver').body).toEqual({ retry: true });
    expect(r.status).toBe('UNCONFIGURED');
  });

  it('opens the public report with no bearer token', async () => {
    routes['GET /parent-report/view'] = ok({ report: { atAGlance: { daysActive: 5 }, strongTopics: [], focusTopics: [] }, student: { displayName: 'Sample Student' }, weekStart: '2026-10-19', weekEnd: '2026-10-25', expiresAt: '2026-11-13T12:00:00.000Z' });
    const r = await progressApi.parentReportView('tok');
    expect(r.studentName).toBe('Sample Student');
    expect(called('GET', '/parent-report/view').headers.Authorization).toBeUndefined();
  });
});

describe('admin', () => {
  it('reads analytics, daily series and weak topics', async () => {
    routes['GET /admin/analytics'] = ok({ totalStudents: 10 });
    routes['GET /admin/analytics/daily'] = ok({ analytics: [{ date: '2026-10-15', dau: 42, registrations: 8, challengesCompleted: 35, doubts: 0, aiCostInr: 0 }] });
    routes['GET /admin/analytics/weak-topics'] = ok({ weakTopics: [{ topicId: 't', name: 'Linear Equations', classNumber: 8, accuracy: 38.5, totalAttempts: 120 }] });
    const d = await adminApi.dashboard();
    expect(d.series[0]).toMatchObject({ date: '10-15', dau: 42, challenges: 35 });
    expect(d.weakTopics[0]).toMatchObject({ name: 'Linear Equations', classId: 8, accuracy: 39 });
  });

  it('reorders through free numbers because chapter numbers are unique', async () => {
    routes['GET /admin/curriculum/classes'] = ok({ classes: [{ _id: 'c8', grade: 8, boardId: 'b' }] });
    routes['GET /admin/curriculum/chapters'] = ok({ chapters: [{ _id: 'a', chapterNumber: 1 }, { _id: 'b', chapterNumber: 2 }, { _id: 'c', chapterNumber: 3 }] });
    routes['PATCH /admin/curriculum/chapters/a'] = ok({});
    routes['PATCH /admin/curriculum/chapters/b'] = ok({});
    await adminApi.reorderChapters({ classId: 8, chapterIds: ['b', 'a', 'c'] });
    const sent = calls.filter((c) => c.method === 'PATCH').map((c) => [c.path.split('/').pop(), c.body.chapterNumber]);
    expect(sent).toEqual([['b', 4], ['a', 5], ['b', 1], ['a', 2]]);
  });

  it('hides a new chapter straight after creating it', async () => {
    routes['GET /admin/curriculum/classes'] = ok({ classes: [{ _id: 'c8', grade: 8, boardId: 'b' }] });
    routes['GET /admin/curriculum/chapters'] = ok({ chapters: [{ _id: 'a', chapterNumber: 13 }] });
    routes['POST /admin/curriculum/chapters'] = ok({ chapter: { _id: 'n', isActive: true } }, 201);
    routes['PATCH /admin/curriculum/chapters/n/status'] = ok({});
    await adminApi.createChapter({ classId: 8, name: 'New' });
    expect(called('POST', '/admin/curriculum/chapters').body.chapterNumber).toBe(14);
    expect(called('PATCH', '/admin/curriculum/chapters/n/status').body).toEqual({ isActive: false });
  });

  it('sends true/false answers as stored text, and material statuses in lower case', async () => {
    const id = 'a'.repeat(24);
    routes['POST /admin/questions/bulk-import/validate'] = ok({ rows: [{ row: 1, valid: true, errors: [] }] });
    routes['POST /admin/questions/bulk-import'] = ok({ inserted: 1 });
    await adminApi.commitImport([{ classId: id, chapterId: id, topicId: id, type: 'TRUE_FALSE', difficulty: 'EASY', questionText: 'Two is an even number.', correctAnswer: 'true', explanation: 'It divides by 2' }]);
    expect(called('POST', '/admin/questions/bulk-import').body.questions[0].correctAnswer).toBe('TRUE');
  });

  it('maps knowledge base documents', async () => {
    routes['GET /admin/kb'] = ok({ items: [{ _id: 'k1', title: 'NCERT Grade 6', status: 'INDEXED', chunks: 145 }], pagination: { total: 1 } });
    const r = await adminApi.kb();
    expect(r.docs[0]).toMatchObject({ id: 'k1', name: 'NCERT Grade 6', status: 'INDEXED', chunks: 145 });
    expect(r.vectorStore.totalChunks).toBe(145);
  });

  it('creates a knowledge base document from a link as JSON', async () => {
    routes['POST /admin/kb'] = ok({ doc: { _id: 'k1', status: 'INDEXING' } }, 201);
    await adminApi.createKbDoc({ title: 'NCERT', sourceUrl: 'https://example.com/a.pdf' });
    expect(called('POST', '/admin/kb').body).toEqual({ title: 'NCERT', fileType: 'application/pdf', sourceUrl: 'https://example.com/a.pdf' });
  });

  it('rejects a non-https knowledge base link', async () => {
    await expect(adminApi.createKbDoc({ title: 'NCERT', sourceUrl: 'http://example.com/a.pdf' })).rejects.toThrow(/https/);
  });

  it('labels config history with the admin email', async () => {
    routes['GET /admin/config'] = ok({ configs: [{ key: 'maintenanceMode', value: false }] });
    routes['GET /admin/config/history'] = ok({ items: [{ key: 'mistakeReviewCycleDays', before: 3, after: 5, by: 'admin-001', byEmail: 'admin@gyangrid.test', createdAt: '2026-10-15T12:00:00.000Z' }] });
    const c = await adminApi.config();
    expect(c.history[0]).toMatchObject({ key: 'mistakeReviewCycleDays', by: 'admin@gyangrid.test' });
  });

  it('returns exported students as rows', async () => {
    routes['GET /admin/students/export'] = ok({ students: [{ id: '1', displayName: 'A', parentContactMasked: '******1234', status: 'ACTIVE' }] });
    expect((await adminApi.bulkExport()).rows).toHaveLength(1);
  });

  it('merges server validation into the import report', async () => {
    const id = 'a'.repeat(24);
    routes['POST /admin/questions/bulk-import/validate'] = ok({ rows: [{ row: 1, valid: false, errors: ['Bad topic'] }], totalRows: 1, validRows: 0, invalidRows: 1 });
    const r = await adminApi.validateImport([{ classId: id, chapterId: id, topicId: id, type: 'MCQ', difficulty: 'EASY', questionText: 'What is 8 × 7?', optionA: '54', optionB: '56', correctAnswer: 'B', explanation: '8 × 7 = 56' }]);
    expect(r.rows[0]).toMatchObject({ valid: false, errors: ['Bad topic'] });
  });
});
