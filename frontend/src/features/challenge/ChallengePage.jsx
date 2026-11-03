import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { X, ArrowLeft, ArrowRight, Flame, Send, CloudOff, Check, Cloud, Trophy, WifiOff } from 'lucide-react';
import { Button, Card, Skeleton, ErrorState, ConfirmDialog, EmptyState } from '@/components/ui';
import { QuestionView, SolutionPanel } from '@/components/question/QuestionView';
import { challengeApi } from '@/services/api/student';
import { errorMessage, ERROR_CODES } from '@/services/errors';
import { useDocumentTitle, useElapsed, useOnline } from '@/hooks/useCommon';
import { storage } from '@/lib/storage';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { refreshSummary } from '@/features/shared/useHome';

/**
 * Daily Challenge.
 * The challenge is generated and pinned on the server (F5-04); this page only renders it.
 * Two server behaviours are supported:
 *  - graded: each answer is graded immediately and can't be changed (current backend) → feedback per question;
 *  - deferred: answers are saved and graded on submit (PRD contract / local mock) → review then submit.
 */
export default function ChallengePage() {
  useDocumentTitle("Today's Challenge");
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const c = await challengeApi.today();
      if (c.status === 'SUBMITTED') { navigate('/challenge/result', { replace: true }); return; }
      if (!c.questions?.length) { setData({ ...c, empty: true }); return; }
      setData(c);
      if (c.status === 'NOT_STARTED') track('challenge_started');
    } catch (e) {
      setError(e);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  if (error) return <div className="mx-auto max-w-2xl p-6"><ErrorState error={error} onRetry={load} /></div>;
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
    );
  }
  if (data.empty) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <EmptyState emoji="🧮" title="Today's challenge is being prepared" description="Questions for your class are still being added. Practise any topic in the meantime." action={<Button to="/practice">Go to Practice</Button>} />
      </div>
    );
  }
  return data.graded ? <GradedChallenge data={data} /> : <DeferredChallenge data={data} />;
}

function ChallengeHeader({ total, index, isAnswered, onJump, onClose }) {
  return (
    <header className="flex items-center gap-3">
      <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-500 hover:bg-white" aria-label="Close — your progress is saved"><X className="h-6 w-6" /></button>
      <div className="flex flex-1 items-center gap-1.5" role="list" aria-label="Challenge progress">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i} type="button" role="listitem" onClick={() => onJump?.(i)} disabled={!onJump} aria-label={`Question ${i + 1}${isAnswered(i) ? ', answered' : ''}`}
            className={cn('h-2.5 flex-1 rounded-full transition disabled:cursor-default', i === index ? 'bg-brand-600' : isAnswered(i) ? 'bg-brand-300' : 'bg-ink-200')}
          />
        ))}
      </div>
      <span className="flex items-center gap-1 rounded-full bg-flame-50 px-2.5 py-1 text-sm font-bold text-flame-600"><Flame className="h-4 w-4 fill-flame-400 text-flame-500" />Daily</span>
    </header>
  );
}

/* ------------------------------------------------------------------ graded (real backend) */
function GradedChallenge({ data }) {
  const navigate = useNavigate();
  const online = useOnline();
  const total = data.questions.length;
  const [index, setIndex] = useState(data.currentIndex);
  const [reveals, setReveals] = useState(data.reveals || {});
  // Questions answered earlier (possibly on another device) — the server answers them in order.
  const [answeredUpTo, setAnsweredUpTo] = useState(data.answeredCount || 0);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const allDone = answeredUpTo >= total;
  const [showSummary, setShowSummary] = useState(allDone);
  const q = data.questions[index];
  const elapsed = useElapsed(q?.questionId);
  const reveal = q ? reveals[q.questionId] : null;
  const isAnswered = (i) => i < answeredUpTo || Boolean(reveals[data.questions[i].questionId]);
  const answeredHere = isAnswered(index);

  const check = async () => {
    if (!value || busy) return;
    setBusy(true);
    try {
      const r = await challengeApi.answer({ questionId: q.questionId, answer: value, timeSpentSec: elapsed() });
      if (r.reveal) setReveals((m) => ({ ...m, [q.questionId]: r.reveal }));
      setAnsweredUpTo((n) => Math.max(n, index + 1, r.answered || 0));
      if (r.alreadyAnswered && !r.reveal) {
        toast.info('You already answered this one — moving on.');
        goNext();
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const goNext = () => {
    setValue('');
    if (index < total - 1) setIndex(index + 1);
    else setShowSummary(true);
  };

  const finish = async () => {
    setFinishing(true);
    try {
      const result = await challengeApi.submit();
      track('challenge_completed', { score: result.score });
      refreshSummary();
      navigate('/challenge/result', { replace: true, state: { result, fresh: true } });
    } catch (e) {
      toast.error(errorMessage(e));
      setFinishing(false);
    }
  };

  const correctSoFar = Object.values(reveals).filter((r) => r.correct).length;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-10 pt-4 sm:px-6">
      <ChallengeHeader total={total} index={showSummary ? -1 : index} isAnswered={isAnswered} onJump={(i) => { if (isAnswered(i) || i === answeredUpTo) { setShowSummary(false); setIndex(i); setValue(''); } }} onClose={() => navigate('/home')} />
      <div className="mt-2 flex h-6 items-center justify-end text-xs font-medium text-ink-400">
        {!online ? <span className="flex items-center gap-1 text-amber-600"><WifiOff className="h-3.5 w-3.5" />Offline — reconnect to continue</span>
          : answeredUpTo > 0 ? <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" />{answeredUpTo} of {total} answered · saved</span> : null}
      </div>

      <div className="mt-2 flex-1">
        {showSummary ? (
          <motion.div key="summary" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="text-center sm:p-10">
              <div className="text-5xl" aria-hidden>🎯</div>
              <h1 className="mt-4 text-2xl font-bold">{allDone ? `All ${total} answered!` : `${answeredUpTo} of ${total} answered`}</h1>
              <p className="mt-2 text-ink-500">
                {allDone ? 'Finish the challenge to lock in your streak and collect your rewards.' : 'Answer the remaining questions to finish today’s challenge.'}
              </p>
              {Object.keys(reveals).length > 0 && <p className="mt-3 text-sm font-semibold text-emerald-700">{correctSoFar} correct so far</p>}
              <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
                {!allDone && <Button size="lg" variant="outline" onClick={() => { setShowSummary(false); setIndex(Math.min(answeredUpTo, total - 1)); }}>Continue answering</Button>}
                <Button size="xl" leftIcon={Trophy} disabled={!allDone || !online} loading={finishing} onClick={finish}>{online ? 'Finish challenge' : 'Reconnect to finish'}</Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div key={q.questionId} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
            <Card className="sm:p-8">
              <QuestionView
                question={q}
                value={reveal ? reveal.yourAnswer : value}
                onChange={setValue}
                reveal={reveal}
                disabled={answeredHere && !reveal}
                onSubmit={check}
                number={index + 1}
                total={total}
                autoFocus
              />
              {reveal && <SolutionPanel result={reveal} />}
              {answeredHere && !reveal && <p className="mt-5 rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">You answered this question earlier. Its solution is saved in your Mistake Bank if you got it wrong.</p>}
            </Card>
          </motion.div>
        )}
      </div>

      {!showSummary && (
        <div className="safe-bottom sticky bottom-0 mt-6 flex items-center justify-between gap-3 bg-gradient-to-t from-ink-50 via-ink-50 to-transparent pt-4">
          <Button variant="ghost" leftIcon={ArrowLeft} disabled={index === 0} onClick={() => { setIndex(index - 1); setValue(''); }}>Back</Button>
          {answeredHere ? (
            <Button size="lg" rightIcon={index === total - 1 ? Trophy : ArrowRight} onClick={goNext}>{index === total - 1 ? 'See summary' : 'Next question'}</Button>
          ) : (
            <Button size="lg" disabled={!value || !online} loading={busy} onClick={check}>{online ? 'Check answer' : 'Offline'}</Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ deferred (PRD contract / mock) */
function DeferredChallenge({ data }) {
  const navigate = useNavigate();
  const online = useOnline();
  const [index, setIndex] = useState(data.currentIndex);
  const [answers, setAnswers] = useState(() => ({ ...data.answers, ...(storage.get('challengePending', {})[data.id]?.answers || {}) }));
  const [pending, setPending] = useState(() => storage.get('challengePending', {}));
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [review, setReview] = useState(false);
  const times = useRef({});
  const q = data.questions[index];
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
        persistPending({ ...pending, [data.id]: { answers: { ...(pending[data.id]?.answers || {}), [questionId]: answer } } });
      } else toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [data, pending, elapsed]);

  // Flush queued answers when back online (NFR-03)
  useEffect(() => {
    if (!online || !pending[data.id]) return;
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

  const answeredCount = data.questions.filter((x) => answers[x.questionId] != null && answers[x.questionId] !== '').length;
  const allAnswered = answeredCount === data.questions.length;
  const queued = Object.keys(pending[data.id]?.answers || {}).length;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-10 pt-4 sm:px-6">
      <ChallengeHeader total={data.questions.length} index={review ? -1 : index} isAnswered={(i) => Boolean(answers[data.questions[i].questionId])} onJump={(i) => { setReview(false); setIndex(i); }} onClose={() => navigate('/home')} />
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
              <QuestionView question={q} value={answers[q.questionId] || ''} onChange={(v) => setAnswers((a) => ({ ...a, [q.questionId]: v }))} onSubmit={goNext} number={index + 1} total={data.questions.length} autoFocus />
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
