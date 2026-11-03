import { CheckCircle2, XCircle, Mail, TrendingUp, TrendingDown, Flame, Zap, Coins, CalendarClock } from 'lucide-react';
import { PageHeader, Card, PageSkeleton, ErrorState, Alert } from '@/components/ui';
import { Logo } from '@/components/brand/Logo';
import { useQuery } from '@/hooks/useQuery';
import { progressApi } from '@/services/api/student';
import { useDocumentTitle } from '@/hooks/useCommon';
import { LiveParentReport } from './LiveParentReport';

/** F11-08: the student can see that a weekly report goes to their parent and exactly what it contains. */
function ParentReportPageFull() {
  useDocumentTitle('Parent report');
  const { data: r, error, loading, refetch } = useQuery('parentReport', progressApi.parentReport);
  if (loading && !r) return <PageSkeleton rows={1} />;
  if (!r) return <ErrorState error={error} onRetry={refetch} />;
  const g = r.atAGlance;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader back={{ to: '/settings', label: 'Settings' }} title="Your weekly parent report" subtitle={`Every ${r.schedule.day} at ${r.schedule.time} (India time), ${r.parentName} gets a short summary at ${r.recipientMasked}.`} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-emerald-100 bg-emerald-50/50">
          <p className="mb-3 font-bold text-emerald-800">What it includes</p>
          <ul className="space-y-2 text-sm text-ink-700">
            {['Days active, challenges and tests', 'Accuracy and how it changed', 'Topics you are strong in and topics to work on', 'Mistakes saved and fixed', 'XP, coins and your streak', 'One friendly suggestion'].map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />{x}</li>)}
          </ul>
        </Card>
        <Card className="border-rose-100 bg-rose-50/50">
          <p className="mb-3 font-bold text-rose-800">What it never includes</p>
          <ul className="space-y-2 text-sm text-ink-700">
            {r.excludes.map((x) => <li key={x} className="flex gap-2"><XCircle className="h-4 w-4 shrink-0 text-rose-500" />{x}</li>)}
          </ul>
        </Card>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-500"><Mail className="h-4 w-4" />Preview of this week&apos;s email</p>
        <Card padded={false}>
          <div className="border-b border-ink-100 px-5 py-4 sm:px-8">
            <p className="text-xs text-ink-400">Subject</p>
            <p className="font-semibold text-ink-900">{r.subject}</p>
          </div>
          <div className="space-y-6 px-5 py-6 sm:px-8">
            <Logo />
            {r.inactive ? (
              <Alert tone="info" title="A quiet week">It looks like this week was busy! A 6-minute Daily Challenge is a great way to get back into the rhythm. 🌱</Alert>
            ) : (
              <>
                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">1 · At a glance</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[[g.activeDays, 'active days'], [g.challenges, 'challenges'], [g.tests, 'tests'], [g.questions, 'questions']].map(([v, l]) => (
                      <div key={l} className="rounded-xl bg-ink-50 p-3 text-center"><p className="font-display text-xl font-bold">{v}</p><p className="text-xs text-ink-500">{l}</p></div>
                    ))}
                  </div>
                </section>
                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">2 · Accuracy</p>
                  <p className="flex items-center gap-2 text-lg font-bold">
                    {r.accuracy ?? '—'}%
                    {r.accuracyChange != null && <span className={`flex items-center gap-1 text-sm ${r.accuracyChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{r.accuracyChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{r.accuracyChange >= 0 ? 'up' : 'down'} {Math.abs(r.accuracyChange)} points from last week</span>}
                  </p>
                </section>
                <section className="grid gap-4 sm:grid-cols-2">
                  <div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">3 · Doing well</p><p className="text-sm text-ink-800">{r.doingWell.join(' · ') || '—'}</p></div>
                  <div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">4 · Needs attention</p><p className="text-sm text-ink-800">{r.needsAttention.join(' · ') || '—'}</p></div>
                </section>
                <section>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">5 · Learning from mistakes</p>
                  <p className="text-sm text-ink-800">{r.mistakesSaved} mistakes saved · {r.mistakesResolved} resolved</p>
                </section>
                <section>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">6 · Motivation</p>
                  <div className="flex flex-wrap gap-2 text-sm font-semibold">
                    <span className="chip bg-flame-100 text-flame-600"><Flame className="h-3.5 w-3.5" />{r.streak}-day streak</span>
                    <span className="chip bg-brand-100 text-brand-700"><Zap className="h-3.5 w-3.5" />{r.xpEarned} XP</span>
                    <span className="chip bg-gold-100 text-gold-700"><Coins className="h-3.5 w-3.5" />{r.coinsEarned} Gold Coins</span>
                  </div>
                </section>
              </>
            )}
            <section className="rounded-2xl bg-brand-50 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-600">7 · One suggestion</p>
              <p className="text-sm text-brand-900">💡 {r.suggestion}</p>
            </section>
            <p className="border-t border-ink-100 pt-4 text-xs text-ink-400">What this report does and does not contain · Unsubscribe · Privacy policy</p>
          </div>
        </Card>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-xs text-ink-400"><CalendarClock className="h-3.5 w-3.5" />Your parent can unsubscribe at any time using the link in the email.</p>
    </div>
  );
}

export default function ParentReportPage() {
  return progressApi.deliverParentReport ? <LiveParentReport /> : <ParentReportPageFull />;
}
