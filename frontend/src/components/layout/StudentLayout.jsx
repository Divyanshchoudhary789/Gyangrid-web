import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  House, BookOpen, Target, MessageCircleQuestion, NotebookPen, ChartLine, Trophy, Gift, UserRound, Settings, LogOut, Flame, Coins, Zap, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber, firstName } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { Logo } from '@/components/brand/Logo';
import { Avatar, PageSkeleton } from '@/components/ui';
import { useHome } from '@/features/shared/useHome';
import { signOut } from '@/features/auth/session';
import { classLabel, boardLabel } from '@/features/shared/userDisplay';

const PRIMARY = [
  { to: '/home', label: 'Home', icon: House },
  // { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/practice', label: 'Practice', icon: Target },
  { to: '/doubts', label: 'Ask a Doubt', short: 'Doubts', icon: MessageCircleQuestion },
];
const SECONDARY = [
  { to: '/mistakes', label: 'Mistake Bank', icon: NotebookPen },
  { to: '/progress', label: 'Progress', icon: ChartLine },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/rewards', label: 'Rewards', icon: Gift },
];

function StatChips({ summary, compact }) {
  if (!summary) return <div className="h-9 w-40 animate-pulse rounded-full bg-ink-100" aria-hidden />;
  const items = [
    { icon: Flame, value: summary.currentStreak, label: 'day streak', cls: 'bg-flame-50 text-flame-600', iconCls: summary.currentStreak > 0 ? 'fill-flame-400 text-flame-500' : 'text-ink-400', to: '/progress' },
    { icon: Zap, value: formatNumber(summary.totalXp), label: 'XP', cls: 'bg-brand-50 text-brand-700', iconCls: 'fill-brand-400 text-brand-500', to: '/rewards' },
    { icon: Coins, value: formatNumber(summary.goldCoins), label: 'Gold Coins', cls: 'bg-gold-50 text-gold-700', iconCls: 'text-gold-500', to: '/rewards' },
  ];
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {items.map((it) => (
        <Link key={it.label} to={it.to} title={`${it.value} ${it.label}`} className={cn('flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-bold transition hover:brightness-95', it.cls)}>
          <it.icon className={cn('h-4 w-4', it.iconCls)} aria-hidden />
          <span>{it.value}</span>
          {!compact && <span className="hidden text-xs font-semibold opacity-70 xl:inline">{it.label}</span>}
          <span className="sr-only">{it.label}</span>
        </Link>
      ))}
    </div>
  );
}

function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition hover:bg-ink-100" aria-haspopup="menu" aria-expanded={open}>
        <Avatar id={user?.profile?.avatarId} size="sm" />
        <ChevronDown className="hidden h-4 w-4 text-ink-400 sm:block" aria-hidden />
        <span className="sr-only">Open account menu</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-ink-100 bg-white p-1.5 shadow-xl" role="menu"
          >
            <div className="px-3 py-2.5">
              <p className="font-bold text-ink-900">{user?.name}</p>
              <p className="text-xs text-ink-500">{classLabel(user)} · {boardLabel(user)}</p>
            </div>
            <div className="my-1 h-px bg-ink-100" />
            {[{ to: '/profile', label: 'My profile', icon: UserRound }, { to: '/settings', label: 'Settings', icon: Settings }].map((i) => (
              <button key={i.to} type="button" role="menuitem" onClick={() => { setOpen(false); navigate(i.to); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50">
                <i.icon className="h-4 w-4 text-ink-400" aria-hidden /> {i.label}
              </button>
            ))}
            <button type="button" role="menuitem" onClick={() => signOut(navigate)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SideLink({ item, badge }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition',
        isActive ? 'bg-brand-600 text-white shadow-lift' : 'text-ink-600 hover:bg-white hover:text-ink-900',
      )}
    >
      {({ isActive }) => (
        <>
          <item.icon className={cn('h-5 w-5', isActive ? 'text-white' : 'text-ink-400 group-hover:text-brand-500')} aria-hidden />
          <span className="flex-1">{item.label}</span>
          {badge > 0 && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', isActive ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-600')}>{badge}</span>}
        </>
      )}
    </NavLink>
  );
}

export function StudentLayout() {
  const user = useAuthStore((s) => s.user);
  const { data: home } = useHome();
  const summary = home?.summary;
  const location = useLocation();
  const mainRef = useRef(null);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-ink-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-ink-100 bg-ink-50/80 px-4 py-5 backdrop-blur lg:flex">
        <Logo to="/home" className="px-2" />
        <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Main">
          {PRIMARY.map((i) => <SideLink key={i.to} item={i} />)}
          <p className="mb-1 mt-5 px-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">My learning</p>
          {SECONDARY.map((i) => <SideLink key={i.to} item={i} badge={i.to === '/mistakes' ? home?.reviewDue : 0} />)}
        </nav>
        <Link to="/profile" className="mt-4 flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3 transition hover:shadow-card">
          <Avatar id={user?.profile?.avatarId} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink-900">{user?.name}</p>
            <p className="text-xs text-ink-500">{classLabel(user)} · Level {summary?.level ?? '–'}</p>
          </div>
        </Link>
      </aside>

      <div className="lg:pl-[260px]">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-ink-100/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
            <div className="flex items-center gap-3 lg:hidden"><Logo to="/home" compact /></div>
            <p className="hidden font-display text-sm font-semibold text-ink-500 lg:block">
              Hi {firstName(user?.name)} 👋 <span className="text-ink-400">Keep your streak alive today!</span>
            </p>
            <div className="flex items-center gap-2 sm:gap-3">
              <StatChips summary={summary} compact />
              <div className="hidden sm:block"><UserMenu user={user} /></div>
            </div>
          </div>
        </header>

        {/* Fills the space beside the sidebar with an even gutter; capped only on very wide monitors */}
        <main id="main" ref={mainRef} className="mx-auto max-w-[1600px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white/95 backdrop-blur-md lg:hidden" aria-label="Main">
        <div className="mx-auto grid h-16 max-w-md" style={{ gridTemplateColumns: `repeat(${PRIMARY.length + 1}, minmax(0, 1fr))` }}>
          {[...PRIMARY, { to: '/profile', label: 'Profile', icon: UserRound }].map((i) => (
            <NavLink key={i.to} to={i.to} className={({ isActive }) => cn('relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition', isActive ? 'text-brand-600' : 'text-ink-400')}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="bottom-nav-pill" className="absolute top-1.5 h-8 w-12 rounded-full bg-brand-50" />}
                  <i.icon className="relative h-5 w-5" aria-hidden />
                  <span className="relative">{i.short || i.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Distraction-free layout for the challenge and test players. */
export function FocusLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/60 via-ink-50 to-ink-50">
      <Suspense fallback={<div className="mx-auto max-w-3xl p-6"><PageSkeleton rows={1} /></div>}>
        <Outlet />
      </Suspense>
    </div>
  );
}
