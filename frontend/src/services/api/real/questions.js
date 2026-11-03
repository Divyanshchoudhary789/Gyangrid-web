/**
 * Question shape adapter.
 * Backend: { _id | questionId, questionType: MCQ | TRUE_FALSE | SHORT_ANSWER, options: string[], ... }
 *          answers are the option TEXT (MCQ), a boolean (TRUE_FALSE) or free text (SHORT_ANSWER).
 * UI:      { questionId, type: MCQ_SINGLE | SHORT_ANSWER, options: [{ key, text }] } with answers as option keys.
 */
const KEYS = 'ABCDEFGH';

export function toUiQuestion(q) {
  if (!q) return null;
  const backendType = String(q.questionType || 'MCQ').toUpperCase();
  let type = 'SHORT_ANSWER';
  let options = [];
  if (backendType === 'MCQ') {
    type = 'MCQ_SINGLE';
    options = (q.options || []).map((t, i) => ({ key: KEYS[i], text: String(t) }));
  } else if (backendType === 'TRUE_FALSE') {
    type = 'MCQ_SINGLE';
    options = [{ key: 'true', text: 'True' }, { key: 'false', text: 'False' }];
  }
  return {
    questionId: q.questionId || q._id,
    topicId: q.topicId || null,
    chapterId: q.chapterId || null,
    type,
    backendType,
    difficulty: q.difficulty || null,
    questionText: q.questionText || '',
    questionImageUrl: q.imageUrl || q.questionImageUrl || null,
    options,
    order: q.order ?? null,
  };
}

/** UI value (option key / text) → backend answer value. */
export function toBackendAnswer(q, value) {
  if (value == null) return value;
  if (q.backendType === 'MCQ') return q.options.find((o) => o.key === value)?.text ?? String(value);
  if (q.backendType === 'TRUE_FALSE') return String(value).toLowerCase() === 'true';
  return String(value).trim();
}

/** Backend answer value → UI value. */
export function fromBackendAnswer(q, value) {
  if (value == null || value === '') return null;
  if (q.backendType === 'MCQ') {
    const s = String(value).trim();
    return q.options.find((o) => o.text.trim() === s)?.key ?? q.options.find((o) => o.text.trim().toLowerCase() === s.toLowerCase())?.key ?? s;
  }
  if (q.backendType === 'TRUE_FALSE') return String(value).toLowerCase() === 'true' ? 'true' : 'false';
  return String(value);
}

export function answerLabel(q, uiValue) {
  if (uiValue == null || uiValue === '') return 'Not answered';
  if (q.backendType === 'TRUE_FALSE') return String(uiValue) === 'true' ? 'True' : 'False';
  if (q.type === 'MCQ_SINGLE') {
    const o = q.options.find((x) => x.key === uiValue);
    return o ? `${o.key}. ${o.text}` : String(uiValue);
  }
  return String(uiValue);
}

/** Backend explanations are a single string; split into readable steps for the step-by-step panel. */
export function explanationSteps(explanation) {
  if (!explanation) return [];
  if (Array.isArray(explanation)) return explanation.filter(Boolean);
  const byLine = String(explanation).split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
  return byLine.length ? byLine : [String(explanation)];
}

/** Graded payload in the shape SolutionPanel / QuestionView expect. */
export function toReveal(q, { yourAnswer, isCorrect, correctAnswer, explanation }) {
  const correctUi = correctAnswer != null ? fromBackendAnswer(q, correctAnswer) : null;
  const skipped = yourAnswer == null || yourAnswer === '';
  return {
    ...q,
    yourAnswer: skipped ? null : yourAnswer,
    yourAnswerLabel: answerLabel(q, yourAnswer),
    correctAnswer: correctUi,
    correctAnswerLabel: correctUi != null ? answerLabel(q, correctUi) : null,
    correct: Boolean(isCorrect),
    skipped,
    explanation: explanationSteps(explanation),
    conceptNote: null,
  };
}
