import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flame, Target, Timer, Layers, ChevronDown, ChevronRight, Sparkles, Play } from 'lucide-react';
import { PageHeader, Card, Button, Badge, PageSkeleton, ErrorState, ProgressRing, masteryColor } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { learnApi } from '@/services/api/student';
import { useHome } from '@/features/shared/useHome';
import { useDocumentTitle } from '@/hooks/useCommon';
import { useAuthStore } from '@/store/authStore';
import { masteryBand, plural } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PracticeSetupModal } from './PracticeSetupModal';

export default function PracticeHubPage() {
  useDocumentTitle('Practice');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: home } = useHome();
  const { data, error, loading, refetch } = useQuery(`curriculum:${user?.profile?.classId}`, learnApi.curriculum, { persist: true });
  const [open, setOpen] = useState(null);
  const [setup, setSetup] = useState(null);

  const ch = home?.challenge;
  const weak = home?.summary?.weakTopics?.length || 0;

  return (
    <div>
      <PageHeader title="Practice" subtitle="Daily Challenge measures you. Practice teaches you — with the solution right after every question." />

      <div className="grid gap-4 md:grid-cols-3">
        <button type="button" onClick={() => navigate(ch?.state === 'COMPLETED' ? '/challenge/result' : '/challenge')} className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-violet-600 p-6 text-left text-white shadow-lift transition hover:-translate-y-0.5 md:col-span-2">
          <div className="bg-grid absolute inset-0 opacity-20" aria-hidden />
          <div className="relative flex h-full flex-col">
            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/80"><Flame className="h-4 w-4 fill-gold-300 text-gold-300" /> Daily Challenge</span>
            <h2 className="mt-2 text-2xl font-bold text-white">
              {ch?.state === 'COMPLETED' ? `Completed · ${ch.score}/${ch.total}` : ch?.state === 'IN_PROGRESS' ? `Resume · ${ch.answered}/${ch.total} done` : '5 questions picked for you'}
            </h2>
            <p className="mt-1 text-white/80">{ch?.state === 'COMPLETED' ? 'Review the worked solutions and your topic diagnosis.' : 'Weak topics first, then your mistakes, then something new.'}</p>
            <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-700">
              <Play className="h-4 w-4" />{ch?.state === 'COMPLETED' ? 'Review' : ch?.state === 'IN_PROGRESS' ? 'Resume' : 'Start'}
            </span>
          </div>
        </button>
        <button type="button" onClick={() => setSetup({ scope: 'WEAK', targetId: null, title: 'Questions from your weakest topics' })} className="card card-hover flex flex-col p-6 text-left">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600"><Sparkles className="h-6 w-6" /></span>
          <h2 className="mt-4 text-lg font-bold">My weak topics</h2>
          <p className="mt-1 flex-1 text-sm text-ink-500">{weak ? `A focused set from your ${weak} weakest topics.` : 'We will pick topics where you need the most practice.'}</p>
          <span className="mt-4 text-sm font-bold text-rose-600">Start focused practice →</span>
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link to="/tests" className="card card-hover flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600"><Timer className="h-6 w-6" /></span>
          <span className="flex-1"><span className="block font-bold text-ink-900">Tests</span><span className="text-sm text-ink-500">Timed chapter tests & full mock tests</span></span>
          <ChevronRight className="h-5 w-5 text-ink-300" />
        </Link>
        <Link to="/tests#series" className="card card-hover flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600"><Layers className="h-6 w-6" /></span>
          <span className="flex-1"><span className="block font-bold text-ink-900">Test Series</span><span className="text-sm text-ink-500">Unlock tests one by one</span></span>
          <ChevronRight className="h-5 w-5 text-ink-300" />
        </Link>
      </div>

      <h2 className="section-title mb-3 mt-10">Practise by chapter or topic</h2>
      {loading && !data ? <PageSkeleton rows={2} /> : !data ? <ErrorState error={error} onRetry={refetch} /> : (
        <div className="space-y-3">
          {data.chapters.map((c) => {
            const expanded = open === c.id;
            return (
              <Card key={c.id} padded={false} className="overflow-hidden">
                <button type="button" onClick={() => setOpen(expanded ? null : c.id)} className="flex w-full items-center gap-4 p-4 text-left sm:px-5" aria-expanded={expanded}>
                  <ProgressRing value={c.mastery ?? 0} size={44} stroke={5} tone={masteryColor(c.mastery)}><span className="text-xs font-bold">{c.number}</span></ProgressRing>
                  <span className="min-w-0 flex-1"><span className="block truncate font-bold text-ink-900">{c.name}</span><span className="text-xs text-ink-500">{plural(c.topicCount, 'topic')}{c.questionCount != null ? ` · ${plural(c.questionCount, 'question')}` : ''}</span></span>
                  <ChevronDown className={cn('h-5 w-5 text-ink-400 transition', expanded && 'rotate-180')} />
                </button>
                {expanded && (
                  <div className="border-t border-ink-100 bg-ink-50/50 p-3 sm:p-4">
                    <Button size="sm" variant="secondary" leftIcon={Target} className="mb-3" onClick={() => setSetup({ scope: 'CHAPTER', targetId: c.id, title: c.name })}>Practise whole chapter</Button>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {c.topics.map((t) => {
                        const b = masteryBand(t.mastery);
                        return (
                          <button key={t.id} type="button" onClick={() => setSetup({ scope: 'TOPIC', targetId: t.id, title: t.name })} className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3 text-left transition hover:border-brand-200 hover:shadow-card">
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-900">{t.name}</span>{t.questionCount != null && <span className="text-xs text-ink-500">{plural(t.questionCount, 'question')}</span>}</span>
                            <Badge tone={b.tone}>{t.mastery ?? '—'}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <PracticeSetupModal open={Boolean(setup)} onClose={() => setSetup(null)} {...(setup || {})} />
    </div>
  );
}
