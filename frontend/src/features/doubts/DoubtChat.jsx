import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Lightbulb, ListOrdered, CheckCircle2, Flag, Send, Star, ThumbsUp, ThumbsDown, Sparkles, MessageCircleQuestion, ShieldCheck } from 'lucide-react';
import { PageHeader, Card, Button, PageSkeleton, ErrorState, Alert, Modal, TextArea, Badge, ChoiceCard } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { useQuery, invalidate } from '@/hooks/useQuery';
import { doubtApi } from '@/services/api/student';
import { ERROR_CODES, errorMessage } from '@/services/errors';
import { useCelebrationStore } from '@/store/celebrationStore';
import { useDocumentTitle, useOnline } from '@/hooks/useCommon';
import { formatDateTime } from '@/lib/date';
import { sanitizeText } from '@/lib/validators';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { refreshSummary } from '@/features/shared/useHome';
import { StagedProgress } from './DoubtsPage';

const REPORT_REASONS = [
  { value: 'INCORRECT_ANSWER', label: 'The answer looks wrong', emoji: '❌' },
  { value: 'UNCLEAR', label: 'The explanation is unclear', emoji: '🤔' },
  { value: 'NOT_IN_SYLLABUS', label: 'Not in my syllabus', emoji: '📚' },
  { value: 'OTHER', label: 'Something else', emoji: '💬' },
];

const STAGES = ['Reading your follow-up…', 'Finding a simpler way…', 'Writing it out…'];

// Messages a student can act on are shown as-is; anything else (e.g. an AI provider error) is replaced,
// so internal provider details never reach the screen.
const SHOW_AS_IS = [ERROR_CODES.FOLLOW_UP_LIMIT, ERROR_CODES.QUOTA_EXCEEDED, ERROR_CODES.RATE_LIMITED, ERROR_CODES.NETWORK, ERROR_CODES.TIMEOUT];
const followUpMessage = (e) => (SHOW_AS_IS.includes(e.code) ? errorMessage(e) : 'Your tutor couldn’t answer that follow-up just now. Try rephrasing it, or ask a new doubt.');

/** The structured answer returned right after asking; a reload falls back to the saved messages. */
function FreshAnswer({ answer }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {answer.conceptNote && (
        <section className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 sm:p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-sky-700"><Lightbulb className="h-4 w-4" />The concept</h3>
          <MathText as="p" text={answer.conceptNote} className="text-[15.5px] leading-relaxed text-ink-800" />
        </section>
      )}
      {answer.steps.length > 0 && (
        <section className="rounded-2xl border border-brand-100 bg-white p-4 sm:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-700"><ListOrdered className="h-4 w-4" />Step by step</h3>
          <ol className="space-y-3">
            {answer.steps.map((step, i) => (
              <motion.li key={step} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.25 }} className="flex gap-3 text-[15.5px] leading-relaxed text-ink-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                <MathText text={step} className="min-w-0" />
              </motion.li>
            ))}
          </ol>
        </section>
      )}
      {answer.finalAnswer && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-emerald-100 px-4 py-3 font-semibold text-emerald-900">
          <CheckCircle2 className="h-5 w-5 shrink-0" />Answer: <MathText text={answer.finalAnswer} />
        </p>
      )}
    </motion.div>
  );
}

function Bubble({ message }) {
  const mine = message.role === 'student';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-2.5', mine && 'justify-end')}>
      {!mine && <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Sparkles className="h-4 w-4" aria-hidden /></span>}
      <div className={cn('min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-[15.5px] leading-relaxed sm:max-w-[75%]', mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-ink-100 bg-white text-ink-800 shadow-sm')}>
        {message.imageUrl && <img src={message.imageUrl} alt="Your question" loading="lazy" className="mb-2 max-h-64 rounded-xl" />}
        <MathText as="p" text={message.text} className="whitespace-pre-wrap break-words" />
      </div>
    </motion.div>
  );
}

function FeedbackCard({ doubt, onSaved }) {
  const celebrate = useCelebrationStore((s) => s.celebrate);
  const [understood, setUnderstood] = useState(null);
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);

  if (doubt.feedback) {
    return <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Thanks for your feedback!</p>;
  }

  const submit = async () => {
    setBusy(true);
    try {
      const res = await doubtApi.feedback(doubt.id, { understood, rating });
      track('doubt_feedback', { understood, rating });
      refreshSummary();
      const { xp = 0, coins = 0 } = res.awarded || {};
      if (understood && (xp || coins)) celebrate({ title: 'Doubt solved!', xp, coins, emoji: '💡' });
      else toast.success('Thanks for your feedback!');
      onSaved(res.saved);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <p className="font-bold text-ink-900">Did this clear your doubt?</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant={understood === true ? 'success' : 'outline'} leftIcon={ThumbsUp} onClick={() => setUnderstood(true)} aria-pressed={understood === true}>Yes, got it</Button>
        <Button variant={understood === false ? 'secondary' : 'outline'} leftIcon={ThumbsDown} onClick={() => setUnderstood(false)} aria-pressed={understood === false}>Not yet</Button>
      </div>
      {understood !== null && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1" role="group" aria-label="Rate this answer">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={rating === n} className="rounded-lg p-1.5 transition hover:scale-110">
                <Star className={cn('h-6 w-6', n <= rating ? 'fill-gold-400 text-gold-500' : 'text-ink-300')} />
              </button>
            ))}
          </div>
          <Button size="sm" loading={busy} onClick={submit}>Send</Button>
        </motion.div>
      )}
    </Card>
  );
}

function ReportDialog({ doubtId, open, onClose, onReported }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const res = await doubtApi.report(doubtId, { reason, note });
      toast.success(res.duplicate ? 'You already reported this — it is under review.' : 'Thanks — our team will review this answer.');
      onReported();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Report this answer" description="Tell us what looks wrong. A teacher will review it."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!reason} loading={busy} onClick={submit}>Send report</Button></>}
    >
      <div className="grid gap-2">
        {REPORT_REASONS.map((r) => (
          <ChoiceCard key={r.value} selected={reason === r.value} onClick={() => setReason(r.value)} className="py-3">
            <span className="flex items-center gap-3 font-semibold text-ink-800"><span className="text-xl" aria-hidden>{r.emoji}</span>{r.label}</span>
          </ChoiceCard>
        ))}
      </div>
      <TextArea className="mt-4" label="Anything else? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Please don't include personal details." />
    </Modal>
  );
}

/** Conversation view for a doubt: the student's question, the tutor's answer and up to two follow-ups. */
export function DoubtChat() {
  const { doubtId } = useParams();
  const location = useLocation();
  const online = useOnline();
  const { data: d, error, loading, refetch, mutate } = useQuery(`doubt:${doubtId}`, () => doubtApi.get(doubtId), { staleMs: 0 });
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const endRef = useRef(null);
  const fresh = location.state?.answer || null;
  useDocumentTitle('Your doubt');

  const count = d?.messages.length;
  useEffect(() => {
    if (count > 2) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [count, thinking]);

  if (loading && !d) return <PageSkeleton rows={1} />;
  if (!d) return <ErrorState error={error} onRetry={refetch} />;

  const clean = sanitizeText(text);
  const send = async () => {
    setThinking(true);
    setSendError(null);
    try {
      mutate(await doubtApi.followUp(doubtId, clean));
      setText('');
      invalidate('doubts');
      track('doubt_followup_sent');
    } catch (e) {
      setSendError(e);
      if (e.code === ERROR_CODES.FOLLOW_UP_LIMIT) refetch();
    } finally {
      setThinking(false);
    }
  };

  // With the structured answer in hand, it replaces the first tutor message.
  const firstTutor = d.messages.findIndex((m) => m.role === 'tutor');
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ to: '/doubts', label: 'Doubts' }} title="Your doubt" subtitle={d.createdAt ? formatDateTime(d.createdAt) : undefined} action={<Badge tone="brand" icon={MessageCircleQuestion}>{d.followUpsLeft} follow-up{d.followUpsLeft === 1 ? '' : 's'} left</Badge>} />

      <div className="space-y-4" aria-live="polite">
        {d.messages.map((m, i) => (fresh && i === firstTutor
          ? <FreshAnswer key={m.id} answer={fresh} />
          : <Bubble key={m.id} message={m} />))}
        {thinking && <Card><StagedProgress stages={STAGES} /></Card>}
        <div ref={endRef} />
      </div>

      {sendError && <Alert tone={sendError.code === ERROR_CODES.FOLLOW_UP_LIMIT ? 'info' : 'danger'} className="mt-4">{followUpMessage(sendError)}</Alert>}

      {!thinking && (
        d.followUpsLeft > 0 ? (
          <Card className="mt-5">
            <TextArea label="Still confused? Ask a follow-up" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={2} placeholder="e.g. Can you explain that with a simpler example?" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-xs text-ink-500"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />Maths only. Don&apos;t share personal details.</p>
              <Button rightIcon={Send} disabled={clean.length < 3 || !online} onClick={send}>Ask</Button>
            </div>
          </Card>
        ) : (
          <Alert tone="info" className="mt-5" action={<Button size="sm" variant="outline" to="/doubts">New doubt</Button>}>You&apos;ve used both follow-ups on this doubt. Ask a new one any time.</Alert>
        )
      )}

      <div className="mt-5 space-y-3">
        <FeedbackCard doubt={d} onSaved={(saved) => mutate({ ...d, feedback: saved })} />
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" leftIcon={Flag} disabled={reported} onClick={() => setReportOpen(true)}>{reported ? 'Reported' : 'Report this answer'}</Button>
        </div>
      </div>
      <ReportDialog doubtId={doubtId} open={reportOpen} onClose={() => setReportOpen(false)} onReported={() => setReported(true)} />
    </div>
  );
}
