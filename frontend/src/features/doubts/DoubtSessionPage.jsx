import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Lightbulb, AlertTriangle, ListOrdered, PenLine, HelpCircle, ThumbsUp, ThumbsDown, Flag, CheckCircle2, Keyboard, Camera, Mic, Heart, BookOpen, Target, MessageCircleQuestion, NotebookPen, ShieldAlert,
} from 'lucide-react';
import { PageHeader, Card, Button, PageSkeleton, ErrorState, Alert, Modal, TextArea, Badge } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { NumericAnswer } from '@/components/question/QuestionView';
import { useQuery, invalidate } from '@/hooks/useQuery';
import { doubtApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { useCelebrationStore } from '@/store/celebrationStore';
import { useDocumentTitle, useOnline } from '@/hooks/useCommon';
import { formatDateTime } from '@/lib/date';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { refreshSummary } from '@/features/shared/useHome';
import { StagedProgress } from './DoubtsPage';
import { ComingSoon } from '@/components/feedback/ComingSoon';
import { DoubtChat } from './DoubtChat';

const reveal = (i, fresh) => (fresh ? { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.15 + i * 0.35, duration: 0.35 } } : {});

function Block({ icon: I, title, tone, children, i, fresh }) {
  const tones = {
    sky: 'border-sky-100 bg-sky-50/70 [&_.bi]:bg-sky-500',
    rose: 'border-rose-100 bg-rose-50/70 [&_.bi]:bg-rose-500',
    brand: 'border-brand-100 bg-white [&_.bi]:bg-brand-600',
    emerald: 'border-emerald-100 bg-emerald-50/70 [&_.bi]:bg-emerald-500',
    gold: 'border-gold-200 bg-gold-50 [&_.bi]:bg-gold-500',
  };
  return (
    <motion.section {...reveal(i, fresh)} className={cn('rounded-2xl border p-4 sm:p-5', tones[tone])}>
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-700">
        <span className="bi flex h-7 w-7 items-center justify-center rounded-lg text-white"><I className="h-4 w-4" /></span>{title}
      </h3>
      <div className="text-[15.5px] leading-relaxed text-ink-800">{children}</div>
    </motion.section>
  );
}

function FollowUp({ question, onAnswer, busy, disabled }) {
  const [value, setValue] = useState('');
  return (
    <div>
      <MathText as="p" text={question.text} className="text-lg font-semibold text-ink-900" />
      <div className="mt-4">
        {question.answer_type === 'MCQ' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {question.options.map((o) => (
              <button key={o.key} type="button" disabled={disabled} onClick={() => setValue(o.key)} aria-pressed={value === o.key}
                className={cn('flex items-center gap-3 rounded-xl border-2 bg-white px-3.5 py-3 text-left transition', value === o.key ? 'border-brand-500 bg-brand-50' : 'border-ink-100 hover:border-brand-200')}
              >
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold', value === o.key ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600')}>{o.key}</span>
                <MathText text={o.text} className="font-medium" />
              </button>
            ))}
          </div>
        ) : (
          <div className="max-w-xs"><NumericAnswer value={value} onChange={setValue} disabled={disabled} onSubmit={() => value && onAnswer(value)} /></div>
        )}
      </div>
      <Button className="mt-4" disabled={!value || disabled} loading={busy} onClick={() => onAnswer(value)}>Check my answer</Button>
    </div>
  );
}

function DoubtSessionPageFull() {
  const { doubtId } = useParams();
  const location = useLocation();
  const online = useOnline();
  const celebrate = useCelebrationStore((s) => s.celebrate);
  const { data: d, error, loading, refetch, mutate } = useQuery(`doubt:${doubtId}`, () => doubtApi.get(doubtId), { staleMs: 0 });
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const fresh = Boolean(location.state?.fresh);
  useDocumentTitle('Doubt');

  if (loading && !d) return <PageSkeleton rows={1} />;
  if (!d) return <ErrorState error={error} onRetry={refetch} />;

  const r = d.response || {};
  const inScope = d.scope === 'IN_SYLLABUS';
  const current = d.rounds.length ? d.rounds[d.rounds.length - 1].follow_up_question : r.follow_up_question;
  const lastFU = d.followUps[d.followUps.length - 1];

  const answer = async (value, understood = false) => {
    setBusy(true);
    setThinking(!understood);
    try {
      const res = await doubtApi.followUp(doubtId, understood ? { understood: true } : { answer: value });
      mutate(res);
      track('doubt_followup_answered', { correct: res.lastFollowUp?.correct });
      invalidate('doubts');
      if (res.status === 'UNDERSTOOD') {
        refreshSummary();
        celebrate({ title: 'Doubt solved!', xp: res.reward?.xp, coins: res.reward?.coins, emoji: '💡' });
      } else if (res.status === 'NEEDS_HELP') {
        refreshSummary();
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setThinking(false);
    }
  };

  const feedback = async (body) => {
    try {
      mutate(await doubtApi.feedback(doubtId, body));
      toast.success(body.report ? 'Thanks — our team will review this answer.' : 'Thanks for the feedback!');
      setReportOpen(false);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const InputIcon = d.inputType === 'IMAGE' ? Camera : d.inputType === 'VOICE' ? Mic : Keyboard;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ to: '/doubts', label: 'Doubts' }} title="Your doubt" subtitle={formatDateTime(d.createdAt)} action={inScope && d.topicName && <Badge tone="brand">{d.topicName}</Badge>} />

      <Card className="mb-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-400"><InputIcon className="h-4 w-4" /> You asked</p>
        {d.imageDataUrl && <img src={d.imageDataUrl} alt="Your question" className="mb-3 max-h-64 rounded-xl border border-ink-100" />}
        {(d.input.text || d.input.transcript || d.input.note) && <p className="whitespace-pre-wrap text-[15.5px] text-ink-800">{d.input.text || d.input.transcript || d.input.note}</p>}
        {d.input.ocrText && <p className="mt-2 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-600"><strong>We read:</strong> {d.input.ocrText}</p>}
      </Card>

      {d.scope === 'SAFETY' && (
        <Card className="border-rose-100 bg-gradient-to-br from-rose-50 to-white">
          <Heart className="h-8 w-8 text-rose-500" />
          <p className="mt-3 text-[16px] leading-relaxed text-ink-800">{r.message}</p>
        </Card>
      )}

      {(d.scope === 'OUT_OF_SCOPE' || d.scope === 'HIGHER_CLASS') && (
        <Card className="text-center sm:p-8">
          <div className="text-5xl" aria-hidden>{d.scope === 'HIGHER_CLASS' ? '🧗' : '🧮'}</div>
          <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-ink-700">{r.message}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {r.foundation && <Button leftIcon={BookOpen} to={`/learn/topic/${r.foundation.topicId}`}>Study {r.foundation.name}</Button>}
            <Button variant="outline" leftIcon={MessageCircleQuestion} to="/doubts">Ask a Maths question</Button>
          </div>
        </Card>
      )}

      {inScope && (
        <div className="space-y-4">
          <Block i={0} fresh={fresh} icon={Lightbulb} title="The concept" tone="sky"><MathText text={r.concept} /></Block>
          <Block i={1} fresh={fresh} icon={AlertTriangle} title="Where you may have gone wrong" tone="rose"><MathText text={r.mistake_identification} /></Block>
          <Block i={2} fresh={fresh} icon={ListOrdered} title="Step-by-step" tone="brand">
            <ol className="space-y-2.5">
              {r.step_by_step.map((s, i) => (
                <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span><MathText text={s} /></li>
              ))}
            </ol>
            {r.final_answer && <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Answer: <MathText text={`$${r.final_answer}$`} /></p>}
          </Block>
          {r.worked_example && <Block i={3} fresh={fresh} icon={PenLine} title="Example" tone="emerald"><MathText text={r.worked_example} /></Block>}

          {d.rounds.map((round, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Alert tone="warning" title={`Not quite — ${round.intro}`}>You answered {d.followUps[i]?.answer}. That's okay — let's look at it again.</Alert>
              <Card className="mt-3">
                <p className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-600">Simpler explanation</p>
                <ol className="space-y-2">{round.step_by_step.map((s, j) => <li key={j} className="flex gap-3 text-[15px]"><span className="font-bold text-brand-600">{j + 1}.</span><MathText text={s} /></li>)}</ol>
              </Card>
            </motion.div>
          ))}

          <motion.section {...reveal(4, fresh)} className="rounded-2xl border-2 border-gold-300 bg-gradient-to-br from-gold-50 to-white p-5 sm:p-6">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gold-700"><HelpCircle className="h-5 w-5" /> Your turn</h3>
            {d.status === 'AWAITING_FOLLOW_UP' && current && (
              thinking ? <StagedProgress stages={['Checking your answer…', 'Almost there…']} /> : (
                <>
                  <FollowUp key={d.rounds.length} question={current} onAnswer={(v) => answer(v)} busy={busy} disabled={!online} />
                  <button type="button" onClick={() => answer(null, true)} className="mt-4 text-sm font-semibold text-ink-500 hover:text-brand-600">I&apos;ve understood it — mark as done</button>
                </>
              )
            )}
            {d.status === 'UNDERSTOOD' && (
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white"><CheckCircle2 className="h-6 w-6" /></span>
                <div>
                  <p className="font-bold text-emerald-800">{lastFU?.understoodClick ? 'Marked as understood.' : 'Correct! You’ve got it. 🎉'}</p>
                  {lastFU?.explanation && <ol className="mt-2 space-y-1 text-sm text-ink-700">{lastFU.explanation.map((s, i) => <li key={i}><MathText text={s} /></li>)}</ol>}
                </div>
              </div>
            )}
            {d.status === 'NEEDS_HELP' && (
              <div>
                <p className="font-bold text-amber-800">This one is tricky — and that&apos;s completely okay.</p>
                <p className="mt-1 text-sm text-ink-700">We&apos;ve saved this concept to your Mistake Bank and flagged the topic so your next practice focuses on it. {lastFU?.expected != null && <>The answer was <MathText text={`$${lastFU.expected}$`} className="font-semibold" />.</>}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" leftIcon={NotebookPen} to="/mistakes?source=DOUBT">Open Mistake Bank</Button>
                  {d.topicId && <Button size="sm" variant="outline" leftIcon={BookOpen} to={`/learn/topic/${d.topicId}`}>Read the notes</Button>}
                  {d.topicId && <Button size="sm" variant="outline" leftIcon={Target} to={`/learn/topic/${d.topicId}`}>Practise this topic</Button>}
                </div>
              </div>
            )}
          </motion.section>
        </div>
      )}

      {d.scope !== 'SAFETY' && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-card">
          <span className="text-sm font-semibold text-ink-600">Was this helpful?</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant={d.rating === 'UP' ? 'success' : 'ghost'} leftIcon={ThumbsUp} onClick={() => feedback({ rating: 'UP' })} aria-label="Helpful">Yes</Button>
            <Button size="sm" variant={d.rating === 'DOWN' ? 'danger' : 'ghost'} leftIcon={ThumbsDown} onClick={() => feedback({ rating: 'DOWN' })} aria-label="Not helpful">No</Button>
            <Button size="sm" variant="ghost" leftIcon={d.reported ? ShieldAlert : Flag} disabled={d.reported} onClick={() => setReportOpen(true)}>{d.reported ? 'Reported' : 'Report'}</Button>
          </div>
        </div>
      )}

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report this answer" description="Tell us what looks wrong. A teacher will review it." footer={<><Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button><Button onClick={() => feedback({ report: true, reason: reportReason })}>Send report</Button></>}>
        <TextArea label="What's wrong?" value={reportReason} onChange={(e) => setReportReason(e.target.value)} maxLength={200} placeholder="e.g. Step 3 looks incorrect" />
      </Modal>
    </div>
  );
}

/** Shown until the backend exposes this feature (see docs/PENDING_BACKEND_APIS.md). */
export default function DoubtSessionPage() {
  if (doubtApi.available === false) {
    return (
      <ComingSoon
        title="Ask a doubt"
        subtitle="Your AI Maths tutor explains step by step — then checks that you’ve got it."
        emoji="💡"
        points={['Type your question with a maths keypad', 'Snap a photo of a printed or handwritten problem', 'Ask out loud with your voice', 'Step-by-step help with a quick check']}
        primary={{ to: '/practice', label: 'Practise instead' }}
        secondary={{ to: '/mistakes', label: 'Open Mistake Bank' }}
      />
    );
  }
  return doubtApi.chat ? <DoubtChat /> : <DoubtSessionPageFull />;
}
