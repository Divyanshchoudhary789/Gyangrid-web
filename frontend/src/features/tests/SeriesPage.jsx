import { Link, useParams } from 'react-router-dom';
import { Lock, CheckCircle2, PlayCircle, Clock, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { PageHeader, Card, Stat, PageSkeleton, ErrorState, Badge, ProgressBar } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { testApi } from '@/services/api/student';
import { useDocumentTitle } from '@/hooks/useCommon';
import { humanDuration } from '@/lib/date';
import { cn } from '@/lib/cn';

/** Series progress: completed, average, strongest and weakest chapter (F6-12). */
export default function SeriesPage() {
  const { seriesId } = useParams();
  const { data: s, error, loading, refetch } = useQuery(`tests:series:${seriesId}`, () => testApi.series(seriesId));
  useDocumentTitle(s?.title || 'Test series');
  if (loading && !s) return <PageSkeleton />;
  if (!s) return <ErrorState error={error} onRetry={refetch} />;
  const p = s.progress;

  return (
    <div>
      <PageHeader back={{ to: '/tests#series', label: 'All tests' }} eyebrow={s.unlockMode === 'SEQUENTIAL' ? 'Unlocks one by one' : 'Open series'} title={s.title} subtitle={s.description} />
      <Card className="mb-6">
        <div className="mb-2 flex justify-between text-sm font-semibold"><span>Series progress</span><span>{p.completed}/{p.total} tests</span></div>
        <ProgressBar value={p.completed} max={p.total} tone="success" size="lg" />
      </Card>
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={Award} label="Average score" value={p.averageScorePct != null ? `${p.averageScorePct}%` : '—'} />
        <Stat icon={TrendingUp} tone="success" label="Strongest chapter" value={p.strongestChapter?.name || '—'} hint={p.strongestChapter ? `${p.strongestChapter.acc}% accuracy` : 'Take a test first'} />
        <Stat icon={TrendingDown} tone="danger" label="Needs focus" value={p.weakestChapter?.name || '—'} hint={p.weakestChapter ? `${p.weakestChapter.acc}% accuracy` : 'Take 2+ tests'} />
      </div>

      <ol className="relative space-y-4 before:absolute before:bottom-6 before:left-[23px] before:top-6 before:w-0.5 before:bg-ink-200">
        {s.tests.map((t) => {
          const locked = t.status === 'LOCKED';
          const done = t.status === 'COMPLETED';
          const Icon = locked ? Lock : done ? CheckCircle2 : PlayCircle;
          const body = (
            <div className={cn('card flex flex-1 flex-col gap-2 p-4 sm:flex-row sm:items-center sm:p-5', locked ? 'opacity-60' : 'card-hover')}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Test {t.order}</p>
                <p className="font-bold text-ink-900">{t.title}</p>
                <p className="mt-1 flex flex-wrap gap-3 text-xs text-ink-500"><span>{t.questionCount} questions</span><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{humanDuration(t.durationSec)}</span><span>{t.totalMarks} marks</span></p>
              </div>
              {done ? <Badge tone="success">{t.firstAttempt.scorePct}%</Badge> : locked ? <Badge>Locked</Badge> : t.status === 'IN_PROGRESS' ? <Badge tone="warning">Resume</Badge> : <Badge tone="brand">Start</Badge>}
            </div>
          );
          return (
            <li key={t.id} className="relative flex items-center gap-4">
              <span className={cn('relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-ink-50', done ? 'bg-emerald-500 text-white' : locked ? 'bg-ink-200 text-ink-500' : 'bg-brand-600 text-white')}><Icon className="h-5 w-5" /></span>
              {locked ? body : <Link to={done && !t.canReattempt ? `/tests/result/${t.firstAttempt.attemptId}` : `/tests/${t.id}`} className="flex flex-1">{body}</Link>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
