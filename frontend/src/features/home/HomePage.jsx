import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Flame, Play, RotateCcw, Trophy, Keyboard, Camera, Mic, NotebookPen, BookOpen, Target, Timer, ChartLine, Sparkles, ChevronRight,
  Clock, CheckCircle2, MessageCircleQuestion, WifiOff, Zap, Coins, RefreshCw,
} from 'lucide-react';
import { Button, Card, ProgressBar, Skeleton, Alert, Avatar } from '@/components/ui';
import { useHome } from '@/features/shared/useHome';
import { REC_META, openRecommendation } from '@/features/shared/recommendation';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle, useOnline } from '@/hooks/useCommon';
import { firstName, formatNumber } from '@/lib/format';
import { greeting, timeAgo, formatDate } from '@/lib/date';
import { cn } from '@/lib/cn';

const fade = (i) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05, duration: 0.3 } });

function ChallengeCard({ challenge, streak, online }) {
  const navigate = useNavigate();
  const state = challenge?.state || 'NOT_STARTED';
  const done = state === 'COMPLETED';
  return (
    <div className={cn('relative overflow-hidden rounded-3xl p-6 text-white shadow-lift sm:p-8', done ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600' : 'bg-gradient-to-br from-brand-600 via-violet-600 to-indigo-700')}>
      <div className="bg-grid absolute inset-0 opacity-20" aria-hidden />
      <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/80">
            <Flame className="h-4 w-4 fill-gold-300 text-gold-300" aria-hidden /> Today&apos;s Challenge
          </p>
          {state === 'NOT_STARTED' && (
            <>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">5 questions, picked just for you</h2>
              <p className="mt-2 max-w-md text-white/80">Finish it to {streak > 0 ? `make it a ${streak + 1}-day streak` : 'start your streak'} and earn Gold Coins. Takes about 6 minutes.</p>
            </>
          )}
          {state === 'IN_PROGRESS' && (
            <>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">You&apos;re {challenge.answered} of {challenge.total} done</h2>
              <p className="mt-2 text-white/80">Pick up right where you left off.</p>
              <ProgressBar value={challenge.answered} max={challenge.total} tone="white" className="mt-4 max-w-xs bg-white/25" label="Challenge progress" />
            </>
          )}
          {done && (
            <>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Done! You scored {challenge.score}/{challenge.total} 🎉</h2>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-white/90">
                <span className="chip bg-white/20 text-white"><Zap className="h-3.5 w-3.5" />+{challenge.xpEarned} XP</span>
                {challenge.coinsEarned > 0 ? <span className="chip bg-gold-300 text-ink-900"><Coins className="h-3.5 w-3.5" />+{challenge.coinsEarned} coins</span> : <span className="text-sm text-white/80">Score 60%+ tomorrow to earn coins</span>}
              </p>
              <p className="mt-2 text-sm text-white/80">A new challenge unlocks at midnight.</p>
            </>
          )}
        </div>
        <div className="shrink-0">
          {!online ? (
            <Button size="xl" variant="white" disabled leftIcon={WifiOff}>Offline</Button>
          ) : done ? (
            <Button size="xl" variant="white" leftIcon={RotateCcw} onClick={() => navigate('/challenge/result')}>Review answers</Button>
          ) : (
            <Button size="xl" variant="gold" leftIcon={Play} onClick={() => navigate('/challenge')} className="animate-none">
              {state === 'IN_PROGRESS' ? `Resume (${challenge.answered}/${challenge.total})` : 'Start challenge'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AskDoubtCard({ online, quota }) {
  const navigate = useNavigate();
  const modes = [
    { mode: 'text', icon: Keyboard, label: 'Type', cls: 'bg-brand-50 text-brand-700 hover:bg-brand-100' },
    { mode: 'image', icon: Camera, label: 'Photo', cls: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
    { mode: 'voice', icon: Mic, label: 'Speak', cls: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
  ];
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2"><MessageCircleQuestion className="h-5 w-5 text-emerald-500" /> Stuck on a question?</h2>
          <p className="muted mt-1">Ask the AI tutor — it explains step by step.</p>
        </div>
        {quota && <span className="chip shrink-0 bg-ink-100 text-ink-600">{Math.max(0, quota.limit - quota.usedToday)} left today</span>}
      </div>
      <div className="mt-5 grid flex-1 grid-cols-3 gap-2.5">
        {modes.map((m) => (
          <button
            key={m.mode} type="button" disabled={!online}
            onClick={() => navigate(`/doubts?mode=${m.mode}`)}
            className={cn('flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', m.cls)}
          >
            <m.icon className="h-6 w-6" aria-hidden />
            <span className="text-sm">{m.label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

const TILES = [
  { to: '/practice', label: 'Practice', desc: 'By topic or weak areas', icon: Target, cls: 'from-brand-500 to-violet-500' },
  { to: '/tests', label: 'Tests', desc: 'Chapter & mock tests', icon: Timer, cls: 'from-violet-500 to-fuchsia-500' },
  { to: '/mistakes', label: 'Mistake Bank', desc: 'Learn from every slip', icon: NotebookPen, cls: 'from-rose-500 to-pink-500' },
  { to: '/progress', label: 'Progress', desc: 'Mastery & trends', icon: ChartLine, cls: 'from-sky-500 to-blue-600' },
];

const ACTIVITY_ICON = { CHALLENGE: Flame, PRACTICE: Target, TEST: Timer, DOUBT: MessageCircleQuestion, DOUBT_UNDERSTOOD: CheckCircle2, MISTAKE_RESOLVED: NotebookPen, STUDIED: BookOpen };

export default function HomePage() {
  useDocumentTitle('Home');
  const navigate = useNavigate();
  const online = useOnline();
  const { user, setUser } = useAuthStore();
  const { data, error, loading, refreshing, fromCache, refetch } = useHome();
  const [recBusy, setRecBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (loading && !data) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-3xl" />
        <div className="grid gap-5 md:grid-cols-2"><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-44 rounded-2xl" /></div>
      </div>
    );
  }
  if (!data) {
    return <Alert tone="danger" title="We couldn't load your home screen" action={<Button size="sm" variant="outline" onClick={refetch}>Retry</Button>}>{error?.message}</Alert>;
  }

  const s = data.summary;
  const rec = s.recommendation;
  const RecIcon = REC_META[rec?.action]?.icon || Sparkles;

  const onRec = async () => {
    if (!online) return;
    setRecBusy(true);
    try { await openRecommendation(rec, navigate); } catch (e) { toast.error(errorMessage(e)); } finally { setRecBusy(false); }
  };

  const verify = async () => {
    setVerifying(true);
    try {
      setUser(await authApi.verifyEmail());
      toast.success('Email verified — rewards unlocked!');
    } catch (e) { toast.error(errorMessage(e)); } finally { setVerifying(false); }
  };

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div {...fade(0)} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-center gap-4">
          <Avatar id={user?.profile?.avatarId} size="lg" className="hidden sm:inline-flex" />
          <div>
            <p className="text-sm font-semibold text-ink-500">{formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="text-2xl font-bold sm:text-3xl">{greeting()}, {firstName(user?.name)}!</h1>
            <p className="mt-0.5 text-sm text-ink-500">Class {user?.profile?.classId} · NCERT / CBSE · Level {s.level}</p>
          </div>
        </div>
        <div className="w-full sm:w-64">
          <div className="mb-1.5 flex justify-between text-xs font-semibold text-ink-500"><span>Level {s.level}</span><span>{formatNumber(s.xpToNextLevel)} XP to level {s.level + 1}</span></div>
          <ProgressBar value={s.levelProgress} label="Level progress" />
        </div>
      </motion.div>

      {fromCache && !online && (
        <Alert tone="warning" title="You're offline">Showing your last saved streak, XP and coins. Actions will be available when you reconnect.</Alert>
      )}
      {error && online && data && (
        <Alert tone="warning" action={<Button size="sm" variant="outline" leftIcon={RefreshCw} onClick={refetch}>Retry</Button>}>Couldn&apos;t refresh — showing saved data.</Alert>
      )}
      {!user?.emailVerified && (
        <Alert tone="info" title="Verify your email to claim rewards" action={<Button size="sm" variant="outline" loading={verifying} onClick={verify}>I&apos;ve verified</Button>}>
          We sent a link to {user?.email}. Gold Coins unlock once your email is verified.
        </Alert>
      )}

      <motion.div {...fade(1)}><ChallengeCard challenge={data.challenge} streak={s.currentStreak} online={online} /></motion.div>

      {/* AI recommendation strip (F2-06) */}
      {rec && (
        <motion.button {...fade(2)} type="button" onClick={onRec} disabled={recBusy || !online}
          className="group flex w-full items-center gap-4 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 via-white to-white p-4 text-left transition hover:border-brand-300 hover:shadow-card disabled:opacity-70"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lift"><RecIcon className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-600"><Sparkles className="h-3.5 w-3.5" /> Your next step</span>
            <span className="mt-0.5 block font-semibold text-ink-900">{rec.reason}</span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-bold text-brand-700 shadow-sm sm:flex">{rec.ctaLabel}<ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
          <ChevronRight className="h-5 w-5 shrink-0 text-brand-500 sm:hidden" />
        </motion.button>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <motion.div {...fade(3)} className="lg:col-span-3"><AskDoubtCard online={online} quota={data.doubtQuota} /></motion.div>
        <motion.div {...fade(4)} className="grid grid-cols-1 gap-5 lg:col-span-2">
          {data.reviewDue > 0 ? (
            <Link to="/mistakes?due=true" className="card card-hover flex items-center gap-4 border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-white">
                <NotebookPen className="h-6 w-6" />
                <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink-900 px-1.5 text-xs font-bold">{data.reviewDue}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink-900">Review time!</span>
                <span className="block text-sm text-ink-500">{data.reviewDue} mistake{data.reviewDue > 1 ? 's are' : ' is'} due today. Fix them for XP.</span>
              </span>
              <ChevronRight className="h-5 w-5 text-rose-400" />
            </Link>
          ) : (
            <div className="card flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-6 w-6" /></span>
              <span><span className="block font-bold text-ink-900">No reviews due</span><span className="block text-sm text-ink-500">Your Mistake Bank is up to date.</span></span>
            </div>
          )}
          {data.continueLearning ? (
            <Link to={`/learn/topic/${data.continueLearning.topicId}`} className="card card-hover flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600"><BookOpen className="h-6 w-6" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wide text-sky-600">Continue learning</span>
                <span className="block truncate font-bold text-ink-900">{data.continueLearning.name}</span>
                <span className="block truncate text-sm text-ink-500">{data.continueLearning.chapterName}</span>
              </span>
              <ChevronRight className="h-5 w-5 text-ink-300" />
            </Link>
          ) : (
            <Link to="/learn" className="card card-hover flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600"><BookOpen className="h-6 w-6" /></span>
              <span className="flex-1"><span className="block font-bold text-ink-900">Start learning</span><span className="block text-sm text-ink-500">Browse your chapters and notes.</span></span>
              <ChevronRight className="h-5 w-5 text-ink-300" />
            </Link>
          )}
        </motion.div>
      </div>

      {/* Quick tiles (F2-05) */}
      <motion.div {...fade(5)} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {TILES.map((t) => (
          <Link key={t.to} to={t.to} className="card card-hover group p-4 sm:p-5">
            <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition group-hover:scale-105', t.cls)}><t.icon className="h-5 w-5" /></span>
            <p className="mt-3 font-bold text-ink-900">{t.label}</p>
            <p className="text-xs text-ink-500 sm:text-sm">{t.desc}</p>
            {t.to === '/mistakes' && s.mistakes.active > 0 && <p className="mt-1 text-xs font-semibold text-rose-600">{s.mistakes.active} active</p>}
            {t.to === '/progress' && s.accuracyOverall != null && <p className="mt-1 text-xs font-semibold text-sky-600">{s.accuracyOverall}% accuracy</p>}
          </Link>
        ))}
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">Recent activity</h2>
            {refreshing && <span className="text-xs text-ink-400">Updating…</span>}
          </div>
          {data.recentActivity.length === 0 ? (
            <p className="rounded-2xl bg-ink-50 p-6 text-center text-sm text-ink-500">Your learning journey starts with today&apos;s challenge. 🚀</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.recentActivity.map((a) => {
                const I = ACTIVITY_ICON[a.type] || Sparkles;
                return (
                  <li key={a.id}>
                    <Link to={a.link || '/home'} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-ink-50">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600"><I className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900">{a.title}</span>
                        <span className="block truncate text-xs text-ink-500">{a.detail}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-ink-400"><Clock className="h-3 w-3" />{timeAgo(a.at)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Snapshot */}
        <Card>
          <h2 className="section-title mb-4">Your week</h2>
          <div className="space-y-4">
            {[
              { icon: Flame, cls: 'bg-flame-100 text-flame-600', label: 'Current streak', value: `${s.currentStreak} day${s.currentStreak === 1 ? '' : 's'}`, hint: `Best: ${s.longestStreak}` },
              { icon: Target, cls: 'bg-brand-100 text-brand-600', label: 'Accuracy (7 days)', value: s.accuracyLast7d != null ? `${s.accuracyLast7d}%` : '—', hint: `Overall ${s.accuracyOverall ?? '—'}%` },
              { icon: NotebookPen, cls: 'bg-rose-100 text-rose-600', label: 'Mistakes resolved', value: `${s.mistakes.resolved}/${s.mistakes.total}`, hint: `${s.mistakes.active} still active` },
              { icon: Trophy, cls: 'bg-gold-100 text-gold-600', label: 'Class rank (weekly)', value: s.rank?.classWeekly ? `#${s.rank.classWeekly}` : '—', hint: 'Updated every 15 min' },
            ].map((x) => (
              <div key={x.label} className="flex items-center gap-3">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', x.cls)}><x.icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-ink-500">{x.label}</p><p className="font-display text-lg font-bold text-ink-900">{x.value}</p></div>
                <span className="text-xs text-ink-400">{x.hint}</span>
              </div>
            ))}
          </div>
          <Button to="/progress" variant="secondary" block className="mt-5" rightIcon={ChevronRight}>See full progress</Button>
        </Card>
      </div>
    </div>
  );
}
