import { useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Flame, Info, RefreshCw } from 'lucide-react';
import { PageHeader, Tabs, Card, Avatar, PageSkeleton, ErrorState, Modal } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { progressApi } from '@/services/api/student';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatNumber } from '@/lib/format';
import { timeAgo, formatDateTime } from '@/lib/date';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';

const PODIUM = [
  { place: 2, h: 'h-20', cls: 'from-slate-200 to-slate-300', medal: '🥈' },
  { place: 1, h: 'h-28', cls: 'from-gold-300 to-gold-500', medal: '🥇' },
  { place: 3, h: 'h-16', cls: 'from-orange-200 to-orange-400', medal: '🥉' },
];

/** Class-scoped leaderboard, top 20 + own row; only display name + avatar are shown (F2-09, F10-14/15). */
export default function LeaderboardPage() {
  useDocumentTitle('Leaderboard');
  const user = useAuthStore((s) => s.user);
  const [period, setPeriod] = useState('WEEKLY');
  const { data, error, loading, refetch } = useQuery(`leaderboard:${period}`, () => progressApi.leaderboard(period));
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Leaderboard"
        subtitle={`Class ${user?.profile?.classId} · ranked by XP earned from real learning`}
        action={<button type="button" onClick={() => setRulesOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-ink-500 hover:bg-ink-100"><Info className="h-4 w-4" />How ranking works</button>}
      />
      <Tabs className="mb-6" value={period} onChange={setPeriod} tabs={[{ value: 'WEEKLY', label: 'This week' }, { value: 'ALL_TIME', label: 'All time' }]} />

      {loading && !data ? <PageSkeleton rows={1} /> : !data ? <ErrorState error={error} onRetry={refetch} /> : (
        <>
          <div className="mb-6 grid grid-cols-3 items-end gap-3">
            {PODIUM.map((p) => {
              const row = data.top[p.place - 1];
              if (!row) return <div key={p.place} />;
              return (
                <motion.div key={p.place} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: p.place * 0.1 }} className="flex flex-col items-center text-center">
                  {p.place === 1 && <Crown className="mb-1 h-7 w-7 fill-gold-400 text-gold-500" />}
                  <Avatar id={row.avatarId} size={p.place === 1 ? 'lg' : 'md'} ring className="shadow-md" />
                  <p className={cn('mt-2 max-w-full truncate text-sm font-bold', row.isMe ? 'text-brand-700' : 'text-ink-900')}>{row.isMe ? 'You' : row.displayName}</p>
                  <p className="text-xs font-semibold text-ink-500">{formatNumber(row.xp)} XP</p>
                  <div className={cn('mt-2 flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-2 text-2xl', p.h, p.cls)}>{p.medal}</div>
                </motion.div>
              );
            })}
          </div>

          <Card padded={false} className="overflow-hidden">
            <ul className="divide-y divide-ink-100">
              {data.top.slice(3).map((row) => (
                <li key={row.id} className={cn('flex items-center gap-3 px-4 py-3 sm:px-5', row.isMe && 'bg-brand-50')}>
                  <span className="w-8 text-center font-display font-bold text-ink-400">{row.rank}</span>
                  <Avatar id={row.avatarId} size="sm" />
                  <span className={cn('min-w-0 flex-1 truncate font-semibold', row.isMe ? 'text-brand-700' : 'text-ink-800')}>{row.isMe ? `${row.displayName} (you)` : row.displayName}</span>
                  {row.streak > 0 && <span className="hidden items-center gap-1 text-xs font-semibold text-flame-600 sm:flex"><Flame className="h-3.5 w-3.5" />{row.streak}</span>}
                  <span className="font-display font-bold text-ink-900">{formatNumber(row.xp)}</span>
                </li>
              ))}
            </ul>
            {data.me && data.me.rank > 20 && (
              <div className="flex items-center gap-3 border-t-2 border-dashed border-brand-200 bg-brand-50 px-4 py-3 sm:px-5">
                <span className="w-8 text-center font-display font-bold text-brand-600">{data.me.rank}</span>
                <Avatar id={data.me.avatarId} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold text-brand-700">{data.me.displayName} (you)</span>
                <span className="font-display font-bold text-ink-900">{formatNumber(data.me.xp)}</span>
              </div>
            )}
          </Card>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink-400">
            <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />Updated {timeAgo(data.updatedAt)}</span>
            {period === 'WEEKLY' && <span>Resets {formatDateTime(data.resetsAt)}</span>}
            <span>{data.totalStudents} students in your class</span>
          </p>
        </>
      )}

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="How ranking works" size="sm">
        <ul className="space-y-2.5 text-sm text-ink-700">
          <li>• Only students in <strong>your class</strong> are ranked together.</li>
          <li>• Ranked by <strong>XP earned</strong> in the period. The weekly board resets every Monday at 00:00 (India time).</li>
          <li>• Ties are broken by <strong>higher streak</strong>, then <strong>fewer attempts</strong> for the same XP, then <strong>earlier sign-up</strong>.</li>
          <li>• Others only see your first name, one letter of your surname and your avatar — never your email, school or city.</li>
          <li>• The board refreshes about every 15 minutes.</li>
        </ul>
      </Modal>
    </div>
  );
}
