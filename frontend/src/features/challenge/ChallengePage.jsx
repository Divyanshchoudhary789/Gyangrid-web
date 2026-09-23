import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { X, ArrowLeft, ArrowRight, Flame, Send, CloudOff, Check, Cloud } from 'lucide-react';
import { Button, Card, Skeleton, ErrorState, ConfirmDialog } from '@/components/ui';
import { QuestionView } from '@/components/question/QuestionView';
import { challengeApi } from '@/services/api/student';
import { errorMessage, ERROR_CODES } from '@/services/errors';
import { useDocumentTitle, useElapsed, useOnline } from '@/hooks/useCommon';
import { storage } from '@/lib/storage';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { refreshSummary } from '@/features/shared/useHome';

/**
 * Daily Challenge player.
 * - The challenge is generated and pinned on the server (F5-04); we only render it.
 * - Every answer is saved as soon as it is chosen (F5-06). No correctness is returned until submit.
 * - If the network drops, answers are queued locally and flushed on reconnect (NFR-03).
 */
export default function ChallengePage() {
  useDocumentTitle("Today's Challenge");
  const navigate = useNavigate();
  const online = useOnline();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [pending, setPending] = useState(() => storage.get('challengePending', {}));
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [review, setReview] = useState(false);
  const times = useRef({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const c = await challengeApi.today();
      if (c.status === 'SUBMITTED') { navigate('/challenge/result', { replace: true }); return; }
      setData(c);
      const local = storage.get('challengePending', {});
      const merged = { ...c.answers, ...(local[c.id]?.answers || {}) };
      setAnswers(merged);
      setIndex(c.currentIndex);
      if (c.status === 'NOT_STARTED') track('challenge_started');
    } catch (e) {
      setError(e);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const q = data?.questions[index];
  const elapsed = useElapsed(q?.questionId);

  const persistPending = (next) => { setPending(next); storage.set('challengePending', next); };

  const saveAnswer = useCallback(async (questionId, answer) => {
    const timeSpentSec = (times.current[questionId] || 0) + elapsed();
    times.current[questionId] = timeSpentSec;
    setSaving(true);
    try {
      await challengeApi.answer({ questionId, answer, timeSpentSec });
      const next = { ...pending };
      if (next[data.id]) { delete next[data.id].answers[questionId]; if (!Object.keys(next[data.id].answers).length) delete next[data.id]; }
      persistPending(next);
    } catch (e) {
      if (e.code === ERROR_CODES.NETWORK) {
        const next = { ...pending, [data.id]: { answers: { ...(pending[data.id]?.answers || {}), [questionId]: answer } } };
        persistPending(next);
      } else toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [data, pending, elapsed]);

  // Flush queued answers when back online
  useEffect(() => {
    if (!online || !data || !pending[data.id]) return;
    const entries = Object.entries(pending[data.id].answers);
    (async () => {
      for (const [qid, ans] of entries) {
        try { await challengeApi.answer({ questionId: qid, answer: ans, timeSpentSec: times.current[qid] || 0 }); } catch { return; }
      }
      const next = { ...pending };
      delete next[data.id];
      persistPending(next);
      toast.success('Back online — your answers are saved.');
    })();
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (val) => setAnswers((a) => ({ ...a, [q.questionId]: val }));

  const goNext = async () => {
    const val = answers[q.questionId];
    if (val == null || val === '') return;
    await saveAnswer(q.questionId, val);
    if (index < data.questions.length - 1) setIndex(index + 1);
    else setReview(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await challengeApi.submit();
      track('challenge_completed', { score: result.score });
      refreshSummary();
      storage.remove('challengePending');
      navigate('/challenge/result', { replace: true, state: { result, fresh: true } });
    } catch (e) {
      toast.error(errorMessage(e));
      setSubmitting(false);
      setConfirm(false);
    }
  };

  if (error) return <div className="mx-auto max-w-2xl p-6"><ErrorState error={error} onRetry={load} /></div>;
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
    );
  }

  const answeredCount = data.questions.filter((x) => answers[x.questionId] != null && answers[x.questionId] !== '').length;
  const allAnswered = answeredCount === data.questions.length;
  const queued = Object.keys(pending[data.id]?.answers || {}).length;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-10 pt-4 sm:px-6">
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/home')} className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-500 hover:bg-white" aria-label="Close — your progress is saved"><X className="h-6 w-6" /></button>
        <div className="flex flex-1 items-center gap-1.5" aria-label={`${answeredCount} of ${data.questions.length} answered`}>
          {data.questions.map((x, i) => (
            <button key={x.questionId} type="button" onClick={() => { setReview(false); setIndex(i); }} aria-label={`Go to question ${i + 1}`}
              className={cn('h-2.5 flex-1 rounded-full transition', i === index && !review ? 'bg-brand-600' : answers[x.questionId] ? 'bg-brand-300' : 'bg-ink-200')}
            />
          ))}
        </div>
        <span className="flex items-center gap-1 rounded-full bg-flame-50 px-2.5 py-1 text-sm font-bold text-flame-600"><Flame className="h-4 w-4 fill-flame-400 text-flame-500" />Daily</span>
      </header>

      <div className="mt-2 flex h-6 items-center justify-end text-xs font-medium text-ink-400">
        {queued > 0 ? <span className="flex items-center gap-1 text-amber-600"><CloudOff className="h-3.5 w-3.5" />{queued} answer{queued > 1 ? 's' : ''} waiting to sync</span>
          : saving ? <span className="flex items-center gap-1"><Cloud className="h-3.5 w-3.5 animate-pulse" />Saving…</span>
            : answeredCount > 0 ? <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" />Progress saved</span> : null}
      </div>

      <div className="mt-2 flex-1">
        {review ? (
            <motion.div key="review" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="text-center sm:p-10">
                <div className="text-5xl" aria-hidden>🎯</div>
                <h1 className="mt-4 text-2xl font-bold">All {data.questions.length} answered!</h1>
                <p className="mt-2 text-ink-500">You can still go back and change an answer. Once you submit, you&apos;ll see your score, the solutions and your topic diagnosis.</p>
                <div className="mx-auto mt-6 grid max-w-sm grid-cols-5 gap-2">
                  {data.questions.map((x, i) => (
                    <button key={x.questionId} type="button" onClick={() => { setReview(false); setIndex(i); }} className="flex aspect-square items-center justify-center rounded-xl bg-brand-50 font-bold text-brand-700 hover:bg-brand-100">{i + 1}</button>
                  ))}
                </div>
                <Button size="xl" className="mt-8" leftIcon={Send} disabled={!allAnswered || !online || queued > 0} onClick={() => setConfirm(true)}>
                  {!online ? 'Reconnect to submit' : 'Submit challenge'}
                </Button>
              </Card>
            </motion.div>
          ) : (
            <motion.div key={q.questionId} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <Card className="sm:p-8">
                <QuestionView question={q} value={answers[q.questionId] || ''} onChange={choose} onSubmit={goNext} number={index + 1} total={data.questions.length} autoFocus />
              </Card>
            </motion.div>
          )}
      </div>

      {!review && (
        <div className="safe-bottom sticky bottom-0 mt-6 flex items-center justify-between gap-3 bg-gradient-to-t from-ink-50 via-ink-50 to-transparent pt-4">
          <Button variant="ghost" leftIcon={ArrowLeft} disabled={index === 0} onClick={() => setIndex(index - 1)}>Back</Button>
          <Button size="lg" rightIcon={ArrowRight} disabled={answers[q.questionId] == null || answers[q.questionId] === ''} loading={saving} onClick={goNext}>
            {index === data.questions.length - 1 ? 'Finish' : 'Save & next'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirm} onClose={() => setConfirm(false)} onConfirm={submit} loading={submitting}
        title="Submit today's challenge?" description="You can't change your answers after submitting." confirmLabel="Submit"
      />
    </div>
  );
}
