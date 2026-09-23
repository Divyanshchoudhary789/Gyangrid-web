import { useState } from 'react';
import { Coins, Zap, Flame, CheckCircle2, Circle, Gift, MessageCircleQuestion, Target, Info, Users } from 'lucide-react';
import { PageHeader, Card, Tabs, PageSkeleton, ErrorState, EmptyState, Alert } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { progressApi } from '@/services/api/student';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/lib/date';
import { cn } from '@/lib/cn';

export default function RewardsPage() {
  useDocumentTitle('Rewards');
  const { data: r, error, loading, refetch } = useQuery('rewards', progressApi.rewards);
  const [tab, setTab] = useState('coins');

  if (loading && !r) return <PageSkeleton rows={2} />;
  if (!r) return <ErrorState error={error} onRetry={refetch} />;

  const today = [
    { done: r.today.challenge, icon: Target, title: 'Daily Challenge', text: `Complete today's challenge with ${r.rules.challengeMinScore}% or more`, coins: r.rules.challengeCoins },
    { done: r.today.doubt, icon: MessageCircleQuestion, title: 'Solve a doubt', text: 'Answer the tutor’s follow-up question correctly', coins: r.rules.doubtCoins },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Rewards" subtitle="Earned for real learning — never for just tapping around." />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gold-300 via-gold-400 to-gold-600 p-6 text-ink-900 shadow-lg md:col-span-2">
          <div className="absolute -right-6 -top-6 text-[120px] opacity-20" aria-hidden>🪙</div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-900/70"><Coins className="h-4 w-4" />Gold Coins</p>
          <p className="mt-2 font-display text-5xl font-extrabold">{formatNumber(r.goldCoins)}</p>
          <p className="mt-2 max-w-md text-sm text-ink-900/80">Coins reward same-day learning. A way to spend them is coming soon — keep collecting!</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <Card className="flex items-center gap-3 p-5 sm:p-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><Zap className="h-5 w-5" /></span><div><p className="font-display text-2xl font-bold">{formatNumber(r.totalXp)}</p><p className="text-xs font-semibold text-ink-500">Total XP</p></div></Card>
          <Card className="flex items-center gap-3 p-5 sm:p-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-flame-100 text-flame-600"><Flame className="h-5 w-5" /></span><div><p className="font-display text-2xl font-bold">{r.streak.current} days</p><p className="text-xs font-semibold text-ink-500">Streak · best {r.streak.longest}</p></div></Card>
        </div>
      </div>

      <Card>
        <h2 className="section-title mb-1">Today&apos;s coin goals</h2>
        <p className="muted mb-4">Each goal pays once a day. Resets at midnight.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {today.map((t) => (
            <div key={t.title} className={cn('flex items-center gap-3 rounded-2xl border-2 p-4', t.done ? 'border-emerald-200 bg-emerald-50' : 'border-ink-100')}>
              {t.done ? <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-500" /> : <Circle className="h-7 w-7 shrink-0 text-ink-300" />}
              <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 font-bold text-ink-900"><t.icon className="h-4 w-4 text-ink-400" />{t.title}</p><p className="text-xs text-ink-500">{t.text}</p></div>
              <span className="chip bg-gold-100 text-gold-700">+{t.coins}</span>
            </div>
          ))}
        </div>
        {r.rules.bothBonus?.enabled && <p className="mt-3 text-sm text-ink-600">Do both today for a bonus of +{r.rules.bothBonus.amount} coins!</p>}
      </Card>

      <Alert tone="info" title="What are Gold Coins for?">Coins show that you learn every day. In a future update you&apos;ll be able to use them for fun things like avatars and badges. They have no cash value.</Alert>

      <Card>
        <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'coins', label: 'Coin history', icon: Coins }, { value: 'xp', label: 'XP history', icon: Zap }, { value: 'how', label: 'How to earn', icon: Gift }]} />
        {tab === 'coins' && (r.ledger.length ? (
          <ul className="divide-y divide-ink-100">
            {r.ledger.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600"><Coins className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink-900">{e.label}</p><p className="text-xs text-ink-500">{formatDateTime(e.awardedAt)} · balance {e.balanceAfter}</p></div>
                <span className="font-display font-bold text-emerald-600">+{e.amount}</span>
              </li>
            ))}
          </ul>
        ) : <EmptyState emoji="🪙" title="No coins yet" description="Finish today's challenge with 60% or more to earn your first Gold Coins." />)}
        {tab === 'xp' && (r.xpHistory.length ? (
          <ul className="divide-y divide-ink-100">
            {r.xpHistory.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><Zap className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink-900">{e.label}</p><p className="text-xs text-ink-500">{formatDateTime(e.at)}</p></div>
                <span className="font-display font-bold text-brand-600">+{e.amount}</span>
              </li>
            ))}
          </ul>
        ) : <EmptyState emoji="⚡" title="No XP yet" />)}
        {tab === 'how' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['Complete the Daily Challenge', `${r.rules.xp.DAILY_CHALLENGE} XP`],
              ['All 5 correct bonus', `${r.rules.xp.ALL_CORRECT_BONUS} XP`],
              ['Correct practice question', `${r.rules.xp.PRACTICE_QUESTION} XP (up to ${r.rules.xp.PRACTICE_DAILY_CAP}/day)`],
              ['Resolve a mistake', `${r.rules.xp.MISTAKE_RESOLVED} XP (up to ${r.rules.xp.MISTAKE_DAILY_CAP}/day)`],
              ['Complete a test (first attempt)', `${r.rules.xp.TEST_COMPLETED} XP`],
              ['Understand a doubt', `${r.rules.xp.DOUBT_UNDERSTOOD} XP (up to ${r.rules.xp.DOUBT_DAILY_CAP}/day)`],
              ['Streak milestones', Object.entries(r.rules.xp.STREAK_MILESTONES).map(([d, x]) => `${d}d: ${x}`).join(' · ')],
              ['Tests', 'XP only — coins are for daily habits'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ink-50 px-4 py-3"><p className="text-sm font-semibold text-ink-800">{k}</p><p className="text-xs text-ink-500">{v}</p></div>
            ))}
          </div>
        )}
      </Card>

      {r.referral.enabled ? (
        <Card className="flex items-center gap-3"><Users className="h-6 w-6 text-brand-500" /><p className="text-sm">Invite classmates with your referral code to earn referral points.</p></Card>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-xs text-ink-400"><Info className="h-3.5 w-3.5" />Referral rewards are coming later.</p>
      )}
    </div>
  );
}
