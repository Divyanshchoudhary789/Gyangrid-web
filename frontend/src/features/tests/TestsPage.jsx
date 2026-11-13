import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Layers, ChevronRight, BookOpen, GraduationCap } from 'lucide-react';
import { PageHeader, Tabs, PageSkeleton, ErrorState, EmptyState, ProgressBar } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { testApi } from '@/services/api/student';
import { useDocumentTitle } from '@/hooks/useCommon';
import { TestCard } from './TestCard';

const SERIES_PATH = '/tests/series';

/**
 * Tests and test series share one page. The series tab has its own URL (/tests/series) so the sidebar can
 * link to it and the browser back button works; chapter vs full syllabus is local state on /tests.
 */
export default function TestsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const onSeries = location.pathname === SERIES_PATH;
  useDocumentTitle(onSeries ? 'Test series' : 'Tests');
  const { data, error, loading, refetch } = useQuery('tests', testApi.list, { persist: true });
  const [testTab, setTestTab] = useState('chapter');
  const tab = onSeries ? 'series' : testTab;

  // Old links used /tests#series.
  useEffect(() => { if (location.hash === '#series') navigate(SERIES_PATH, { replace: true }); }, [location.hash, navigate]);

  const changeTab = (next) => {
    if (next === 'series') { if (!onSeries) navigate(SERIES_PATH); return; }
    setTestTab(next);
    if (onSeries) navigate('/tests');
  };

  if (loading && !data) return <PageSkeleton />;
  if (!data) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title={onSeries ? 'Test Series' : 'Tests'}
        subtitle={onSeries
          ? 'Step-by-step test sets that build up chapter by chapter. Track your progress across the whole series.'
          : 'Timed tests with instant results. Every wrong answer goes to your Mistake Bank.'}
      />
      <Tabs
        className="mb-6"
        ariaLabel="Test type"
        value={tab}
        onChange={changeTab}
        tabs={[
          { value: 'chapter', label: 'Chapter tests', icon: BookOpen, count: data.chapterTests.length },
          { value: 'full', label: 'Full syllabus', icon: GraduationCap, count: data.fullTests.length },
          { value: 'series', label: 'Test series', icon: Layers, count: data.series.length },
        ]}
      />
      {tab === 'chapter' && (data.chapterTests.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.chapterTests.map((t) => <TestCard key={t.id} test={t} />)}</div>
      ) : <EmptyState emoji="📝" title="No chapter tests yet" description="Your teachers are preparing them." />)}
      {tab === 'full' && (data.fullTests.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.fullTests.map((t) => <TestCard key={t.id} test={t} />)}</div>
      ) : <EmptyState emoji="📝" title="No full tests yet" />)}
      {tab === 'series' && (data.series.length ? (
        <div className="space-y-4">
          {data.series.map((s) => (
            <Link key={s.id} to={`/tests/series/${s.id}`} className="card card-hover block p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-brand-600 text-white"><Layers className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-ink-900">{s.title}</h3>
                  <p className="mt-0.5 text-sm text-ink-500">{s.description}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <ProgressBar value={s.progress.completed} max={s.progress.total} tone="success" className="min-w-0 max-w-xs flex-1" />
                    <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-ink-600">{s.progress.completed}/{s.progress.total} done</span>
                    {s.progress.averageScorePct != null && <span className="hidden text-sm text-ink-500 sm:inline">· avg {s.progress.averageScorePct}%</span>}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
              </div>
            </Link>
          ))}
        </div>
      ) : <EmptyState emoji="📚" title="No series published yet" />)}
    </div>
  );
}
