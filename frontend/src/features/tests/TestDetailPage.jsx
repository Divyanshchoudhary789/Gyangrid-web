import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, FileQuestion, Award, MinusCircle, RotateCcw, Play, BarChart3, Lock } from 'lucide-react';
import { PageHeader, Card, Button, Checkbox, PageSkeleton, ErrorState, Alert, Badge } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { testApi } from '@/services/api/student';
import { useDocumentTitle, useOnline } from '@/hooks/useCommon';
import { humanDuration, formatDateTime } from '@/lib/date';
import { STATUS_BADGE } from './TestCard';

/** Instructions screen before every test (F6-03). */
export default function TestDetailPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const online = useOnline();
  const { data: t, error, loading, refetch } = useQuery(`tests:${testId}`, () => testApi.get(testId), { staleMs: 0 });
  const [agreed, setAgreed] = useState(false);
  useDocumentTitle(t?.title || 'Test');

  if (loading && !t) return <PageSkeleton rows={1} />;
  if (!t) return <ErrorState error={error} onRetry={refetch} />;

  const s = STATUS_BADGE[t.status];
  const canStart = t.status === 'AVAILABLE' || t.status === 'IN_PROGRESS' || (t.status === 'COMPLETED' && t.canReattempt);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={t.seriesId ? { to: `/tests/series/${t.seriesId}`, label: t.seriesTitle || 'Series' } : { to: '/tests', label: 'All tests' }} eyebrow={t.kind === 'FULL' ? 'Full syllabus test' : t.kind === 'SERIES' ? `Series · Test ${t.order}` : 'Chapter test'} title={t.title} action={<Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: FileQuestion, label: 'Questions', value: t.questionCount },
          { icon: Clock, label: 'Duration', value: humanDuration(t.durationSec) },
          { icon: Award, label: 'Total marks', value: `${t.totalMarks} (${t.marksPerQ} each)` },
          { icon: MinusCircle, label: 'Negative marking', value: t.negativeMarks ? `−${t.negativeMarks} per wrong` : 'None' },
        ].map((x) => (
          <Card key={x.label} className="p-4 sm:p-4">
            <x.icon className="h-5 w-5 text-brand-500" aria-hidden />
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{x.label}</p>
            <p className="font-display font-bold text-ink-900">{x.value}</p>
          </Card>
        ))}
      </div>

      {t.chapters?.length > 0 && <p className="mt-4 text-sm text-ink-500"><strong className="text-ink-700">Covers:</strong> {t.chapters.join(' · ')}</p>}

      {t.firstAttempt && (
        <Alert tone="success" className="mt-6" title={`Your first attempt: ${t.firstAttempt.scorePct}% (${t.firstAttempt.marks} marks)`} action={<Button size="sm" variant="outline" leftIcon={BarChart3} to={`/tests/result/${t.firstAttempt.attemptId}`}>View result</Button>}>
          Taken {formatDateTime(t.firstAttempt.submittedAt)}. {t.canReattempt ? 'You can practise it again — your first attempt still counts for rankings.' : 'This test allows one attempt.'}
        </Alert>
      )}

      {t.status === 'LOCKED' ? (
        <Alert tone="info" className="mt-6" title="This test is locked"><span className="flex items-center gap-1"><Lock className="h-4 w-4" />Finish the previous test in the series to unlock it.</span></Alert>
      ) : canStart && (
        <Card className="mt-6">
          <h2 className="section-title mb-3">Instructions</h2>
          <ol className="space-y-2.5">
            {t.instructions.map((line, i) => (
              <li key={i} className="flex gap-3 text-[15px] text-ink-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>{line}
              </li>
            ))}
          </ol>
          {t.status !== 'IN_PROGRESS' && <Checkbox className="mt-6" checked={agreed} onChange={setAgreed} label="I have read the instructions and I'm ready to begin." />}
          <Button
            size="xl" block className="mt-6" leftIcon={t.status === 'IN_PROGRESS' ? Play : t.status === 'COMPLETED' ? RotateCcw : Play}
            disabled={(t.status !== 'IN_PROGRESS' && !agreed) || !online}
            onClick={() => navigate(`/tests/${t.id}/play`)}
          >
            {!online ? 'You are offline' : t.status === 'IN_PROGRESS' ? 'Resume test' : t.status === 'COMPLETED' ? 'Re-attempt test' : 'Start test'}
          </Button>
          {t.status === 'IN_PROGRESS' && <p className="mt-3 text-center text-sm text-amber-600">The timer kept running while you were away.</p>}
        </Card>
      )}
    </div>
  );
}
