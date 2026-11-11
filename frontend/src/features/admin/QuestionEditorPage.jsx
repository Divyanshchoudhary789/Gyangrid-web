import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Save, Send, CheckCircle2, Ban, Copy, ArrowLeft, BarChart3, Trash2,
  Clock, Lightbulb, Eye, Plus, Minus, Hash, FileQuestion,
  CheckCheck, Target, Timer, Users, Percent, ChevronRight,
} from 'lucide-react';
import { Card, Button, TextField, TextArea, SelectField, PageSkeleton, ErrorState, Alert, ConfirmDialog } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatDateTime } from '@/lib/date';
import { cn } from '@/lib/cn';
import { AdminPageHeader, ClassSelect, StatusBadge, useCan, ADMIN_CAPS, supports } from './adminShared';

/* ─── Constants (unchanged logic) ───────────────────────────────────────── */

const REAL = Boolean(ADMIN_CAPS);
const TYPE_OPTIONS = [
  { value: 'MCQ_SINGLE', label: 'MCQ (single answer)' },
  ...(REAL ? [{ value: 'TRUE_FALSE', label: 'True / False' }] : []),
  { value: 'NUMERIC', label: REAL ? 'Short answer' : 'Numeric' },
];
const defaultAnswer = (type) => (type === 'MCQ_SINGLE' ? 'A' : type === 'TRUE_FALSE' ? 'true' : '');

const EMPTY = {
  classId: 8, chapterId: '', topicId: '', type: 'MCQ_SINGLE', difficulty: 'EASY',
  questionText: '', options: ['', '', '', ''], correctAnswer: 'A',
  answerTolerance: 0, explanation: '', conceptNote: '', estimatedTimeSec: 60,
};

const CLASSES_LIST = [6, 7, 8, 9, 10];
const OPTION_KEYS = ['A', 'B', 'C', 'D'];

/* ─── LaTeX Toolbar ─────────────────────────────────────────────────────── */

const LATEX_INSERTS = [
  { label: 'frac', latex: '\\frac{a}{b}' },
  { label: 'sqrt', latex: '\\sqrt{x}' },
  { label: 'x²', latex: 'x^{2}' },
  { label: 'xₙ', latex: 'x_{n}' },
  { label: '∫', latex: '\\int_{a}^{b}' },
  { label: '∑', latex: '\\sum_{i=1}^{n}' },
  { label: 'π', latex: '\\pi' },
  { label: '±', latex: '\\pm' },
  { label: '÷', latex: '\\div' },
  { label: '≤', latex: '\\leq' },
  { label: '≥', latex: '\\geq' },
  { label: '≠', latex: '\\neq' },
  { label: '$…$', latex: null, wrap: true, inline: true },
  { label: '$$…$$', latex: null, wrap: true, inline: false },
];

function LatexToolbar({ onInsert, textareaRef }) {
  const handleClick = (item) => {
    const el = textareaRef?.current;
    if (!el) {
      onInsert(item.latex || (item.inline ? '$x$' : '$$x$$'));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end);
    let insert;
    if (item.wrap) {
      const wrap = item.inline ? '$' : '$$';
      insert = selected ? `${wrap}${selected}${wrap}` : `${wrap}x${wrap}`;
    } else {
      insert = item.latex;
    }
    const newVal = el.value.slice(0, start) + insert + el.value.slice(end);
    // Dispatch a native input event so React state updates
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, newVal);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // Restore cursor
    const cursorPos = start + insert.length;
    el.setSelectionRange(cursorPos, cursorPos);
    el.focus();
  };

  return (
    <div className="flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-ink-200 bg-ink-50 px-2 py-1.5" role="toolbar" aria-label="LaTeX toolbar">
      {LATEX_INSERTS.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => handleClick(item)}
          className="rounded-md border border-ink-200 bg-white px-2 py-0.5 text-xs font-mono font-semibold text-ink-700 shadow-sm hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 transition-colors"
          title={item.latex || `Wrap in ${item.label}`}
          aria-label={`Insert ${item.label}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ─── LaTeX Textarea (textarea with toolbar above) ───────────────────────── */

function LatexTextarea({ label, value, onChange, rows = 4, placeholder, hint, error, required, id, className }) {
  const ref = useRef(null);
  // We need a stable onChange shim that works with the native dispatchEvent approach
  const handleChange = (e) => onChange(e);

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label mb-1 block">
          {label}{required && <span className="ml-1 text-rose-500">*</span>}
        </label>
      )}
      <LatexToolbar textareaRef={ref} onInsert={(latex) => {
        // fallback if ref not ready
        onChange({ target: { value: value + latex } });
      }} />
      <textarea
        id={id}
        ref={ref}
        value={value}
        onChange={handleChange}
        rows={rows}
        placeholder={placeholder}
        required={required}
        className={cn(
          'input w-full rounded-t-none border-t-0 font-mono text-sm',
          error && 'border-rose-400 focus:ring-rose-200',
        )}
        aria-label={label}
        aria-describedby={hint || error ? `${id}-hint` : undefined}
        aria-invalid={error ? 'true' : undefined}
      />
      {(hint || error) && (
        <p id={`${id}-hint`} className={cn('mt-1 text-xs', error ? 'text-rose-600' : 'text-ink-400')}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

/* ─── Segmented Control ─────────────────────────────────────────────────── */

function SegmentedControl({ options, value, onChange, className }) {
  return (
    <div className={cn('inline-flex rounded-xl border border-ink-200 bg-ink-100 p-1', className)} role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-semibold transition-all',
            value === opt.value
              ? opt.activeClass || 'bg-white text-ink-900 shadow-sm'
              : 'text-ink-500 hover:text-ink-700',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Difficulty segment options ────────────────────────────────────────── */

const DIFFICULTY_OPTIONS = [
  { value: 'EASY',   label: 'Easy',   activeClass: 'bg-emerald-500 text-white shadow-sm' },
  { value: 'MEDIUM', label: 'Medium', activeClass: 'bg-amber-500 text-white shadow-sm' },
  { value: 'HARD',   label: 'Hard',   activeClass: 'bg-rose-500 text-white shadow-sm' },
];

const TYPE_SEGMENT_OPTIONS = TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }));

/* ─── MCQ Option Row ────────────────────────────────────────────────────── */

function McqOptionRow({ letter, value, isCorrect, onChange, onMarkCorrect, optionRef }) {
  return (
    <div
      className={cn(
        'flex items-stretch gap-3 rounded-xl border p-2 transition-all',
        isCorrect
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-ink-100 bg-white hover:border-ink-200',
      )}
    >
      {/* Letter badge */}
      <button
        type="button"
        onClick={onMarkCorrect}
        aria-label={`Mark ${letter} correct`}
        aria-pressed={isCorrect}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-all',
          isCorrect
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md'
            : 'bg-ink-100 text-ink-500 hover:bg-ink-200',
        )}
      >
        {isCorrect ? <CheckCheck className="h-4 w-4" aria-hidden="true" /> : letter}
      </button>

      {/* Input */}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <LatexToolbar textareaRef={optionRef} onInsert={(latex) => onChange(value + latex)} />
        </div>
        <input
          ref={optionRef}
          className={cn(
            'input w-full rounded-t-none border-t-0 font-mono text-sm',
            isCorrect && 'border-emerald-300 focus:ring-emerald-200',
          )}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Option ${letter} — use $…$ for maths`}
          aria-label={`Option ${letter}`}
        />
        {value.trim() && (
          <div className="mt-1 rounded-lg bg-white/80 px-2 py-1 text-sm text-ink-700">
            <MathText text={value} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */

export default function QuestionEditorPage() {
  /* ── All existing logic preserved exactly ── */
  const { questionId } = useParams();
  const isNew = !questionId;
  const navigate = useNavigate();
  const canEdit = useCan('editContent');
  const { data: existing, error, loading, refetch } = useQuery(
    `admin:question:${questionId}`,
    () => adminApi.question(questionId),
    { enabled: !isNew, staleMs: 0 },
  );
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  useDocumentTitle(isNew ? 'New question' : REAL ? 'Edit question' : questionId);

  useEffect(() => {
    if (!existing) return;
    setForm({
      classId: existing.classId, chapterId: existing.chapterId, topicId: existing.topicId,
      type: existing.type, difficulty: existing.difficulty,
      questionText: existing.questionText,
      options: [0, 1, 2, 3].map((i) => existing.options?.[i]?.text || ''),
      correctAnswer: existing.correctAnswer,
      answerTolerance: existing.answerTolerance || 0,
      explanation: (existing.explanation || []).join('\n'),
      conceptNote: existing.conceptNote || '',
      estimatedTimeSec: existing.estimatedTimeSec,
    });
  }, [existing]);

  const { data: cur } = useQuery(`admin:curriculum:${form.classId}`, () => adminApi.curriculum(form.classId));
  const chapter = cur?.chapters.find((c) => c.id === form.chapterId);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const payload = () => ({
    topicId: form.topicId, type: form.type, difficulty: form.difficulty,
    questionText: form.questionText,
    options: form.type === 'MCQ_SINGLE'
      ? form.options.filter((o) => o.trim()).map((text) => ({ text }))
      : [],
    correctAnswer: form.correctAnswer,
    answerTolerance: Number(form.answerTolerance) || 0,
    explanation: form.explanation.split('\n').map((s) => s.trim()).filter(Boolean),
    conceptNote: form.conceptNote,
    estimatedTimeSec: Number(form.estimatedTimeSec) || 60,
  });

  const run = async (fn, msg, after) => {
    setBusy(true);
    setErrors([]);
    try {
      const res = await fn();
      toast.success(msg);
      if (after) after(res); else refetch();
    } catch (e) {
      setErrors(e.details?.errors || [errorMessage(e)]);
    } finally { setBusy(false); }
  };

  const saveNew = (submitForReview) =>
    run(
      () => adminApi.createQuestion({ ...payload(), submitForReview }),
      submitForReview ? 'Submitted for review.' : 'Draft saved.',
      (q) => navigate(`/admin/questions/${encodeURIComponent(q.questionId)}`, { replace: true }),
    );

  const saveAndPublish = () =>
    run(async () => {
      const q = await adminApi.createQuestion(payload());
      try { await adminApi.setQuestionStatus(q.questionId, 'APPROVED'); } catch (e) {
        navigate(`/admin/questions/${encodeURIComponent(q.questionId)}`, { replace: true });
        throw e;
      }
      return q;
    }, 'Published — now served to students.', (q) => navigate(`/admin/questions/${encodeURIComponent(q.questionId)}`, { replace: true }));

  const remove = () =>
    run(
      () => adminApi.deleteQuestion(questionId),
      existing?.status === 'APPROVED' ? 'Question retired.' : 'Question deleted.',
      () => navigate('/admin/questions', { replace: true }),
    );

  const saveEdit = () =>
    run(() => adminApi.updateQuestion(questionId, payload()), 'Saved. Students\' past mistakes keep their original snapshot.');

  const setStatus = (status, msg) =>
    run(() => adminApi.setQuestionStatus(questionId, status), msg);

  const duplicate = () =>
    run(
      () => adminApi.duplicateQuestion(questionId),
      'Duplicated as a draft.',
      (q) => navigate(`/admin/questions/${encodeURIComponent(q.questionId)}`),
    );

  /* ── Loading / error guards ── */
  if (!isNew && loading && !existing) return <PageSkeleton rows={1} />;
  if (!isNew && !existing) return <ErrorState error={error} onRetry={refetch} />;

  /* ── Derived UI state ── */
  const noExplanation = !form.explanation.trim();
  const explanationSteps = form.explanation.split('\n').filter((s) => s.trim());
  const correctAnswerKey = form.type === 'MCQ_SINGLE' ? form.correctAnswer : null;
  const correctIdx = correctAnswerKey ? OPTION_KEYS.indexOf(correctAnswerKey) : -1;

  /* ── Refs for option toolbars ── */
  const questionRef = useRef(null);
  const explanationRef = useRef(null);
  const conceptRef = useRef(null);
  const optionRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  return (
    <div>
      {/* ── Back breadcrumb ── */}
      <button
        type="button"
        onClick={() => navigate('/admin/questions')}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-ink-500 hover:bg-ink-100 hover:text-brand-600 transition-colors"
        aria-label="Back to Question Bank"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Question Bank
      </button>

      {/* ── Page header ── */}
      <AdminPageHeader
        title={isNew ? 'New question' : REAL ? 'Edit question' : questionId}
        icon={FileQuestion}
        iconColor="bg-brand-100 text-brand-600"
        subtitle={
          existing
            ? [
                REAL ? `ID ${questionId}` : null,
                existing.version ? `v${existing.version}` : null,
                existing.source ? existing.source.replace('_', ' ') : null,
                existing.updatedAt ? `updated ${formatDateTime(existing.updatedAt)}` : null,
              ].filter(Boolean).join(' · ')
            : 'Author in LaTeX: wrap maths in $…$'
        }
        action={
          existing && (
            <StatusBadge status={REAL && existing.status === 'APPROVED' ? 'PUBLISHED' : existing.status} />
          )
        }
      />

      {/* ── Validation errors ── */}
      {errors.length > 0 && (
        <Alert tone="danger" className="mb-4" title="Please fix the following">
          <ul className="list-disc pl-4">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </Alert>
      )}

      {/* ── Main 2-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">

        {/* ════════════ LEFT COLUMN ════════════ */}
        <div className="space-y-6">

          {/* ── Metadata card ── */}
          <div className="card rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <p className="section-title mb-4">Question metadata</p>

            {/* Class pills */}
            <div className="mb-4">
              <p className="label mb-2">Class</p>
              <div className="flex flex-wrap gap-2">
                {CLASSES_LIST.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set({ classId: c, chapterId: '', topicId: '' })}
                    aria-pressed={form.classId === c}
                    className={cn(
                      'rounded-xl border px-4 py-1.5 text-sm font-semibold transition-all',
                      form.classId === c
                        ? 'border-brand-500 bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md'
                        : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-600',
                    )}
                  >
                    Class {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Chapter + Topic */}
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Chapter"
                value={form.chapterId}
                placeholder="Choose…"
                onChange={(e) => set({ chapterId: e.target.value, topicId: '' })}
                options={(cur?.chapters || []).map((c) => ({ value: c.id, label: c.name }))}
              />
              <SelectField
                label="Topic"
                value={form.topicId}
                placeholder="Choose…"
                onChange={(e) => set({ topicId: e.target.value })}
                options={(chapter?.topics || []).map((t) => ({ value: t.id, label: t.name }))}
              />
            </div>

            {/* Type + Difficulty */}
            <div className="mb-4 flex flex-wrap gap-6">
              <div>
                <p className="label mb-2">Type</p>
                <SegmentedControl
                  options={TYPE_SEGMENT_OPTIONS}
                  value={form.type}
                  onChange={(v) => set({ type: v, correctAnswer: defaultAnswer(v) })}
                />
              </div>
              <div>
                <p className="label mb-2">Difficulty</p>
                <SegmentedControl
                  options={DIFFICULTY_OPTIONS}
                  value={form.difficulty}
                  onChange={(v) => set({ difficulty: v })}
                />
              </div>
              {supports('estimatedTime') && (
                <div>
                  <p className="label mb-2">Est. time</p>
                  <div className="relative">
                    <Timer className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                    <input
                      type="number"
                      min={10}
                      value={form.estimatedTimeSec}
                      onChange={(e) => set({ estimatedTimeSec: e.target.value })}
                      className="input w-28 pl-9"
                      aria-label="Estimated time in seconds"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Question text card ── */}
          <div className="card rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <p className="section-title mb-4">Question text</p>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Editor */}
              <div>
                <LatexToolbar textareaRef={questionRef} onInsert={(latex) => set({ questionText: form.questionText + latex })} />
                <textarea
                  ref={questionRef}
                  id="question-text"
                  value={form.questionText}
                  onChange={(e) => set({ questionText: e.target.value })}
                  rows={6}
                  placeholder="Solve for $x$: $5x - 3 = 2x + 9$"
                  required
                  className="input w-full rounded-t-none border-t-0 font-mono text-sm"
                  aria-label="Question text"
                />
                <p className="mt-1 text-xs text-ink-400">Wrap maths in $…$ (inline) or $$…$$ (display)</p>
              </div>

              {/* Live preview */}
              <div>
                <p className="label mb-1 flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Live Preview
                </p>
                <div className="min-h-[8rem] rounded-xl border border-dashed border-brand-200 bg-brand-50/30 p-4">
                  {form.questionText.trim() ? (
                    <MathText as="p" text={form.questionText} className="font-semibold text-ink-900" />
                  ) : (
                    <p className="text-sm italic text-ink-400">Your rendered question appears here…</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Answer card ── */}
          <div className="card rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            {form.type === 'MCQ_SINGLE' ? (
              <>
                <p className="section-title mb-1">Answer options</p>
                <p className="muted mb-4 text-xs">Click the letter badge to mark the correct answer</p>
                <div className="space-y-3">
                  {OPTION_KEYS.map((k, i) => (
                    <McqOptionRow
                      key={k}
                      letter={k}
                      value={form.options[i]}
                      isCorrect={form.correctAnswer === k}
                      onChange={(v) => set({ options: form.options.map((o, j) => (j === i ? v : o)) })}
                      onMarkCorrect={() => set({ correctAnswer: k })}
                      optionRef={optionRefs[i]}
                    />
                  ))}
                </div>
                {/* Correct answer banner */}
                {correctIdx >= 0 && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    <p className="text-sm font-semibold text-emerald-700">
                      Option {form.correctAnswer} is marked as the correct answer
                    </p>
                  </div>
                )}
              </>
            ) : form.type === 'TRUE_FALSE' ? (
              <>
                <p className="section-title mb-4">Correct answer</p>
                <div className="flex gap-3">
                  {['true', 'false'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set({ correctAnswer: v })}
                      aria-pressed={form.correctAnswer === v}
                      className={cn(
                        'flex-1 rounded-2xl border-2 py-4 text-base font-bold transition-all',
                        form.correctAnswer === v
                          ? 'border-emerald-400 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg'
                          : 'border-ink-200 bg-ink-50 text-ink-600 hover:border-ink-300',
                      )}
                    >
                      {v === 'true' ? '✓ True' : '✗ False'}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="section-title mb-4">Correct answer</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Correct answer"
                    value={form.correctAnswer}
                    onChange={(e) => set({ correctAnswer: e.target.value })}
                    inputMode={REAL ? 'text' : 'decimal'}
                    hint={REAL ? 'Keep it short and unambiguous, e.g. 4 or 2/3.' : undefined}
                  />
                  {supports('answerTolerance') && (
                    <TextField
                      label="Tolerance (±)"
                      type="number"
                      step="0.001"
                      value={form.answerTolerance}
                      onChange={(e) => set({ answerTolerance: e.target.value })}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Explanation card ── */}
          <div className="card rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <p className="section-title mb-1 flex items-center gap-2">
              <Hash className="h-4 w-4 text-brand-500" aria-hidden="true" />
              Step-by-step explanation
            </p>
            <p className="muted mb-4 text-xs">
              One step per line — mandatory for approval. The Mistake Bank depends on it.
            </p>
            <LatexTextarea
              id="explanation"
              value={form.explanation}
              onChange={(e) => set({ explanation: e.target.value })}
              rows={6}
              placeholder={'Step 1: Rearrange the equation…\nStep 2: Simplify…'}
              error={
                noExplanation && existing?.status === 'APPROVED'
                  ? 'Approved questions must keep an explanation.'
                  : undefined
              }
              hint={!noExplanation ? undefined : 'Each line becomes a numbered step in the student view.'}
            />
            {/* Step preview */}
            {explanationSteps.length > 0 && (
              <div className="mt-3 rounded-xl border border-ink-100 bg-ink-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Step preview</p>
                <ol className="space-y-1.5">
                  {explanationSteps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                        {i + 1}
                      </span>
                      <MathText text={s} />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* ── Concept note card ── */}
          {supports('conceptNote') && (
            <div className="card rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
              <p className="section-title mb-1 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-gold-500" aria-hidden="true" />
                Concept note
                <span className="ml-1 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-700">Recommended</span>
              </p>
              <p className="muted mb-4 text-xs">A brief concept explanation shown after the student answers.</p>
              <LatexTextarea
                id="concept-note"
                value={form.conceptNote}
                onChange={(e) => set({ conceptNote: e.target.value })}
                rows={3}
                placeholder="e.g. Quadratic equations are solved by…"
              />
            </div>
          )}

          {/* ── Floating action bar ── */}
          {canEdit && (
            <div className="sticky bottom-4 z-10">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink-100 bg-white/95 p-3 shadow-lift backdrop-blur-sm">
                {isNew ? (
                  <>
                    <Button variant="outline" leftIcon={Save} loading={busy} onClick={() => saveNew(false)}>
                      Save draft
                    </Button>
                    {supports('reviewQueue') ? (
                      <Button leftIcon={Send} loading={busy} onClick={() => saveNew(true)}
                        className="bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-700 hover:to-brand-600">
                        Submit for review
                      </Button>
                    ) : (
                      <Button
                        leftIcon={CheckCircle2}
                        loading={busy}
                        disabled={noExplanation}
                        onClick={saveAndPublish}
                        title={noExplanation ? 'Add an explanation to publish' : undefined}
                        className="bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-700 hover:to-brand-600"
                      >
                        Save &amp; publish
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button variant="outline" leftIcon={Save} loading={busy} onClick={saveEdit}>
                      Save changes
                    </Button>
                    {(REAL ? existing.status === 'DRAFT' : existing.status !== 'APPROVED') && (
                      <Button
                        variant="success"
                        leftIcon={CheckCircle2}
                        loading={busy}
                        disabled={noExplanation}
                        onClick={() => setStatus('APPROVED', REAL ? 'Published — now served to students.' : 'Approved — now served to students.')}
                        title={noExplanation ? 'Add an explanation to approve' : undefined}
                        className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                      >
                        {REAL ? 'Publish' : 'Approve'}
                      </Button>
                    )}
                    {existing.status === 'DRAFT' && supports('reviewQueue') && (
                      <Button variant="secondary" leftIcon={Send} onClick={() => setStatus('IN_REVIEW', 'Sent to review queue.')}>
                        Send to review
                      </Button>
                    )}
                    <Button variant="ghost" leftIcon={Copy} onClick={duplicate}>
                      Duplicate
                    </Button>
                    {/* Destructive actions pushed to right */}
                    <div className="ml-auto flex gap-2">
                      {(REAL ? existing.status === 'APPROVED' : existing.status !== 'RETIRED') && (
                        <Button
                          variant="ghost"
                          leftIcon={Ban}
                          onClick={() => (REAL ? setConfirmRetire(true) : setStatus('RETIRED', 'Retired — no longer served.'))}
                          className="text-rose-600 hover:bg-rose-50"
                        >
                          Retire
                        </Button>
                      )}
                      {REAL && (
                        <Button
                          variant="ghost"
                          leftIcon={Trash2}
                          className="text-rose-600 hover:bg-rose-50"
                          onClick={() => setConfirmDelete(true)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ════════════ RIGHT SIDEBAR ════════════ */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">

          {/* Student Preview card */}
          <div className="relative overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
            {/* Subtle paper-texture header */}
            <div className="bg-gradient-to-br from-brand-50 to-ink-50 px-4 py-3 border-b border-ink-100">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-500">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Student Preview
              </p>
            </div>

            <div className="p-4">
              {/* Question */}
              <div className="mb-4 rounded-xl bg-ink-50 p-3">
                <MathText
                  as="p"
                  text={form.questionText || 'Your question appears here…'}
                  className={cn('font-semibold text-ink-900', !form.questionText && 'italic text-ink-400')}
                />
              </div>

              {/* Options / Answer */}
              {form.type === 'MCQ_SINGLE' ? (
                <div className="space-y-2">
                  {OPTION_KEYS.map((k, i) =>
                    form.options[i] ? (
                      <div
                        key={k}
                        className={cn(
                          'flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors',
                          form.correctAnswer === k
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-ink-100 bg-white',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            form.correctAnswer === k
                              ? 'bg-emerald-500 text-white'
                              : 'bg-ink-100 text-ink-600',
                          )}
                        >
                          {k}
                        </span>
                        <MathText text={form.options[i]} />
                      </div>
                    ) : null,
                  )}
                </div>
              ) : form.type === 'TRUE_FALSE' ? (
                <div className="flex gap-2">
                  {['true', 'false'].map((v) => (
                    <div
                      key={v}
                      className={cn(
                        'flex-1 rounded-xl border py-2 text-center text-sm font-semibold',
                        form.correctAnswer === v
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-ink-100 text-ink-500',
                      )}
                    >
                      {v === 'true' ? 'True' : 'False'}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-600">
                  Answer: <strong>{form.correctAnswer || '—'}</strong>
                  {Number(form.answerTolerance) > 0 && ` (±${form.answerTolerance})`}
                </p>
              )}

              {/* Explanation steps */}
              {explanationSteps.length > 0 && (
                <div className="mt-4 border-t border-ink-100 pt-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">Explanation</p>
                  <ol className="space-y-2">
                    {explanationSteps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                          {i + 1}
                        </span>
                        <MathText text={s} />
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Concept note preview */}
              {form.conceptNote.trim() && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-gold-200 bg-gold-50 p-3">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" aria-hidden="true" />
                  <p className="text-sm text-ink-700">
                    <MathText text={form.conceptNote} />
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Performance stats */}
          {existing?.stats && (
            <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700">
                <BarChart3 className="h-4 w-4 text-brand-500" aria-hidden="true" />
                Performance stats
              </p>
              <div className="grid grid-cols-3 gap-2">
                {/* Attempts */}
                <div className="flex flex-col items-center rounded-xl bg-sky-50 border border-sky-100 p-3">
                  <Users className="mb-1 h-4 w-4 text-sky-500" aria-hidden="true" />
                  <span className="text-lg font-bold font-display text-ink-900">{existing.stats.attempts}</span>
                  <span className="text-xs text-ink-500">Attempts</span>
                </div>
                {/* Correct % */}
                <div className="flex flex-col items-center rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                  <Percent className="mb-1 h-4 w-4 text-emerald-500" aria-hidden="true" />
                  <span className="text-lg font-bold font-display text-ink-900">
                    {existing.stats.attempts
                      ? Math.round((existing.stats.correct / existing.stats.attempts) * 100)
                      : 0}%
                  </span>
                  <span className="text-xs text-ink-500">Correct</span>
                </div>
                {/* Avg time */}
                <div className="flex flex-col items-center rounded-xl bg-amber-50 border border-amber-100 p-3">
                  <Timer className="mb-1 h-4 w-4 text-amber-500" aria-hidden="true" />
                  <span className="text-lg font-bold font-display text-ink-900">{existing.stats.avgTimeSec}s</span>
                  <span className="text-xs text-ink-500">Avg time</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick metadata summary */}
          {!isNew && existing && (
            <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-400">Question info</p>
              <dl className="space-y-2 text-sm">
                {existing.version && (
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Version</dt>
                    <dd className="font-semibold text-ink-800">v{existing.version}</dd>
                  </div>
                )}
                {existing.source && (
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Source</dt>
                    <dd className="font-semibold text-ink-800 capitalize">{existing.source.replace('_', ' ')}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-ink-500">Type</dt>
                  <dd className="font-semibold text-ink-800">{form.type.replace('_', ' ')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Difficulty</dt>
                  <dd className={cn(
                    'font-semibold capitalize',
                    form.difficulty === 'EASY' ? 'text-emerald-600' :
                    form.difficulty === 'MEDIUM' ? 'text-amber-600' : 'text-rose-600',
                  )}>
                    {form.difficulty.toLowerCase()}
                  </dd>
                </div>
                {existing.updatedAt && (
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Updated</dt>
                    <dd className="font-semibold text-ink-800">{formatDateTime(existing.updatedAt)}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm dialogs (unchanged) ── */}
      <ConfirmDialog
        open={confirmRetire}
        onClose={() => setConfirmRetire(false)}
        onConfirm={() => { setConfirmRetire(false); setStatus('RETIRED', 'Retired — no longer served.'); }}
        tone="danger"
        title="Retire this question?"
        description="Students will stop seeing it. A retired question can't be published again; duplicate it to reuse it."
        confirmLabel="Retire"
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); remove(); }}
        tone="danger"
        title="Delete this question?"
        description="Drafts are deleted. Published questions are retired so students' past answers stay intact."
        confirmLabel="Delete"
      />
    </div>
  );
}
