import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight, Check, MessageCircleQuestion, Zap, Trophy, RotateCcw, NotebookPen, Home } from 'lucide-react';
import { Button, Card, ProgressBar, PageSkeleton, ErrorState, Badge } from '@/components/ui';
import { QuestionView, SolutionPanel, ReportQuestionButton } from '@/components/question/QuestionView';
import { DiagnosisList } from '@/features/challenge/Diagnosis';
import { useQuery } from '@/hooks/useQuery';
import { practiceApi, doubtApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle, useElapsed, useOnline } from '@/hooks/useCommon';
import { useCelebrationStore } from '@/store/celebrationStore';
import { refreshSummary } from '@/features/shared/useHome';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';

export default function PracticeSessionPage() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const online = useOnline();
  const celebrate = useCelebrationStore((s) => s.celebrate);
  const { data, error, loading, refetch, mutate } = useQuery(`practice:${setId}`, () => practiceApi.get(setId), { staleMs: 0 });
  const [index, setIndex] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const [xpTotal, setXpTotal] = useState(0);
  useDocumentTitle(data?.title ? `Practice: ${data.title}` : 'Practice');

  // Resume at the first unanswered question
  useEffect(() => {
    if (data && index == null) {
      const first = data.questions.findIndex((q) => q.correct === undefined);
      setIndex(first === -1 ? data.questions.length - 1 : first);
      if (data.summary) setSummary(data.summary);
    }
  }, [data, index]);

  const q = data && index != null ? data.questions[index] : null;
  const elapsed = useElapsed(q?.questionId);
  const revealed = q && q.correct !== undefined ? q : null;

  const submit = useCallback(async () => {
    if (!q || !answer || busy) return;
    setBusy(true);
    try {
      const res = await practiceApi.submitAnswer({ setId, questionId: q.questionId, answer, timeSpentSec: elapsed() });
      mutate((prev) => ({ ...prev, questions: prev.questions.map((x) => (x.questionId === q.questionId ? { ...res } : x)) }));
      if (res.xpAwarded) setXpTotal((x) => x + res.xpAwarded);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [q, answer, busy, setId, elapsed, mutate]);

  const finish = async () => {
    setBusy(true);
    try {
      const s = await practiceApi.finish(setId);
      setSummary(s);
      track('practice_completed', { correct: s.correct, total: s.answered });
      refreshSummary();
      if (s.xpAwarded > 0) celebrate({ title: 'Practice set complete!', xp: s.xpAwarded, emoji: '💪', confetti: s.accuracy >= 60 });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    setAnswer('');
    if (index < data.questions.length - 1) setIndex(index + 1);
    else finish();
  };

  if (loading && !data) return <PageSkeleton rows={1} />;
  if (!data) return <ErrorState error={error} onRetry={refetch} />;

  const answered = data.questions.filter((x) => x.correct !== undefined).length;
  const correct = data.questions.filter((x) => x.correct).length;

  if (summary) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="text-center sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-gold-300 to-gold-500 text-4xl shadow-lg">{summary.accuracy >= 80 ? '🏆' : summary.accuracy >= 50 ? '💪' : '🌱'}</div>
          <h1 className="mt-5 text-3xl font-bold">{summary.accuracy >= 80 ? 'Superb practice!' : summary.accuracy >= 50 ? 'Nice work!' : 'Every try makes you stronger'}</h1>
          <p className="mt-2 text-ink-500">{data.title}</p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-ink-50 p-4"><p className="font-display text-2xl font-bold">{summary.correct}/{summary.answered}</p><p className="text-xs text-ink-500">correct</p></div>
            <div className="rounded-2xl bg-brand-50 p-4"><p className="font-display text-2xl font-bold text-brand-700">+{summary.xpAwarded}</p><p className="text-xs text-ink-500">XP</p></div>
            <div className="rounded-2xl bg-rose-50 p-4"><p className="font-display text-2xl font-bold text-rose-600">{summary.mistakesSaved}</p><p className="text-xs text-ink-500">to review</p></div>
          </div>
          {summary.diagnosis?.length > 0 && <div className="mt-6 text-left"><DiagnosisList items={summary.diagnosis} /></div>}
          <div className="mt-8 grid gap-2 sm:grid-cols-3">
            <Button variant="outline" leftIcon={Home} to="/home">Home</Button>
            {summary.mistakesSaved > 0 && <Button variant="secondary" leftIcon={NotebookPen} to="/mistakes?status=ACTIVE">Review mistakes</Button>}
            <Button leftIcon={RotateCcw} to="/practice">Practise more</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!q) return <PageSkeleton rows={1} />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Practice</p>
          <h1 className="truncate text-xl font-bold sm:text-2xl">{data.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone="success" icon={Check}>{correct}</Badge>
          {xpTotal > 0 && <Badge tone="brand" icon={Zap}>+{xpTotal} XP</Badge>}
        </div>
      </div>
      <div className="mb-2 flex justify-between text-xs font-semibold text-ink-500"><span>Question {index + 1} of {data.questions.length}</span><span>{answered} answered</span></div>
      <ProgressBar value={answered} max={data.questions.length} className="mb-6" label="Practice progress" />

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="Question navigator">
        {data.questions.map((x, i) => (
          <button key={x.questionId} type="button" onClick={() => { setIndex(i); setAnswer(''); }} aria-label={`Question ${i + 1}`} aria-current={i === index}
            className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition',
              i === index && 'ring-2 ring-brand-500 ring-offset-2',
              x.correct === true ? 'bg-emerald-500 text-white' : x.correct === false ? 'bg-rose-400 text-white' : 'bg-white text-ink-600 shadow-sm')}
          >{i + 1}</button>
        ))}
      </div>

      <motion.div key={q.questionId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          <Card className="sm:p-8">
            <QuestionView question={q} value={revealed ? revealed.yourAnswer : answer} onChange={setAnswer} reveal={revealed} onSubmit={submit} number={index + 1} total={data.questions.length} autoFocus />
            {revealed && <SolutionPanel result={revealed} />}
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-ink-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1">
                {doubtApi.available !== false && <Button variant="ghost" size="sm" leftIcon={MessageCircleQuestion} onClick={() => navigate(`/doubts?mode=text&q=${encodeURIComponent(q.questionText)}`)}>Ask a doubt about this</Button>}
                <ReportQuestionButton questionId={q.questionId} />
              </div>
              {revealed ? (
                <Button size="lg" rightIcon={index < data.questions.length - 1 ? ArrowRight : Trophy} onClick={next} loading={busy}>
                  {index < data.questions.length - 1 ? 'Next question' : 'See results'}
                </Button>
              ) : (
                <Button size="lg" onClick={submit} disabled={!answer || !online} loading={busy}>{online ? 'Check answer' : 'Offline'}</Button>
              )}
            </div>
          </Card>
        </motion.div>
      {answered > 0 && answered < data.questions.length && (
        <p className="mt-4 text-center text-sm text-ink-500">Need to stop? <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={finish}>Finish now</button> and keep your XP.</p>
      )}
    </div>
  );
}
