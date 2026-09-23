import { ApiError, ERROR_CODES } from '../../errors';
import { getDb, userState } from '../db';
import { curriculumFor, topicMeta, topicStats, servable, pushActivity, today } from '../engine';
import { defaultMaterialFor } from '../content/materials';

/** F3-01: a student can only ever read their own class — enforced server-side, not just in the UI. */
export function assertOwnClass(user, topicId) {
  const t = topicMeta(topicId);
  if (!t) throw new ApiError(ERROR_CODES.NOT_FOUND, 'This topic could not be found.', { status: 404 });
  if (t.classId !== user.profile.classId) throw new ApiError(ERROR_CODES.FORBIDDEN, 'This content is not part of your class.', { status: 403 });
  return t;
}

export function publishedMaterial(topicId) {
  const stored = getDb().admin.materials[topicId];
  if (stored) return stored.status === 'PUBLISHED' ? stored : null;
  return defaultMaterialFor(topicId);
}

function curriculum({ uid, user, query }) {
  const classId = user.profile.classId;
  if (query.classId && Number(query.classId) !== classId) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, 'You can only view your own class syllabus.', { status: 403 });
  }
  const stats = topicStats(uid, classId);
  const st = userState(uid);
  const chapters = curriculumFor(classId).map((ch) => {
    const topics = ch.topics.map((t) => ({
      id: t.id,
      name: t.name,
      number: t.number,
      questionCount: servable(t.id).length,
      mastery: stats[t.id]?.mastery ?? null,
      attempts: stats[t.id]?.attempts || 0,
      accuracy: stats[t.id]?.accuracy ?? null,
      studied: Boolean(st.studied[t.id]),
      hasMaterial: Boolean(publishedMaterial(t.id)),
    }));
    const scored = topics.filter((t) => t.mastery != null);
    return {
      id: ch.id,
      number: ch.number,
      name: ch.name,
      topicCount: topics.length,
      questionCount: topics.reduce((s, t) => s + t.questionCount, 0),
      mastery: scored.length ? Math.round(scored.reduce((s, t) => s + t.mastery, 0) / scored.length) : null,
      studiedCount: topics.filter((t) => t.studied).length,
      topics,
    };
  });
  return { classId, boardId: user.profile.boardId, chapters };
}

function topicDetail({ uid, user, params }) {
  const t = assertOwnClass(user, params.topicId);
  const stats = topicStats(uid, t.classId)[t.id] || null;
  const st = userState(uid);
  const chapter = curriculumFor(t.classId).find((ch) => ch.id === t.chapterId);
  const idx = chapter?.topics.findIndex((x) => x.id === t.id) ?? -1;
  return {
    topic: { id: t.id, name: t.name, chapterId: t.chapterId, chapterName: t.chapterName || chapter?.name, number: t.number },
    material: publishedMaterial(t.id),
    stats: stats ? { attempts: stats.attempts, accuracy: stats.accuracy, mastery: stats.mastery, activeMistakes: stats.activeMistakes, last5: stats.last5 } : null,
    questionCount: servable(t.id).length,
    studied: Boolean(st.studied[t.id]),
    activeMistakes: Object.values(st.mistakes).filter((m) => m.topicId === t.id && m.status === 'ACTIVE').length,
    prev: idx > 0 ? { id: chapter.topics[idx - 1].id, name: chapter.topics[idx - 1].name } : null,
    next: idx >= 0 && idx < chapter.topics.length - 1 ? { id: chapter.topics[idx + 1].id, name: chapter.topics[idx + 1].name } : null,
  };
}

/** F3-05: >= 20 s on material marks the topic studied. Also feeds "Continue Learning" (F2-04). */
function recordView({ uid, user, params, body }) {
  const t = assertOwnClass(user, params.topicId);
  const st = userState(uid);
  const seconds = Math.max(0, Math.min(3600, Number(body.seconds) || 0));
  st.topicViews = [{ topicId: t.id, at: new Date().toISOString(), seconds }, ...st.topicViews.filter((v) => v.topicId !== t.id)].slice(0, 30);
  let newlyStudied = false;
  if (seconds >= 20 && !st.studied[t.id]) {
    st.studied[t.id] = { at: new Date().toISOString(), date: today() };
    newlyStudied = true;
    pushActivity(uid, { type: 'STUDIED', title: `Studied ${t.name}`, detail: t.chapterName, link: `/learn/topic/${t.id}` });
  }
  return { studied: Boolean(st.studied[t.id]), newlyStudied };
}

export const learningRoutes = [
  { method: 'GET', path: '/curriculum', auth: 'student', consent: true, handler: curriculum },
  { method: 'GET', path: '/topics/:topicId', auth: 'student', consent: true, handler: topicDetail },
  { method: 'POST', path: '/material/:topicId/view', auth: 'student', consent: true, handler: recordView },
];
