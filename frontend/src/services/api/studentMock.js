import { http } from '../http';

/**
 * Student API surface (PRD section 20). Components never call `http` directly — only these functions,
 * so swapping the mock for the real backend is a configuration change, not a refactor.
 */
const enc = encodeURIComponent;

export const authApi = {
  register: (body) => http.post('/auth/register', body, { skipAuthRedirect: true }),
  login: (body) => http.post('/auth/login', body, { skipAuthRedirect: true }),
  google: (body) => http.post('/auth/google', body, { skipAuthRedirect: true }),
  forgotPassword: (email) => http.post('/auth/forgot', { email }, { skipAuthRedirect: true }),
  logout: () => http.post('/auth/logout', {}, { skipAuthRedirect: true }),
  verifyEmail: () => http.post('/auth/verify-email'),
  me: () => http.get('/me'),
  saveProfile: (body) => http.post('/auth/profile', body),
};

export const homeApi = { get: () => http.get('/home') };

/** Mock curriculum lookup used by onboarding (the mock identifies classes by grade). */
export const curriculumApi = {
  boardsWithClasses: async () => [{
    _id: 'NCERT_CBSE', code: 'CBSE', name: 'NCERT / CBSE',
    classes: [6, 7, 8, 9, 10].map((g) => ({ _id: g, grade: g, name: `Class ${g}` })),
  }],
};

export const learnApi = {
  curriculum: () => http.get('/curriculum'),
  topic: (topicId) => http.get(`/topics/${enc(topicId)}`),
  recordView: (topicId, seconds) => http.post(`/material/${enc(topicId)}/view`, { seconds }),
};

export const challengeApi = {
  today: () => http.post('/challenge/today'),
  answer: (body) => http.post('/challenge/answer', body),
  submit: () => http.post('/challenge/submit'),
  result: () => http.get('/challenge/result'),
};

export const practiceApi = {
  start: (body) => http.post('/practice/start', body),
  get: (id) => http.get(`/practice/${enc(id)}`),
  submitAnswer: (body) => http.post('/attempts/submit', body),
  finish: (id) => http.post(`/practice/${enc(id)}/finish`),
};

export const testApi = {
  list: () => http.get('/tests'),
  get: (id) => http.get(`/tests/${enc(id)}`),
  start: (id) => http.post(`/tests/${enc(id)}/start`),
  autosave: (id, body) => http.post(`/tests/${enc(id)}/autosave`, body),
  submit: (id, body) => http.post(`/tests/${enc(id)}/submit`, body),
  result: (attemptId) => http.get(`/test-attempts/${enc(attemptId)}`),
  series: (id) => http.get(`/test-series/${enc(id)}`),
};

export const doubtApi = {
  create: (body) => http.post('/doubts', body, { ai: true }),
  list: () => http.get('/doubts'),
  quota: () => http.get('/doubts/quota'),
  get: (id) => http.get(`/doubts/${enc(id)}`),
  followUp: (id, body) => http.post(`/doubts/${enc(id)}/follow-up`, body, { ai: true }),
  feedback: (id, body) => http.post(`/doubts/${enc(id)}/feedback`, body),
  signedUrl: (body) => http.post('/uploads/signed-url', body),
  transcribe: (body) => http.post('/stt/transcribe', body, { ai: true }),
};

export const mistakeApi = {
  list: (params) => http.get('/mistakes', params),
  get: (id) => http.get(`/mistakes/${enc(id)}`),
  retry: (id, body) => http.post(`/mistakes/${enc(id)}/retry`, body),
  archive: (id, archived) => http.post(`/mistakes/${enc(id)}/archive`, { archived }),
  simpler: (id) => http.post(`/mistakes/${enc(id)}/simpler`, {}, { ai: true }),
  practiceMore: (id) => http.post(`/mistakes/${enc(id)}/practice-more`),
};

export const progressApi = {
  get: () => http.get('/progress'),
  leaderboard: (period) => http.get('/leaderboard', { period }),
  rewards: () => http.get('/rewards'),
  parentReport: () => http.get('/parent-report/preview'),
};

export const accountApi = {
  updateSettings: (body) => http.patch('/settings', body),
  changeClass: (classId) => http.post('/account/class', { classId }),
  exportData: () => http.post('/account/export'),
  deleteAccount: (confirm) => http.del('/account', { confirm }),
  reportQuestion: (body) => http.post('/report/question', body),
};
