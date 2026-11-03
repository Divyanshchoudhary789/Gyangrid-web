import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Lightbulb, AlertTriangle, ListOrdered, RotateCcw, Target, BookOpen, Archive, ArchiveRestore, Wand2, CalendarClock, CheckCircle2, XCircle, History, Eye, Undo2,
} from 'lucide-react';
import { PageHeader, Card, Button, Badge, PageSkeleton, ErrorState, Modal, Alert, DifficultyBadge, Spinner } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { QuestionView } from '@/components/question/QuestionView';
import { useQuery } from '@/hooks/useQuery';
import { mistakeApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { useCelebrationStore } from '@/store/celebrationStore';
import { useDocumentTitle, useElapsed, useOnline } from '@/hooks/useCommon';
import { SOURCE_LABELS } from '@/config/constants';
import { formatDate, formatDateTime } from '@/lib/date';
import { track } from '@/lib/analytics';
import { refreshSummary } from '@/features/shared/useHome';

/** What this API can do. The local mock implements the full PRD; the live backend declares its subset. */
const CAPS = mistakeApi.capabilities || { retry: true, archive: true, simpler: true, review: false, resolve: false, reopen: false, dueDates: true };

function StatusBadge({ m }) {
  if (m.status === 'RESOLVED') return <Badge tone="success" icon={CheckCircle2}>Resolved</Badge>;
  if (m.status === 'ARCHIVED') return <Badge icon={Archive}>Archived</Badge>;
  if (m.status === 'REVIEWED') return <Badge tone="info" icon={Eye}>Reviewed</Badge>;
  if (m.due) return <Badge tone="danger" icon={CalendarClock}>Due for review</Badge>;
  return <Badge tone="warning">Active</Badge>;
}

function Steps({ steps }) {
  if (!steps?.length) return null;
  if (steps.length === 1) return <MathText as="p" text={steps[0]} className="text-[15px] leading-relaxed text-ink-700" />;
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-[15px] text-ink-700"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span><MathText text={s} /></li>
      ))}
    </ol>
  );
}

export default function MistakeDetailPage() {
  const { mistakeId } = useParams();
  const navigate = useNavigate();
  const online = useOnline();
  const celebrate = useCelebrationStore((s) => s.celebrate);
  const { data: m, error, loading, refetch, mutate } = useQuery(`mistake:${mistakeId}`, () => mistakeApi.get(mistakeId), { staleMs: 0 });
  const [answer, setAnswer] = useState('');
  const [retryResult, setRetryResult] = useState(null);
  const [showSolution, setShowSolution] = useState(!CAPS.retry);
  const [busy, setBusy] = useState(null);
  const [simple, setSimple] = useState(null);
  const [simpleOpen, setSimpleOpen] = useState(false);
  const elapsed = useElapsed(mistakeId);
  useDocumentTitle('Mistake');

  if (loading && !m) return <PageSkeleton rows={1} />;
  if (!m) return <ErrorState error={error} onRetry={refetch} />;

  const solutionVisible = showSolution || retryResult || m.status === 'RESOLVED';
  const questionForView = m.uiQuestion || { ...m.question, questionText: m.question.text, questionImageUrl: m.question.imageUrl };

  const run = async (key, fn, onDone) => {
    setBusy(key);
    try {
      const res = await fn();
      onDone?.(res);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const retry = () => run('retry', () => mistakeApi.retry(mistakeId, { answer, timeSpentSec: elapsed() }), (res) => {
    mutate(res.mistake);
    setRetryResult(res);
    refreshSummary();
    if (res.correct) {
      track('mistake_resolved');
      celebrate({ title: 'Mistake resolved!', xp: res.xpAwarded || undefined, emoji: '✅', confetti: Boolean(res.xpAwarded) });
    } else {
      toast('Not yet — check the solution and the concept below. It will come back in 3 days.', { icon: '💪' });
    }
  });

  const setStatus = (action, message) => run(action, () => mistakeApi[action](mistakeId), (res) => {
    mutate(res);
    refreshSummary();
    if (action === 'resolve') {
      track('mistake_resolved');
      celebrate({ title: 'Mistake resolved!', emoji: '✅', confetti: false });
    } else toast.success(message);
  });

  const explainSimpler = async () => {
    setSimpleOpen(true);
    if (simple) return;
    try { setSimple(await mistakeApi.simpler(mistakeId)); } catch (e) { toast.error(errorMessage(e)); setSimpleOpen(false); }
  };

  const practiceMore = () => run('practice', () => mistakeApi.practiceMore(mistakeId), (set) => {
    if (set.notice) toast.info(set.notice);
    navigate(`/practice/session/${set.id}`);
  });

  const toggleArchive = () => run('archive', () => mistakeApi.archive(mistakeId, m.status !== 'ARCHIVED'), (res) => {
    mutate(res);
    refreshSummary();
    toast.success(m.status === 'ARCHIVED' ? 'Moved back to active.' : 'Archived — it won’t resurface, but stays searchable.');
  });

  const retryReveal = retryResult ? { correct: retryResult.correct, correctAnswer: m.correctAnswer, yourAnswer: answer } : null;
  const eyebrow = [m.chapterName, m.topicName].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ to: '/mistakes', label: 'Mistake Bank' }}
        eyebrow={eyebrow || undefined}
        title="Learn from this mistake"
        action={(
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge m={m} />
            {m.wrongCount > 1 && <Badge tone="warning">Wrong {m.wrongCount} times</Badge>}
          </div>
        )}
      />

      <Card className="sm:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <DifficultyBadge level={m.question.difficulty} />
          {m.sources.map((s) => <Badge key={s}>{SOURCE_LABELS[s] || s}</Badge>)}
        </div>
        {CAPS.retry ? (
          <>
            <QuestionView question={questionForView} value={answer} onChange={setAnswer} reveal={retryReveal} showMeta={false} disabled={m.status === 'RESOLVED' && !retryResult} />
            {m.status !== 'RESOLVED' && !retryResult && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button leftIcon={RotateCcw} onClick={retry} disabled={!answer || !online} loading={busy === 'retry'}>Retry this question</Button>
                {!showSolution && <Button variant="ghost" leftIcon={Eye} onClick={() => setShowSolution(true)}>Show solution first</Button>}
              </div>
            )}
            {retryResult && (
              <Alert tone={retryResult.correct ? 'success' : 'warning'} className="mt-5" title={retryResult.correct ? `Resolved!${retryResult.xpAwarded ? ` +${retryResult.xpAwarded} XP` : ''}` : 'Not yet — you are getting closer'}>
                {retryResult.correct ? 'It stays in your bank as a resolved mistake you can revisit any time.' : m.nextReviewAt ? `We'll bring it back on ${formatDate(`${m.nextReviewAt}T12:00:00+05:30`, { day: 'numeric', month: 'short' })}.` : 'Read the solution below and try again later.'}
              </Alert>
            )}
          </>
        ) : (
          // Read-only view: shows the options with the student's choice (and the correct one, when the API provides it).
          <QuestionView question={questionForView} value={m.yourAnswer || ''} onChange={() => {}} disabled reveal={m.correctAnswer != null ? { correct: false, correctAnswer: m.correctAnswer, yourAnswer: m.yourAnswer } : null} showMeta={false} />
        )}
      </Card>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Card className="border-rose-100 bg-rose-50/60 p-5 sm:p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-rose-600"><XCircle className="h-4 w-4" />Your answer</p>
          <MathText as="p" text={m.yourAnswerLabel} className="mt-2 text-lg font-semibold text-ink-900" />
        </Card>
        <Card className="border-emerald-100 bg-emerald-50/60 p-5 sm:p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-600"><CheckCircle2 className="h-4 w-4" />Correct answer</p>
          {!solutionVisible ? <p className="mt-2 text-sm text-ink-500">Try again first, or tap “Show solution”.</p>
            : m.correctAnswerLabel ? <MathText as="p" text={m.correctAnswerLabel} className="mt-2 text-lg font-semibold text-ink-900" />
              : <p className="mt-2 text-sm text-ink-600">See the worked solution below.</p>}
        </Card>
      </div>

      <div className="mt-5 space-y-4">
        {solutionVisible && m.explanation?.length > 0 && (
          <Card>
            <h2 className="mb-3 flex items-center gap-2 font-bold text-ink-900"><ListOrdered className="h-5 w-5 text-brand-500" />{m.explanation.length > 1 ? 'Full step-by-step solution' : 'Worked solution'}</h2>
            <Steps steps={m.explanation} />
          </Card>
        )}
        {(m.aiConcept || m.conceptNote) && (
          <Card className="border-sky-100">
            <h2 className="flex items-center gap-2 font-bold text-ink-900"><Lightbulb className="h-5 w-5 text-sky-500" />The concept — why the answer is right</h2>
            <MathText as="p" text={m.aiConcept?.whyCorrect || m.conceptNote} className="mt-2 leading-relaxed text-ink-700" />
          </Card>
        )}
        {m.aiConcept?.likelyError && (
          <Card className="border-amber-100">
            <h2 className="flex items-center gap-2 font-bold text-ink-900"><AlertTriangle className="h-5 w-5 text-amber-500" />Where you likely went wrong</h2>
            <MathText as="p" text={m.aiConcept.likelyError} className="mt-2 leading-relaxed text-ink-700" />
          </Card>
        )}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {CAPS.review && m.status === 'ACTIVE' && <Button variant="secondary" leftIcon={Eye} loading={busy === 'review'} disabled={!online} onClick={() => setStatus('review', 'Marked as reviewed.')}>I’ve reviewed it</Button>}
        {CAPS.resolve && m.status !== 'RESOLVED' && <Button variant="success" leftIcon={CheckCircle2} loading={busy === 'resolve'} disabled={!online} onClick={() => setStatus('resolve')}>I understand it now — resolve</Button>}
        {CAPS.reopen && m.status === 'RESOLVED' && <Button variant="outline" leftIcon={Undo2} loading={busy === 'reopen'} disabled={!online} onClick={() => setStatus('reopen', 'Moved back to active.')}>Reopen</Button>}
        {CAPS.simpler && <Button variant="secondary" leftIcon={Wand2} onClick={explainSimpler}>Explain this concept again, simpler</Button>}
        <Button variant="secondary" leftIcon={Target} loading={busy === 'practice'} disabled={!online || !m.topicId} onClick={practiceMore}>Practise 5 more like this</Button>
        {m.topicId && <Button variant="outline" leftIcon={BookOpen} to={`/learn/topic/${m.topicId}`}>Read topic notes</Button>}
        {CAPS.archive && m.status !== 'RESOLVED' && <Button variant="outline" leftIcon={m.status === 'ARCHIVED' ? ArchiveRestore : Archive} loading={busy === 'archive'} onClick={toggleArchive}>{m.status === 'ARCHIVED' ? 'Unarchive' : 'I understand it — archive'}</Button>}
      </div>

      <Card className="mt-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-ink-900"><History className="h-5 w-5 text-ink-400" />History</h2>
        <ul className="space-y-2 text-sm">
          {m.createdAt && <li className="text-ink-600">First saved {formatDateTime(m.createdAt)}</li>}
          {m.attempts.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-ink-600">
              <XCircle className="h-4 w-4 text-rose-400" /><span>Answered <MathText text={a.label} className="font-semibold text-ink-800" /></span>
              {a.at && <span className="text-ink-400">· {SOURCE_LABELS[a.source] || 'Review'} · {formatDateTime(a.at)}</span>}
            </li>
          ))}
          {m.reviewedAt && <li className="flex items-center gap-2 text-sky-700"><Eye className="h-4 w-4" />Reviewed {formatDateTime(m.reviewedAt)}</li>}
          {m.resolvedAt && <li className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4" />Resolved {formatDateTime(m.resolvedAt)}</li>}
        </ul>
        {m.status === 'ACTIVE' && m.nextReviewAt && <p className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500">Next review: {formatDate(`${m.nextReviewAt}T12:00:00+05:30`, { weekday: 'short', day: 'numeric', month: 'short' })} · reviewed {m.reviewCount} time{m.reviewCount === 1 ? '' : 's'}</p>}
      </Card>

      <Modal open={simpleOpen} onClose={() => setSimpleOpen(false)} title="Let's make it simpler">
        {!simple ? <div className="flex justify-center py-10"><Spinner className="h-8 w-8" /></div> : (
          <div>
            <p className="text-ink-700">{simple.intro}</p>
            <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">Idea: {simple.concept}</p>
            <ol className="mt-4 space-y-2.5">{simple.steps.map((s, i) => <li key={i} className="flex gap-3 text-[15px]"><span className="font-bold text-brand-600">{i + 1}.</span><MathText text={s} /></li>)}</ol>
          </div>
        )}
      </Modal>
    </div>
  );
}
