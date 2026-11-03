import { http } from '../../http';
import { list } from './mappers';

/**
 * Curriculum lookups, memoised per page load. Boards / classes / chapters are public. Topic calls send
 * the token when signed in, so `studied` and `progressPct` are personal. The cache is cleared after a
 * material view.
 */
const memo = new Map();
const cached = (key, fn) => {
  if (!memo.has(key)) memo.set(key, fn().catch((e) => { memo.delete(key); throw e; }));
  return memo.get(key);
};

export const getBoards = () => cached('boards', async () => list(await http.get('/curriculum/boards', null, { auth: false }), 'boards'));

export const getClasses = (boardId) => cached(`classes:${boardId}`, async () => list(await http.get(`/curriculum/boards/${boardId}/classes`, null, { auth: false }), 'classes')
  .map((c) => ({ ...c, grade: Number(c.grade ?? c.classNumber ?? String(c.name).replace(/\D/g, '')) }))
  .sort((a, b) => a.grade - b.grade));

export const getChapters = (classId) => cached(`chapters:${classId}`, async () => list(await http.get(`/curriculum/classes/${classId}/chapters`, null, { auth: false }), 'chapters')
  .sort((a, b) => (a.order ?? a.chapterNumber ?? 0) - (b.order ?? b.chapterNumber ?? 0)));

export const getTopics = (chapterId) => cached(`topics:${chapterId}`, async () => list(await http.get(`/curriculum/chapters/${chapterId}/topics`, { page: 1, limit: 100 }, { skipAuthRedirect: true }), 'topics')
  .sort((a, b) => (a.order ?? a.topicNumber ?? 0) - (b.order ?? b.topicNumber ?? 0)));

export const getTopic = (topicId) => cached(`topic:${topicId}`, async () => {
  const d = await http.get(`/curriculum/topics/${topicId}`, null, { skipAuthRedirect: true });
  return d?.topic || d;
});

export const getTopicMaterials = async (topicId) => list(await http.get(`/curriculum/topics/${topicId}/materials`, { page: 1, limit: 50 }, { auth: false }), 'materials');

/** Board + classes resolved together (onboarding / class change). */
export async function getBoardsWithClasses() {
  const boards = await getBoards();
  return Promise.all(boards.map(async (b) => ({ ...b, classes: await getClasses(b._id) })));
}

export const clearCurriculumCache = () => memo.clear();
