import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Grid3x3, Send, Clock, Cloud, CloudOff, Check, AlertTriangle } from 'lucide-react';
import { Button, Card, Skeleton, ErrorState, Modal, ConfirmDialog } from '@/components/ui';
import { QuestionView } from '@/components/question/QuestionView';
import { testApi } from '@/services/api/student';
import { errorMessage, ERROR_CODES } from '@/services/errors';
import { useDocumentTitle, useServerCountdown, useInterval, useBeforeUnload, useOnline } from '@/hooks/useCommon';
import { formatDuration } from '@/lib/date';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { refreshSummary } from '@/features/shared/useHome';

const AUTOSAVE_MS = 10000; // F6-05: never lose more than 10 s of work

function Palette({ questions, answers, marked, index, onJump }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
        {questions.map((q, i) => {
          const answered = answers[q.questionId] != null && answers[q.questionId] !== '';
          const isMarked = marked.includes(q.questionId);
          return (
            <button key={q.questionId} type="button" onClick={() => onJump(i)} aria-label={`Question ${i + 1}${answered ? ', answered' : ''}${isMarked ? ', marked for review' : ''}`}
              className={cn('relative flex aspect-square items-center justify-center rounded-xl text-sm font-bold transition',
                i === index && 'ring-2 ring-brand-600 ring-offset-2',
                answered ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
                isMarked && !answered && 'bg-amber-100 text-amber-800')}
            >
              {i + 1}
              {isMarked && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-400" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] font-semibold text-ink-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-600" />Answered</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-ink-200" />Not answered</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-400" />For review</span>
      </div>
    </div>
  );
}

/**
 * Timed test player. The server owns the clock (F6-06): remaining time comes from the server,
 * is counted down with a monotonic clock, and a late submit is rejected and auto-submitted server-side.
 */
export default function TestPlayerPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const online = useOnline();
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState([]);
  const [saveState, setSaveState] = useState({ status: 'idle', at: null });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const done = useRef(false);
  const latest = useRef({ answers: {}, marked: [] });
  latest.current = { answers, marked };
  useDocumentTitle(session?.test?.title || 'Test');

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await testApi.start(testId);
      if (s.autoSubmitted) {
        toast.info('Time ran out while you were away — your saved answers were submitted.');
        navigate(`/tests/result/${s.attemptId}`, { replace: true });
        return;
      }
      setSession(s);
      setAnswers(s.answers || {});
      setMarked(s.marked || []);
      const firstOpen = s.questions.findIndex((q) => !s.answers?.[q.questionId]);
      setIndex(firstOpen === -1 ? 0 : firstOpen);
      track('test_started', { testId });
    } catch (e) {
      if (e.code === ERROR_CODES.ALREADY_ATTEMPTED && e.details?.attemptId) navigate(`/tests/result/${e.details.attemptId}`, { replace: true });
      else setError(e);
    }
  }, [testId, navigate]);

  useEffect(() => { load(); }, [load]);

  const remaining = useServerCountdown(session?.remainingSec ?? 0);

  const finishWith = useCallback((result) => {
    done.current = true;
    refreshSummary();
    track('test_submitted', { testId, auto: result.autoSubmitted });
    navigate(`/tests/result/${result.attemptId}`, { replace: true, state: { fresh: true } });
  }, [navigate, testId]);

  const autosave = useCallback(async () => {
    if (!session || done.current || !dirty.current) return;
    dirty.current = false;
    setSaveState((s) => ({ ...s, status: 'saving' }));
    try {
      const res = await testApi.autosave(testId, { attemptId: session.attemptId, ...latest.current });
      if (res.submitted) {
        toast.info(res.autoSubmitted ? "Time's up! Your answers were submitted automatically." : 'This test was already submitted.');
        finishWith({ attemptId: res.attemptId, autoSubmitted: res.autoSubmitted });
        return;
      }
      setSaveState({ status: 'saved', at: res.savedAt });
    } catch (e) {
      dirty.current = true; // retry on next tick
      setSaveState((s) => ({ ...s, status: e.code === ERROR_CODES.NETWORK ? 'offline' : 'error' }));
    }
  }, [session, testId, finishWith]);

  useInterval(autosave, session ? AUTOSAVE_MS : null);
  // Save shortly after every change (debounced), plus on tab hide
  useEffect(() => {
    if (!session) return undefined;
    const t = setTimeout(autosave, 1500);
    return () => clearTimeout(t);
  }, [answers, marked, session, autosave]);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') autosave(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [autosave]);
  useBeforeUnload(Boolean(session) && !done.current);

  const submit = useCallback(async (timeUp = false) => {
    if (done.current) return;
    setSubmitting(true);
    try {
      const result = await testApi.submit(testId, { attemptId: session.attemptId, ...latest.current, timeUp });
      finishWith(result);
    } catch (e) {
      toast.error(errorMessage(e));
      setSubmitting(false);
    }
  }, [session, testId, finishWith]);

  // Auto-submit when the countdown reaches zero
  useEffect(() => {
    if (session && remaining === 0 && !done.current && !submitting) {
      toast.info("Time's up! Submitting your answers…");
      submit(true);
    }
  }, [remaining, session, submitting, submit]);

  if (error) return <div className="mx-auto max-w-2xl p-6"><ErrorState error={error} onRetry={load} /></div>;
  if (!session) return <div className="mx-auto max-w-4xl space-y-4 p-6"><Skeleton className="h-14" /><Skeleton className="h-96 rounded-3xl" /></div>;

  const q = session.questions[index];
  const setAnswer = (v) => { dirty.current = true; setAnswers((a) => ({ ...a, [q.questionId]: v })); };
  const toggleMark = () => { dirty.current = true; setMarked((m) => (m.includes(q.questionId) ? m.filter((x) => x !== q.questionId) : [...m, q.questionId])); };
  const answeredCount = session.questions.filter((x) => answers[x.questionId]).length;
  const low = remaining <= 60;
  const warn = remaining <= 300;

  return (
    <div className="min-h-screen pb-24 lg:pb-8">
      <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-ink-900">{session.test.title}</p>
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              {saveState.status === 'saving' && <><Cloud className="h-3.5 w-3.5 animate-pulse" />Saving…</>}
              {saveState.status === 'saved' && <><Check className="h-3.5 w-3.5 text-emerald-500" />Saved</>}
              {(saveState.status === 'offline' || !online) && <span className="flex items-center gap-1 text-amber-600"><CloudOff className="h-3.5 w-3.5" />Offline — will retry</span>}
              {saveState.status === 'error' && <span className="text-rose-600">Save failed — retrying</span>}
              {saveState.status === 'idle' && <>{answeredCount}/{session.questions.length} answered</>}
            </p>
          </div>
          <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2 font-display text-lg font-bold tabular-nums', low ? 'animate-pulse bg-rose-600 text-white' : warn ? 'bg-amber-100 text-amber-800' : 'bg-ink-100 text-ink-900')} role="timer" aria-live={low ? 'assertive' : 'off'} aria-label={`Time remaining ${formatDuration(remaining)}`}>
            <Clock className="h-5 w-5" />{formatDuration(remaining)}
          </div>
          <Button className="hidden sm:inline-flex" leftIcon={Send} onClick={() => setConfirm(true)}>Submit</Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {warn && !low && <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800"><AlertTriangle className="h-4 w-4" />Less than 5 minutes left.</div>}
          <Card className="sm:p-8">
            <QuestionView question={q} value={answers[q.questionId] || ''} onChange={setAnswer} number={index + 1} total={session.questions.length} />
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5">
              <Button variant={marked.includes(q.questionId) ? 'secondary' : 'ghost'} size="sm" leftIcon={marked.includes(q.questionId) ? BookmarkCheck : Bookmark} onClick={toggleMark}>
                {marked.includes(q.questionId) ? 'Marked for review' : 'Mark for review'}
              </Button>
              {answers[q.questionId] && <button type="button" onClick={() => setAnswer('')} className="text-sm font-semibold text-ink-400 hover:text-ink-700">Clear answer</button>}
            </div>
          </Card>
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button variant="outline" leftIcon={ArrowLeft} disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</Button>
            <Button variant="outline" className="lg:hidden" leftIcon={Grid3x3} onClick={() => setPaletteOpen(true)}>{index + 1}/{session.questions.length}</Button>
            {index < session.questions.length - 1
              ? <Button rightIcon={ArrowRight} onClick={() => setIndex(index + 1)}>Next</Button>
              : <Button variant="success" leftIcon={Send} onClick={() => setConfirm(true)}>Finish</Button>}
          </div>
        </div>
        <aside className="hidden lg:block">
          <Card className="sticky top-24">
            <p className="mb-4 font-bold text-ink-900">Question palette</p>
            <Palette questions={session.questions} answers={answers} marked={marked} index={index} onJump={setIndex} />
            <Button block className="mt-6" leftIcon={Send} onClick={() => setConfirm(true)}>Submit test</Button>
          </Card>
        </aside>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-white p-3 sm:hidden">
        <Button block size="lg" leftIcon={Send} onClick={() => setConfirm(true)}>Submit test</Button>
      </div>

      <Modal open={paletteOpen} onClose={() => setPaletteOpen(false)} title="Jump to question">
        <Palette questions={session.questions} answers={answers} marked={marked} index={index} onJump={(i) => { setIndex(i); setPaletteOpen(false); }} />
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => submit(false)} loading={submitting} title="Submit your test?" confirmLabel="Submit now" tone="success">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-brand-50 p-3"><p className="font-display text-xl font-bold text-brand-700">{answeredCount}</p><p className="text-xs text-ink-500">answered</p></div>
          <div className="rounded-xl bg-ink-100 p-3"><p className="font-display text-xl font-bold">{session.questions.length - answeredCount}</p><p className="text-xs text-ink-500">skipped</p></div>
          <div className="rounded-xl bg-amber-50 p-3"><p className="font-display text-xl font-bold text-amber-700">{marked.length}</p><p className="text-xs text-ink-500">marked</p></div>
        </div>
        <p className="mt-3 text-sm text-ink-500">You still have {formatDuration(remaining)} left. You can&apos;t change answers after submitting.</p>
      </ConfirmDialog>
    </div>
  );
}
