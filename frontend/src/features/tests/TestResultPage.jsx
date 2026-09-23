import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Award, Clock, Target, Trophy, Sparkles, NotebookPen, ChevronDown, CheckCircle2, XCircle, MinusCircle, AlarmClock, ArrowRight, Users } from 'lucide-react';
import { PageHeader, Card, Button, Tabs, ProgressRing, PageSkeleton, ErrorState, Alert, Stat, ProgressBar, EmptyState } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { SolutionPanel, ReportQuestionButton } from '@/components/question/QuestionView';
import { useQuery } from '@/hooks/useQuery';
import { testApi, practiceApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { useCelebrationStore } from '@/store/celebrationStore';
import { useDocumentTitle } from '@/hooks/useCommon';
import { humanDuration } from '@/lib/date';
import { cn } from '@/lib/cn';

export default function TestResultPage() {
  const { attemptId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const celebrate = useCelebrationStore((s) => s.celebrate);
  const { data: r, error, loading, refetch } = useQuery(`testResult:${attemptId}`, () => testApi.result(attemptId));
  const [filter, setFilter] = useState('ALL');
  const [open, setOpen] = useState(null);
  const once = useRef(false);
  useDocumentTitle(r ? `Result: ${r.title}` : 'Test result');

  useEffect(() => {
    if (r && location.state?.fresh && !once.current) {
      once.current = true;
      if (r.xpAwarded) celebrate({ title: 'Test complete!', xp: r.xpAwarded, emoji: r.scorePct >= 60 ? '🏆' : '📘', confetti: r.scorePct >= 60 });
    }
  }, [r, location.state, celebrate]);

  const questions = useMemo(() => {
    if (!r) return [];
    if (filter === 'INCORRECT') return r.questions.filter((q) => !q.correct && !q.skipped);
    if (filter === 'SKIPPED') return r.questions.filter((q) => q.skipped);
    return r.questions;
  }, [r, filter]);

  if (loading && !r) return <PageSkeleton />;
  if (!r) return <ErrorState error={error} onRetry={refetch} />;

  const tone = r.scorePct >= 80 ? '#10b981' : r.scorePct >= 60 ? '#6d5dfc' : r.scorePct >= 40 ? '#f59e0b' : '#f43f5e';
  const practise = async () => {
    try {
      const set = await practiceApi.start({ scope: 'TOPIC', targetId: r.weakestTopicId, size: 10, difficulty: 'MIXED' });
      navigate(`/practice/session/${set.id}`);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="space-y-6">
      <PageHeader back={r.seriesId ? { to: `/tests/series/${r.seriesId}`, label: 'Series' } : { to: '/tests', label: 'All tests' }} eyebrow="Test result" title={r.title} />

      {r.autoSubmitted && <Alert tone="warning" title="Auto-submitted" icon={AlarmClock}>Time ran out, so your saved answers were submitted automatically and graded normally.</Alert>}

      <Card className="flex flex-col items-center gap-6 sm:flex-row sm:p-8">
        <ProgressRing value={r.scorePct} size={140} stroke={12} tone={tone}>
          <div className="text-center"><p className="font-display text-3xl font-extrabold">{r.marks}</p><p className="text-xs font-semibold text-ink-500">of {r.totalMarks} marks</p></div>
        </ProgressRing>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-2xl font-bold">{r.scorePct >= 80 ? 'Outstanding!' : r.scorePct >= 60 ? 'Well done!' : r.scorePct >= 40 ? 'Good try!' : "Let's build on this"}</h2>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className="chip bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{r.correct} correct</span>
            <span className="chip bg-rose-100 text-rose-700"><XCircle className="h-3.5 w-3.5" />{r.incorrect} wrong</span>
            <span className="chip bg-ink-100 text-ink-700"><MinusCircle className="h-3.5 w-3.5" />{r.skipped} skipped</span>
            {r.xpAwarded > 0 && <span className="chip bg-brand-100 text-brand-700">+{r.xpAwarded} XP</span>}
          </div>
          {r.negativeMarks > 0 && <p className="mt-3 text-xs text-ink-500">Marks = ({r.correct} × {r.marksPerQ}) − ({r.incorrect} × {r.negativeMarks}){r.marks === 0 ? ', floored at 0' : ''}</p>}
          {!r.isFirstAttempt && <p className="mt-2 text-xs text-ink-500">Re-attempt: your first attempt is the one that counts for rankings.</p>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Target} label="Accuracy" value={`${r.accuracy}%`} hint="of answered questions" />
        <Stat icon={Clock} tone="info" label="Time taken" value={humanDuration(r.timeTakenSec)} hint={`of ${humanDuration(r.durationSec)}`} />
        <Stat icon={Trophy} tone="gold" label="Rank" value={r.rank ? `#${r.rank.rank}` : '—'} hint={r.rank ? `of ${r.rank.of} students` : 'Not enough attempts yet'} />
        <Stat icon={Users} tone="success" label="Percentile" value={r.rank ? `${r.rank.percentile}` : '—'} hint={r.rank ? 'better than this % of class' : 'Needs 10+ attempts'} />
      </div>

      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 to-white">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-600"><Sparkles className="h-4 w-4" /> AI summary</p>
        <ul className="mt-3 space-y-1.5 text-[15px] text-ink-800">{r.aiSummary.lines.map((l) => <li key={l}>• {l}</li>)}</ul>
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <p className="flex-1 text-sm"><strong>Next step:</strong> {r.aiSummary.nextStep}</p>
          {r.weakestTopicId && <Button size="sm" rightIcon={ArrowRight} onClick={practise}>Start practice</Button>}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="section-title mb-4">Chapter-wise</h2>
          <div className="space-y-4">
            {r.byChapter.map((c) => (
              <div key={c.chapterId}>
                <div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate font-semibold text-ink-800">{c.name}</span><span className="shrink-0 font-bold">{c.correct}/{c.total} · {c.accuracy}%</span></div>
                <ProgressBar value={c.accuracy} tone={c.accuracy >= 75 ? 'success' : c.accuracy >= 50 ? 'warning' : 'danger'} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="section-title mb-4">Topic-wise</h2>
          <ul className="divide-y divide-ink-100">
            {r.byTopic.map((t) => (
              <li key={t.topicId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="truncate text-ink-700">{t.name}</span>
                <span className={cn('chip shrink-0', t.accuracy >= 75 ? 'bg-emerald-100 text-emerald-700' : t.accuracy >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}>{t.correct}/{t.total}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {r.mistakesSaved > 0 && (
        <Alert tone="info" title={`${r.mistakesSaved} wrong answer${r.mistakesSaved > 1 ? 's' : ''} saved to your Mistake Bank`} action={<Button size="sm" variant="outline" leftIcon={NotebookPen} to="/mistakes?source=TEST">Review</Button>}>They will resurface in 3 days until you fix them.</Alert>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="section-title">Solutions</h2>
          <Tabs size="sm" value={filter} onChange={setFilter} tabs={[
            { value: 'ALL', label: 'All', count: r.questions.length },
            { value: 'INCORRECT', label: 'Incorrect', count: r.incorrect },
            { value: 'SKIPPED', label: 'Skipped', count: r.skipped },
          ]} />
        </div>
        {questions.length === 0 ? <EmptyState emoji="✨" title="Nothing here" description="No questions in this filter." /> : (
          <div className="space-y-2">
            {questions.map((q) => {
              const i = r.questions.indexOf(q);
              return (
                <div key={q.questionId} className="overflow-hidden rounded-2xl border border-ink-100">
                  <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-50" aria-expanded={open === i}>
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white', q.correct ? 'bg-emerald-500' : q.skipped ? 'bg-ink-300' : 'bg-rose-500')}>{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-800"><MathText text={q.questionText} /></span>
                    <ChevronDown className={cn('h-5 w-5 shrink-0 text-ink-400 transition', open === i && 'rotate-180')} />
                  </button>
                  {open === i && (
                    <div className="border-t border-ink-100 p-4">
                      <SolutionPanel result={q} compact />
                      <div className="mt-3 flex justify-end"><ReportQuestionButton questionId={q.questionId} /></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" to="/tests" leftIcon={Award}>More tests</Button>
        <Button to="/home">Back to Home</Button>
      </div>
    </div>
  );
}
