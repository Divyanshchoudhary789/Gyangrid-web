import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Save, Send, CheckCircle2, Ban, Copy, ArrowLeft, BarChart3 } from 'lucide-react';
import { Card, Button, TextField, TextArea, SelectField, PageSkeleton, ErrorState, Alert } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatDateTime } from '@/lib/date';
import { cn } from '@/lib/cn';
import { AdminPageHeader, ClassSelect, StatusBadge, useCan } from './adminShared';

const EMPTY = { classId: 8, chapterId: '', topicId: '', type: 'MCQ_SINGLE', difficulty: 'EASY', questionText: '', options: ['', '', '', ''], correctAnswer: 'A', answerTolerance: 0, explanation: '', conceptNote: '', estimatedTimeSec: 60 };

export default function QuestionEditorPage() {
  const { questionId } = useParams();
  const isNew = !questionId;
  const navigate = useNavigate();
  const canEdit = useCan('editContent');
  const { data: existing, error, loading, refetch } = useQuery(`admin:question:${questionId}`, () => adminApi.question(questionId), { enabled: !isNew, staleMs: 0 });
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  useDocumentTitle(isNew ? 'New question' : questionId);

  useEffect(() => {
    if (!existing) return;
    setForm({
      classId: existing.classId, chapterId: existing.chapterId, topicId: existing.topicId, type: existing.type, difficulty: existing.difficulty,
      questionText: existing.questionText, options: [0, 1, 2, 3].map((i) => existing.options?.[i]?.text || ''), correctAnswer: existing.correctAnswer,
      answerTolerance: existing.answerTolerance || 0, explanation: (existing.explanation || []).join('\n'), conceptNote: existing.conceptNote || '', estimatedTimeSec: existing.estimatedTimeSec,
    });
  }, [existing]);

  const { data: cur } = useQuery(`admin:curriculum:${form.classId}`, () => adminApi.curriculum(form.classId));
  const chapter = cur?.chapters.find((c) => c.id === form.chapterId);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const payload = () => ({
    topicId: form.topicId, type: form.type, difficulty: form.difficulty, questionText: form.questionText,
    options: form.type === 'MCQ_SINGLE' ? form.options.filter((o) => o.trim()).map((text) => ({ text })) : [],
    correctAnswer: form.correctAnswer, answerTolerance: Number(form.answerTolerance) || 0,
    explanation: form.explanation.split('\n').map((s) => s.trim()).filter(Boolean), conceptNote: form.conceptNote, estimatedTimeSec: Number(form.estimatedTimeSec) || 60,
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

  const saveNew = (submitForReview) => run(() => adminApi.createQuestion({ ...payload(), submitForReview }), submitForReview ? 'Submitted for review.' : 'Draft saved.', (q) => navigate(`/admin/questions/${encodeURIComponent(q.questionId)}`, { replace: true }));
  const saveEdit = () => run(() => adminApi.updateQuestion(questionId, payload()), 'Saved. Students’ past mistakes keep their original snapshot.');
  const setStatus = (status, msg) => run(() => adminApi.setQuestionStatus(questionId, status), msg);
  const duplicate = () => run(() => adminApi.duplicateQuestion(questionId), 'Duplicated as a draft.', (q) => navigate(`/admin/questions/${encodeURIComponent(q.questionId)}`));

  if (!isNew && loading && !existing) return <PageSkeleton rows={1} />;
  if (!isNew && !existing) return <ErrorState error={error} onRetry={refetch} />;

  const keys = ['A', 'B', 'C', 'D'];
  const noExplanation = !form.explanation.trim();

  return (
    <div>
      <button type="button" onClick={() => navigate('/admin/questions')} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" />Question bank</button>
      <AdminPageHeader
        title={isNew ? 'New question' : questionId}
        subtitle={existing ? `v${existing.version} · ${existing.source.replace('_', ' ')} · updated ${formatDateTime(existing.updatedAt)}` : 'Author in LaTeX: wrap maths in $…$'}
        action={existing && <StatusBadge status={existing.status} />}
      />
      {errors.length > 0 && <Alert tone="danger" className="mb-4" title="Please fix the following">{<ul className="list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card className="grid gap-3 sm:grid-cols-3">
            <ClassSelect value={form.classId} onChange={(classId) => set({ classId, chapterId: '', topicId: '' })} />
            <SelectField label="Chapter" value={form.chapterId} placeholder="Choose…" onChange={(e) => set({ chapterId: e.target.value, topicId: '' })} options={(cur?.chapters || []).map((c) => ({ value: c.id, label: c.name }))} />
            <SelectField label="Topic" value={form.topicId} placeholder="Choose…" onChange={(e) => set({ topicId: e.target.value })} options={(chapter?.topics || []).map((t) => ({ value: t.id, label: t.name }))} />
            <SelectField label="Type" value={form.type} onChange={(e) => set({ type: e.target.value, correctAnswer: e.target.value === 'MCQ_SINGLE' ? 'A' : '' })} options={[{ value: 'MCQ_SINGLE', label: 'MCQ (single answer)' }, { value: 'NUMERIC', label: 'Numeric' }]} />
            <SelectField label="Difficulty" value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })} options={['EASY', 'MEDIUM', 'HARD'].map((d) => ({ value: d, label: d }))} />
            <TextField label="Est. time (sec)" type="number" min={10} value={form.estimatedTimeSec} onChange={(e) => set({ estimatedTimeSec: e.target.value })} />
          </Card>
          <Card>
            <TextArea label="Question text" value={form.questionText} onChange={(e) => set({ questionText: e.target.value })} rows={3} placeholder="Solve for $x$: $5x - 3 = 2x + 9$" required />
            {form.type === 'MCQ_SINGLE' ? (
              <div className="mt-4 space-y-2">
                <p className="label">Options — select the correct one</p>
                {keys.map((k, i) => (
                  <div key={k} className="flex items-center gap-2">
                    <button type="button" onClick={() => set({ correctAnswer: k })} className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold', form.correctAnswer === k ? 'bg-emerald-500 text-white' : 'bg-ink-100 text-ink-600')} aria-label={`Mark ${k} correct`} aria-pressed={form.correctAnswer === k}>{k}</button>
                    <input className="input" value={form.options[i]} onChange={(e) => set({ options: form.options.map((o, j) => (j === i ? e.target.value : o)) })} placeholder={`Option ${k}`} aria-label={`Option ${k}`} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <TextField label="Correct answer" value={form.correctAnswer} onChange={(e) => set({ correctAnswer: e.target.value })} inputMode="decimal" />
                <TextField label="Tolerance (±)" type="number" step="0.001" value={form.answerTolerance} onChange={(e) => set({ answerTolerance: e.target.value })} />
              </div>
            )}
          </Card>
          <Card>
            <TextArea label="Step-by-step explanation (one step per line)" value={form.explanation} onChange={(e) => set({ explanation: e.target.value })} rows={6} hint="Mandatory for approval — the Mistake Bank depends on it." error={noExplanation && existing?.status === 'APPROVED' ? 'Approved questions must keep an explanation.' : undefined} />
            <TextArea className="mt-4" label="Concept note (recommended)" value={form.conceptNote} onChange={(e) => set({ conceptNote: e.target.value })} rows={3} />
          </Card>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {isNew ? (
                <>
                  <Button variant="outline" leftIcon={Save} loading={busy} onClick={() => saveNew(false)}>Save draft</Button>
                  <Button leftIcon={Send} loading={busy} onClick={() => saveNew(true)}>Submit for review</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" leftIcon={Save} loading={busy} onClick={saveEdit}>Save changes</Button>
                  {existing.status !== 'APPROVED' && <Button variant="success" leftIcon={CheckCircle2} loading={busy} disabled={noExplanation} onClick={() => setStatus('APPROVED', 'Approved — now served to students.')} title={noExplanation ? 'Add an explanation to approve' : undefined}>Approve</Button>}
                  {existing.status === 'DRAFT' && <Button variant="secondary" leftIcon={Send} onClick={() => setStatus('IN_REVIEW', 'Sent to review queue.')}>Send to review</Button>}
                  {existing.status !== 'RETIRED' && <Button variant="danger" leftIcon={Ban} onClick={() => setStatus('RETIRED', 'Retired — no longer served.')}>Retire</Button>}
                  <Button variant="ghost" leftIcon={Copy} onClick={duplicate}>Duplicate</Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-400">Student preview</p>
            <MathText as="p" text={form.questionText || 'Your question appears here'} className="font-semibold text-ink-900" />
            {form.type === 'MCQ_SINGLE' ? (
              <div className="mt-3 space-y-1.5">{keys.map((k, i) => form.options[i] && <div key={k} className={cn('rounded-xl border px-3 py-2 text-sm', form.correctAnswer === k ? 'border-emerald-300 bg-emerald-50' : 'border-ink-100')}><strong>{k}.</strong> <MathText text={form.options[i]} /></div>)}</div>
            ) : <p className="mt-3 text-sm text-ink-600">Answer: <strong>{form.correctAnswer || '—'}</strong>{Number(form.answerTolerance) > 0 && ` (±${form.answerTolerance})`}</p>}
            {form.explanation.trim() && (
              <ol className="mt-4 space-y-1 border-t border-ink-100 pt-3 text-sm text-ink-700">{form.explanation.split('\n').filter((s) => s.trim()).map((s, i) => <li key={i}>{i + 1}. <MathText text={s} /></li>)}</ol>
            )}
          </Card>
          {existing?.stats && (
            <Card>
              <p className="mb-3 flex items-center gap-2 font-bold"><BarChart3 className="h-4 w-4 text-brand-500" />Performance</p>
              <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-ink-50 p-2"><dt className="text-xs text-ink-500">Attempts</dt><dd className="font-bold">{existing.stats.attempts}</dd></div>
                <div className="rounded-xl bg-ink-50 p-2"><dt className="text-xs text-ink-500">Correct</dt><dd className="font-bold">{existing.stats.attempts ? Math.round((existing.stats.correct / existing.stats.attempts) * 100) : 0}%</dd></div>
                <div className="rounded-xl bg-ink-50 p-2"><dt className="text-xs text-ink-500">Avg time</dt><dd className="font-bold">{existing.stats.avgTimeSec}s</dd></div>
              </dl>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
