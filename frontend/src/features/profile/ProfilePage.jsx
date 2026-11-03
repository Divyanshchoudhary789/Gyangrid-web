import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, ChartLine, NotebookPen, Trophy, Gift, ShieldCheck, Settings, FileText, LogOut, ChevronRight, Flame, Zap, Coins, Mail, CalendarDays, GraduationCap } from 'lucide-react';
import { Card, Avatar, Badge, Button } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useHome } from '@/features/shared/useHome';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatDate } from '@/lib/date';
import { formatNumber, plural } from '@/lib/format';
import { signOut } from '@/features/auth/session';
import { classLabel, boardLabel } from '@/features/shared/userDisplay';
import { AvatarPicker } from './AvatarPicker';

const LINKS = [
  { to: '/progress', label: 'Progress', desc: 'Mastery, trends and activity', icon: ChartLine, cls: 'bg-sky-100 text-sky-600' },
  { to: '/mistakes', label: 'Mistake Bank', desc: 'Review and fix past mistakes', icon: NotebookPen, cls: 'bg-rose-100 text-rose-600' },
  { to: '/leaderboard', label: 'Leaderboard', desc: 'Your class ranking', icon: Trophy, cls: 'bg-gold-100 text-gold-600' },
  { to: '/rewards', label: 'Rewards', desc: 'Gold Coins and XP history', icon: Gift, cls: 'bg-violet-100 text-violet-600' },
  { to: '/settings/parent-report', label: 'Parent & consent', desc: 'What your parent receives each week', icon: ShieldCheck, cls: 'bg-emerald-100 text-emerald-600' },
  { to: '/settings', label: 'Settings', desc: 'Class, reminders, privacy and account', icon: Settings, cls: 'bg-ink-100 text-ink-600' },
];

export default function ProfilePage() {
  useDocumentTitle('Profile');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data } = useHome();
  const s = data?.summary;
  const [pick, setPick] = useState(false);
  const p = user?.profile;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card padded={false} className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-brand-500 via-violet-500 to-sky-500" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-col items-center gap-4 sm:flex-row sm:items-end">
            <button type="button" onClick={() => setPick(true)} className="group relative rounded-full" aria-label="Change avatar">
              <Avatar id={p?.avatarId} size="xl" ring className="shadow-lg" />
              <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink-600 shadow group-hover:text-brand-600"><Pencil className="h-4 w-4" /></span>
            </button>
            <div className="flex-1 text-center sm:pb-1 sm:text-left">
              <h1 className="text-2xl font-bold">{user?.name}</h1>
              <p className="text-sm text-ink-500">Shown to classmates as <strong>{user?.displayName}</strong></p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Zap, label: 'XP', value: s ? formatNumber(s.totalXp) : '—', cls: 'text-brand-600' },
              { icon: Coins, label: 'Gold Coins', value: s ? formatNumber(s.goldCoins) : '—', cls: 'text-gold-600' },
              { icon: Flame, label: 'Streak', value: s ? plural(s.currentStreak, 'day') : '—', cls: 'text-flame-600' },
              { icon: Trophy, label: 'Weekly rank', value: s?.rank?.classWeekly ? `#${s.rank.classWeekly}` : '—', cls: 'text-violet-600' },
            ].map((x) => (
              <div key={x.label} className="rounded-2xl bg-ink-50 p-3 text-center">
                <x.icon className={`mx-auto h-5 w-5 ${x.cls}`} />
                <p className="mt-1 font-display text-lg font-bold">{x.value}</p>
                <p className="text-xs text-ink-500">{x.label}</p>
              </div>
            ))}
          </div>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            {[
              { icon: GraduationCap, k: 'Class & board', v: `${classLabel(user)} · ${boardLabel(user)}` },
              { icon: CalendarDays, k: 'Joined', v: user?.createdAt ? formatDate(user.createdAt) : '—' },
              { icon: Mail, k: 'Email', v: user?.email },
              { icon: ShieldCheck, k: 'Parent / guardian', v: p?.parent ? `${p.parent.name} (${p.parent.relationship}) · ${p.parent.contactMasked}` : '—' },
            ].map((x) => (
              <div key={x.k} className="flex items-start gap-3 rounded-xl border border-ink-100 p-3">
                <x.icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                <div className="min-w-0"><dt className="text-xs font-semibold text-ink-500">{x.k}</dt><dd className="truncate font-medium text-ink-900">{x.v}</dd></div>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {p?.consent ? <Badge tone="success" icon={ShieldCheck}>Parental consent: active</Badge> : <Badge tone="warning" icon={ShieldCheck}>Parental consent: pending</Badge>}
            {p?.consent?.timestamp && <span className="text-xs text-ink-400">since {formatDate(p.consent.timestamp)}</span>}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="card card-hover flex items-center gap-4 p-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${l.cls}`}><l.icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block font-bold text-ink-900">{l.label}</span><span className="block truncate text-sm text-ink-500">{l.desc}</span></span>
            <ChevronRight className="h-5 w-5 text-ink-300" />
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" leftIcon={FileText} to="/privacy" className="flex-1">Privacy policy</Button>
        <Button variant="outline" leftIcon={LogOut} onClick={() => signOut(navigate)} className="flex-1 text-rose-600">Sign out</Button>
      </div>
      <AvatarPicker open={pick} onClose={() => setPick(false)} />
    </div>
  );
}
