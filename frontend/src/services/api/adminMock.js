import { http } from '../http';

/** Admin console API (/admin/*). Every call carries the admin-scoped token, never the student one. */
const opts = { scope: 'admin' };
const enc = encodeURIComponent;

export const adminApi = {
  login: (body) => http.post('/admin/auth/login', body, { ...opts, skipAuthRedirect: true }),
  verify: (body) => http.post('/admin/auth/verify', body, { ...opts, skipAuthRedirect: true }),
  me: () => http.get('/admin/me', null, opts),
  logout: () => http.post('/admin/auth/logout', {}, { ...opts, skipAuthRedirect: true }),
  dashboard: () => http.get('/admin/dashboard', null, opts),

  curriculum: (classId) => http.get('/admin/curriculum', { classId }, opts),
  createChapter: (body) => http.post('/admin/curriculum/chapters', body, opts),
  updateChapter: (id, body) => http.patch(`/admin/curriculum/chapters/${enc(id)}`, body, opts),
  reorderChapters: (body) => http.post('/admin/curriculum/reorder', body, opts),
  addTopic: (chapterId, body) => http.post(`/admin/curriculum/chapters/${enc(chapterId)}/topics`, body, opts),
  reorderTopics: (chapterId, topicIds) => http.post(`/admin/curriculum/chapters/${enc(chapterId)}/reorder-topics`, { topicIds }, opts),
  updateTopic: (id, body) => http.patch(`/admin/curriculum/topics/${enc(id)}`, body, opts),

  material: (topicId) => http.get(`/admin/materials/${enc(topicId)}`, null, opts),
  saveMaterial: (topicId, body) => http.put(`/admin/materials/${enc(topicId)}`, body, opts),

  questions: (params) => http.get('/admin/questions', params, opts),
  question: (id) => http.get(`/admin/questions/${enc(id)}`, null, opts),
  createQuestion: (body) => http.post('/admin/questions', body, opts),
  updateQuestion: (id, body) => http.patch(`/admin/questions/${enc(id)}`, body, opts),
  setQuestionStatus: (id, status) => http.post(`/admin/questions/${enc(id)}/status`, { status }, opts),
  duplicateQuestion: (id) => http.post(`/admin/questions/${enc(id)}/duplicate`, {}, opts),
  validateImport: (rows) => http.post('/admin/questions/import/validate', { rows }, opts),
  commitImport: (rows) => http.post('/admin/questions/import/commit', { rows }, opts),

  tests: (classId) => http.get('/admin/tests', { classId }, opts),
  createTest: (body) => http.post('/admin/tests', body, opts),
  updateTest: (id, body) => http.patch(`/admin/tests/${enc(id)}`, body, opts),
  createSeries: (body) => http.post('/admin/series', body, opts),
  updateSeries: (id, body) => http.patch(`/admin/series/${enc(id)}`, body, opts),

  kb: () => http.get('/admin/kb', null, opts),
  uploadKb: (body) => http.post('/admin/kb', body, opts),
  reindexKb: (id) => http.post(`/admin/kb/${enc(id)}/reindex`, {}, opts),
  removeKb: (id) => http.del(`/admin/kb/${enc(id)}`, {}, opts),

  config: () => http.get('/admin/config', null, opts),
  saveConfig: (config, note) => http.put('/admin/config', { config, note }, opts),

  students: (params) => http.get('/admin/students', params, opts),
  student: (id) => http.get(`/admin/students/${enc(id)}`, null, opts),
  studentAction: (id, action) => http.post(`/admin/students/${enc(id)}/action`, { action }, opts),
  bulkExport: () => http.post('/admin/students/export', {}, opts),

  moderation: (status) => http.get('/admin/moderation', { status }, opts),
  resolveModeration: (id, body) => http.post(`/admin/moderation/${enc(id)}/resolve`, body, opts),

  audit: (q) => http.get('/admin/audit', { q }, opts),
};
