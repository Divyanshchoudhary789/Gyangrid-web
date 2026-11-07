import { http } from '../../http';
import { ApiError, ERROR_CODES } from '../../errors';
import { storage } from '@/lib/storage';
import { list } from './mappers';
import { putToSignedUrl } from './uploads';

/**
 * AI Doubt Solver. The backend model is a conversation: a doubt is answered once, then allows up to
 * two follow-ups, one feedback and reports. `chat: true` tells the pages to use the conversation UI.
 */
const MAX_FOLLOW_UPS = 2;
const feedbackKey = (id) => `rv:doubt-feedback:${id}`;

/** One key per user action, so a network retry never uses quota twice or duplicates a doubt. */
const idempotencyKey = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

const mapQuota = (q) => (q ? {
  limit: q.perDay ?? 0,
  usedToday: q.usedToday ?? 0,
  perMonth: q.perMonth ?? null,
  usedThisMonth: q.usedThisMonth ?? null,
  imageLimit: q.imagesPerDay ?? 0,
  imagesUsed: q.imagesUsedToday ?? 0,
  resetsAt: q.resetsAt || null,
} : null);

const quota = async () => mapQuota(await http.get('/doubts/quota'));

const mapMessages = (messages) => (messages || []).map((m, i) => ({
  id: `${m.createdAt || 'm'}-${i}`,
  role: m.role === 'student' ? 'student' : 'tutor',
  text: m.text || '',
  imageUrl: /^https:\/\//i.test(m.imageUrl || '') ? m.imageUrl : null,
  createdAt: m.createdAt || null,
}));

function mapDoubt(d) {
  const messages = mapMessages(d.messages);
  const studentTurns = messages.filter((m) => m.role === 'student').length;
  const followUpsUsed = Math.max(0, studentTurns - 1);
  return {
    id: d.doubtId,
    status: String(d.status || 'ANSWERED').toUpperCase(),
    messages,
    followUpsUsed,
    followUpsLeft: Math.max(0, MAX_FOLLOW_UPS - followUpsUsed),
    createdAt: messages[0]?.createdAt || null,
    feedback: storage.get(feedbackKey(d.doubtId), null),
  };
}

async function listDoubts() {
  const [d, q] = await Promise.all([
    http.get('/doubts', { page: 1, limit: 50 }),
    quota().catch(() => null),
  ]);
  return {
    items: list(d).map((x) => ({
      id: x.doubtId,
      preview: x.preview || 'Doubt',
      topicName: x.topicName || null,
      status: String(x.status || 'ANSWERED').toUpperCase(),
      createdAt: x.createdAt,
    })),
    quota: q,
  };
}

/** Signed URL → direct PUT → owned uploadId that doubt / transcription calls can reference. */
async function uploadMedia({ kind, blob }) {
  const contentType = (blob.type || (kind === 'IMAGE' ? 'image/jpeg' : 'audio/webm')).split(';')[0];
  const up = await http.post('/uploads/signed-url', { kind, contentType, sizeBytes: blob.size });
  await putToSignedUrl(up, blob);
  return up.uploadId;
}

async function createDoubt({ text, imageBlob, topicId }) {
  const body = {};
  if (text) body.text = text;
  if (topicId) body.topicId = topicId;
  if (imageBlob) body.imageUploadId = await uploadMedia({ kind: 'IMAGE', blob: imageBlob });
  const r = await http.post('/doubts', body, { ai: true, headers: { 'Idempotency-Key': idempotencyKey() } });
  if (r.refused) return { id: null, refused: true, refusal: r.refusal || '' };
  return {
    id: r.doubtId,
    refused: false,
    answer: { steps: r.answer?.steps || [], finalAnswer: r.answer?.finalAnswer || null, conceptNote: r.answer?.conceptNote || null },
  };
}

async function transcribe(blob) {
  const uploadId = await uploadMedia({ kind: 'AUDIO', blob });
  const r = await http.post('/speech/transcribe', { uploadId }, { ai: true });
  return { transcript: r.text || '' };
}

async function feedback(id, { understood, rating }) {
  const r = await http.post(`/doubts/${id}/feedback`, { understood, ...(rating ? { rating } : {}) });
  const saved = { understood, rating: rating || null };
  storage.set(feedbackKey(id), saved);
  return { saved, awarded: r?.awarded || null, duplicate: Boolean(r?.duplicate) };
}

async function report(id, { reason, note }) {
  try {
    await http.post(`/doubts/${id}/report`, { reason, ...(note?.trim() ? { note: note.trim() } : {}) });
    return { reported: true };
  } catch (e) {
    if (e.code === ERROR_CODES.CONFLICT) return { reported: true, duplicate: true };
    throw e;
  }
}

export const doubtApi = {
  available: true,
  chat: true,
  // The backend's AI provider can't read images yet; photo questions return 503.
  imageSolving: false,
  quota,
  list: listDoubts,
  get: async (id) => mapDoubt(await http.get(`/doubts/${id}`)),
  create: createDoubt,
  followUp: async (id, text) => {
    if (!text?.trim()) throw new ApiError(ERROR_CODES.VALIDATION, 'Type your follow-up question first.');
    return mapDoubt(await http.post(`/doubts/${id}/follow-up`, { text: text.trim() }, { ai: true, headers: { 'Idempotency-Key': idempotencyKey() } }));
  },
  feedback,
  report,
  transcribe,
};
