import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, Target, CheckCircle2, ChevronRight, Timer } from 'lucide-react';
import { PageHeader, Card, Button, ProgressBar, ProgressRing, masteryColor, PageSkeleton, ErrorState, Badge, EmptyState } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { learnApi } from '@/services/api/student';
import { useDocumentTitle } from '@/hooks/useCommon';
import { masteryBand } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { PracticeSetupModal } from '@/features/practice/PracticeSetupModal';

export default function ChapterPage() {
  const { chapterId } = useParams();
  const user = useAuthStore((s) => s.user);
  const { data, error, loading, refetch } = useQuery(`curriculum:${user?.profile?.classId}`, learnApi.curriculum, { persist: true });
  const [practice, setPractice] = useState(null);
  const chapter = data?.chapters.find((c) => c.id === chapterId);
  useDocumentTitle(chapter?.name || 'Chapter');

  if (loading && !data) return <PageSkeleton />;
  if (!data) return <ErrorState error={error} onRetry={refetch} />;
  if (!chapter) return <EmptyState title="Chapter not found" description="This chapter isn't part of your class syllabus." action={<Button to="/learn">Back to Learn</Button>} />;

  const band = masteryBand(chapter.mastery);
  return (
    <div>
      <PageHeader
        back={{ to: '/learn', label: 'All chapters' }}
        eyebrow={`Chapter ${chapter.number}`}
        title={chapter.name}
        subtitle={`${chapter.topicCount} topics · ${chapter.questionCount} questions`}
        action={(
          <>
            <Button variant="outline" leftIcon={Timer} to="/tests">Chapter test</Button>
            <Button leftIcon={Target} onClick={() => setPractice({ scope: 'CHAPTER', targetId: chapter.id, title: chapter.name })}>Practise chapter</Button>
          </>
        )}
      />
      <Card className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center">
        <ProgressRing value={chapter.mastery ?? 0} size={84} stroke={8} tone={masteryColor(chapter.mastery)}>
          <span className="font-display text-xl font-bold">{chapter.mastery ?? '–'}</span>
        </ProgressRing>
        <div className="flex-1">
          <p className="font-bold text-ink-900">Chapter mastery: {band.label}</p>
          <p className="text-sm text-ink-500">{chapter.mastery == null ? 'Answer at least 5 questions on a topic to see its mastery.' : band.key === 'STRONG' ? 'Brilliant! Keep it fresh with a quick practice now and then.' : 'Read the notes for the orange and red topics, then practise them.'}</p>
          <div className="mt-3 max-w-md">
            <div className="mb-1 flex justify-between text-xs font-semibold text-ink-500"><span>Topics studied</span><span>{chapter.studiedCount}/{chapter.topicCount}</span></div>
            <ProgressBar value={chapter.studiedCount} max={chapter.topicCount} tone="success" />
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {chapter.topics.map((t) => {
          const b = masteryBand(t.mastery);
          return (
            <div key={t.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
              <Link to={`/learn/topic/${t.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-display font-bold text-brand-700">{chapter.number}.{t.number}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-bold text-ink-900">{t.name}</span>
                    {t.studied && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Studied" />}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <Badge tone={b.tone}>{t.mastery != null ? `${b.label} · ${t.mastery}` : t.attempts ? `${t.attempts} attempts` : 'Not started'}</Badge>
                    {t.accuracy != null && <span>{t.accuracy}% accuracy</span>}
                    <span>{t.questionCount} questions</span>
                  </span>
                </span>
              </Link>
              <div className="flex gap-2 sm:shrink-0">
                <Button variant="outline" size="sm" leftIcon={BookOpen} to={`/learn/topic/${t.id}`} className="flex-1 sm:flex-none">Read</Button>
                <Button variant="secondary" size="sm" leftIcon={Target} onClick={() => setPractice({ scope: 'TOPIC', targetId: t.id, title: t.name })} className="flex-1 sm:flex-none">Practise</Button>
                <ChevronRight className="hidden h-5 w-5 self-center text-ink-300 sm:block" />
              </div>
            </div>
          );
        })}
      </div>
      <PracticeSetupModal open={Boolean(practice)} onClose={() => setPractice(null)} {...(practice || {})} />
    </div>
  );
}
