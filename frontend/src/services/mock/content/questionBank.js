import { seeded } from '@/lib/random';
import { getTopic, getChapter, allTopics } from './curriculum';
import { generateQuestion } from './generators';

const PER_DIFFICULTY = 6;
const DIFFS = ['EASY', 'MEDIUM', 'HARD'];
const TIME = { EASY: 45, MEDIUM: 75, HARD: 110 };
const cache = new Map();

/** Deterministic, approved bank for a topic (18 questions: 6 easy / 6 medium / 6 hard). */
export function questionsForTopic(topicId) {
  if (cache.has(topicId)) return cache.get(topicId);
  const topic = getTopic(topicId);
  if (!topic) return [];
  const chapter = getChapter(topic.chapterId);
  const list = [];
  DIFFS.forEach((difficulty) => {
    for (let i = 0; i < PER_DIFFICULTY; i += 1) {
      const idx = list.length + 1;
      const rng = seeded(`${topicId}:${difficulty}:${i}`);
      const q = generateQuestion(topic.family, rng, difficulty);
      const attempts = rng.int(40, 900);
      list.push({
        questionId: `Q-C${topic.classId}-${topic.code}-${String(chapter.number).padStart(2, '0')}${topic.number}${String(idx).padStart(2, '0')}`,
        boardId: 'NCERT_CBSE',
        classId: topic.classId,
        subjectId: 'MATHS',
        chapterId: topic.chapterId,
        topicId,
        difficulty,
        estimatedTimeSec: TIME[difficulty],
        source: 'CLIENT_APPROVED',
        status: 'APPROVED',
        tags: [topic.family],
        questionImageUrl: null,
        stats: { attempts, correct: Math.round(attempts * (difficulty === 'EASY' ? 0.78 : difficulty === 'MEDIUM' ? 0.58 : 0.39) * (0.85 + rng.next() * 0.3)), avgTimeSec: Math.round(TIME[difficulty] * (0.7 + rng.next() * 0.6)) },
        version: 1,
        createdBy: 'content@gyaangrid.in',
        updatedAt: '2026-09-01T10:00:00.000Z',
        questionText: q.text,
        type: q.type,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        answerTolerance: q.answerTolerance ?? 0,
        explanation: q.explanation,
        conceptNote: q.conceptNote,
      });
    }
  });
  cache.set(topicId, list);
  return list;
}

export const questionsForChapter = (chapterId) => (getChapter(chapterId)?.topics || []).flatMap((t) => questionsForTopic(t.id));
export const questionsForClass = (classId) => allTopics(classId).flatMap((t) => questionsForTopic(t.id));

const idIndex = new Map();
export function findGeneratedQuestion(questionId) {
  if (idIndex.has(questionId)) return idIndex.get(questionId);
  const m = /^Q-C(\d+)-/.exec(questionId);
  if (!m) return null;
  const found = questionsForClass(Number(m[1])).find((q) => q.questionId === questionId) || null;
  if (found) idIndex.set(questionId, found);
  return found;
}

/** The client must never receive answers before submission (F4-04). */
export function toPublicQuestion(q) {
  return {
    questionId: q.questionId,
    topicId: q.topicId,
    chapterId: q.chapterId,
    type: q.type,
    difficulty: q.difficulty,
    questionText: q.questionText,
    questionImageUrl: q.questionImageUrl,
    options: q.options,
    estimatedTimeSec: q.estimatedTimeSec,
  };
}

export function isCorrect(q, answer) {
  if (answer == null || answer === '') return false;
  if (q.type === 'NUMERIC') {
    const given = Number(String(answer).replace(/,/g, '').trim());
    if (Number.isNaN(given)) return false;
    return Math.abs(given - Number(q.correctAnswer)) <= Math.max(q.answerTolerance || 0, 1e-9);
  }
  return String(answer) === String(q.correctAnswer);
}

export function answerLabel(q, answer) {
  if (answer == null || answer === '') return 'Not answered';
  if (q.type === 'NUMERIC') return String(answer);
  const opt = q.options.find((o) => o.key === answer);
  return opt ? `${opt.key}. ${opt.text}` : String(answer);
}
