import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, BookOpen, ChevronRight, CheckCircle2 } from 'lucide-react';
import { PageHeader, ProgressRing, masteryColor, PageSkeleton, ErrorState, EmptyState, TextField, Badge } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { learnApi } from '@/services/api/student';
import { useDocumentTitle } from '@/hooks/useCommon';
import { masteryBand, plural } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { classLabel, boardLabel } from '@/features/shared/userDisplay';

export default function LearnPage() {
  useDocumentTitle('Learn');
  const user = useAuthStore((s) => s.user);
  const { data, error, loading, refetch } = useQuery(`curriculum:${user?.profile?.classId}`, learnApi.curriculum, { persist: true });
  const [q, setQ] = useState('');

  const chapters = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    if (!s) return data.chapters;
    return data.chapters
      .map((ch) => ({ ...ch, matchTopics: ch.topics.filter((t) => t.name.toLowerCase().includes(s)) }))
      .filter((ch) => ch.name.toLowerCase().includes(s) || ch.matchTopics.length);
  }, [data, q]);

  if (loading && !data) return <PageSkeleton rows={6} />;
  if (!data) return <ErrorState error={error} onRetry={refetch} />;

  const totalTopics = data.chapters.reduce((s, c) => s + c.topicCount, 0);
  const studied = data.chapters.reduce((s, c) => s + c.studiedCount, 0);

  return (
    <div>
      <PageHeader
        eyebrow={`${classLabel(user)} · ${boardLabel(user)}`}
        title="Learn"
        subtitle={`${data.chapters.length} chapters · ${totalTopics} topics · ${studied} studied so far`}
      />
      <TextField icon={Search} placeholder="Search chapters or topics…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search chapters or topics" className="mb-6 max-w-md" />
      {chapters.length === 0 ? (
        <EmptyState title="No matches" description={`Nothing in your syllabus matches “${q}”.`} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {chapters.map((ch, i) => {
            const band = masteryBand(ch.mastery);
            return (
              <motion.div key={ch.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                <Link to={`/learn/chapter/${ch.id}`} className="card card-hover flex items-center gap-4 p-4 sm:p-5">
                  <ProgressRing value={ch.mastery ?? 0} size={58} stroke={6} tone={masteryColor(ch.mastery)} label={`Mastery ${ch.mastery ?? 'not enough data'}`}>
                    <span className="font-display text-sm font-bold text-ink-700">{ch.number}</span>
                  </ProgressRing>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink-900">{ch.name}</p>
                    <p className="mt-0.5 text-sm text-ink-500">{plural(ch.topicCount, 'topic')}{ch.questionCount != null ? ` · ${plural(ch.questionCount, 'question')}` : ''}</p>
                    {ch.description && <p className="mt-0.5 line-clamp-1 text-xs text-ink-400">{ch.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={band.tone === 'neutral' ? 'neutral' : band.tone}>{ch.mastery != null ? `${band.label} · ${ch.mastery}` : 'Not started'}</Badge>
                      {ch.studiedCount > 0 && <Badge tone="info" icon={CheckCircle2}>{ch.studiedCount}/{ch.topicCount} studied</Badge>}
                    </div>
                    {q && ch.matchTopics?.length > 0 && <p className="mt-2 truncate text-xs text-brand-600">Matches: {ch.matchTopics.map((t) => t.name).join(', ')}</p>}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-ink-400"><BookOpen className="h-3.5 w-3.5" /> Mastery = 55% accuracy + 25% recent form + 20% mistakes fixed. Shows after 5 attempts.</p>
    </div>
  );
}
