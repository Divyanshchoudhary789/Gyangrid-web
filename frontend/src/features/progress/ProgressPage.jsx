import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Flame, Clock, BookOpen, Target, NotebookPen, Trophy, Info, Zap, Coins, TrendingUp, ArrowRight, CalendarDays, Timer, CheckCircle2 } from 'lucide-react';
import { PageHeader, Card, ProgressBar, ProgressRing, masteryColor, PageSkeleton, ErrorState, Modal, Badge } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { progressApi } from '@/services/api/student';
import { useDocumentTitle } from '@/hooks/useCommon';
import { humanDuration, shortDay, istDateKey } from '@/lib/date';
import { masteryBand, formatNumber, plural } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Every metric can be tapped to see how it is calculated (F9-04). */
const EXPLAIN = {
  accuracy: ['Accuracy', 'Correct answers ÷ questions answered, across the Daily Challenge, practice, tests and reviews for your current class.'],
  trend: ['4-week trend', 'Your accuracy for each week (Monday–Sunday). Weeks when you did not practise are shown as gaps, not zeros.'],
  mastery: ['Mastery score', 'Mastery (0–100) = 55% × accuracy of your last 20 answers + 25% × your recent form (last 5 answers, newer ones count more) + 20% × share of mistakes you have fixed. It appears after 5 attempts. 75+ Strong · 50–74 Partial · below 50 Needs Work.'],
  streak: ['Streak', 'A streak day is earned by completing the Daily Challenge before midnight (India time). Practice alone does not extend it. Your longest streak is kept forever.'],
  syllabus: ['Syllabus touched', 'Topics you have studied or practised ÷ all topics in your class syllabus.'],
  resolution: ['Resolution rate', 'Mistakes you fixed by answering correctly on retry ÷ all mistakes saved.'],
  time: ['Time spent', 'Time spent answering questions plus time reading study material.'],
};

function InfoButton({ k, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(k)} className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-brand-600" aria-label={`How is ${EXPLAIN[k][0]} calculated?`}>
      <Info className="h-4 w-4" />
    </button>
  );
}

function Metric({ label, value, hint, info, onInfo, icon: I, cls }) {
  return (
    <div className="rounded-2xl bg-ink-50 p-4">
      <p className="flex items-center text-xs font-semibold text-ink-500">{I && <I className={cn('mr-1.5 h-4 w-4', cls)} />}{label}{info && <InfoButton k={info} onOpen={onInfo} />}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink-900">{value}</p>
      {hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

export default function ProgressPage() {
  useDocumentTitle('Progress');
  const { data: p, error, loading, refetch } = useQuery('progress', progressApi.get, { persist: true });
  const [explain, setExplain] = useState(null);

  if (loading && !p) return <PageSkeleton rows={4} />;
  if (!p) return <ErrorState error={error} onRetry={refetch} />;
  const { activity: a, learning: l, performance: perf, mistakes: mk, gamification: g } = p;
  const today = istDateKey();

  return (
    <div className="space-y-6">
      <PageHeader title="Your progress" subtitle="See what's working and what to focus on next." />

      {/* Activity */}
      <Card>
        <h2 className="section-title mb-4 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-brand-500" />Activity</h2>
        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {a.week.map((d) => (
            <div key={d.date} className="text-center">
              <div className={cn('mx-auto flex aspect-square w-full max-w-[64px] items-center justify-center rounded-2xl text-lg transition', d.challenge ? 'bg-gradient-to-br from-flame-400 to-flame-600 text-white shadow-md' : d.active ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-300', d.date === today && 'ring-2 ring-brand-500 ring-offset-2')} title={`${d.questions} questions`}>
                {d.challenge ? <Flame className="h-5 w-5 fill-white" /> : d.active ? <CheckCircle2 className="h-5 w-5" /> : '·'}
              </div>
              <p className="mt-1.5 text-xs font-semibold text-ink-500">{shortDay(d.date)}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 flex flex-wrap gap-4 text-xs text-ink-500"><span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-flame-500" />Challenge done</span><span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-brand-100" />Active</span></p>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon={Flame} cls="text-flame-500" label="Current streak" value={plural(a.currentStreak, 'day')} hint={`Longest: ${a.longestStreak}`} info="streak" onInfo={setExplain} />
          <Metric icon={CalendarDays} cls="text-brand-500" label="Active this week" value={`${a.activeDaysWeek}/7`} hint={`${plural(a.activeDaysMonth, 'day')} this month`} />
          <Metric icon={Clock} cls="text-sky-500" label="Time spent" value={humanDuration(a.timeSpentSec)} info="time" onInfo={setExplain} />
          <Metric icon={Target} cls="text-emerald-500" label="Questions" value={formatNumber(perf.questionsAttempted)} hint="answered in total" />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Performance */}
        <Card className="lg:col-span-3">
          <h2 className="section-title mb-1 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-brand-500" />Performance<InfoButton k="trend" onOpen={setExplain} /></h2>
          <p className="muted mb-4">Accuracy by week</p>
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <LineChart data={perf.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#eef0f6" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#667089' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#667089' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip formatter={(v) => (v == null ? 'No activity' : `${v}%`)} contentStyle={{ borderRadius: 12, border: '1px solid #dde1ec' }} />
                <Line type="monotone" dataKey="accuracy" stroke="#6d5dfc" strokeWidth={3} dot={{ r: 5, fill: '#6d5dfc', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} connectNulls={false} name="Accuracy" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Overall accuracy" value={perf.accuracyOverall != null ? `${perf.accuracyOverall}%` : '—'} info="accuracy" onInfo={setExplain} />
            <Metric label="Avg time / question" value={perf.avgTimePerQuestionSec != null ? `${perf.avgTimePerQuestionSec}s` : '—'} />
            <Metric label="Tests taken" value={perf.testsAttempted} />
            <Metric label="Avg test score" value={perf.testsAvgScorePct != null ? `${perf.testsAvgScorePct}%` : '—'} />
          </div>
        </Card>

        {/* Strong / weak — framed as next steps (F9-05) */}
        <Card className="lg:col-span-2">
          <h2 className="section-title mb-4">Strengths & next steps</h2>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-600">You&apos;re strong in</p>
          {perf.strong.length ? (
            <ul className="space-y-2">{perf.strong.map((t) => <li key={t.topicId} className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm"><span className="truncate font-semibold text-emerald-900">💪 {t.name}</span><Badge tone="success">{t.mastery}</Badge></li>)}</ul>
          ) : <p className="text-sm text-ink-500">Answer 5+ questions on a topic to see strengths.</p>}
          <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-brand-600">Focus next on</p>
          {perf.weak.length ? (
            <ul className="space-y-2">
              {perf.weak.map((t) => (
                <li key={t.topicId}>
                  <Link to={`/learn/topic/${t.topicId}`} className="flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm transition hover:bg-brand-100">
                    <span className="truncate font-semibold text-brand-900">🎯 {t.name}</span><ArrowRight className="h-4 w-4 shrink-0 text-brand-500" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-500">No weak topics right now — great work!</p>}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="section-title mb-4 flex items-center gap-2"><BookOpen className="h-5 w-5 text-sky-500" />Learning</h2>
          <div className="flex items-center gap-4">
            <ProgressRing value={l.syllabusTouchedPct} size={84} stroke={8} tone="#0ea5e9"><span className="font-display text-lg font-bold">{l.syllabusTouchedPct}%</span></ProgressRing>
            <p className="text-sm text-ink-600">of your syllabus touched<InfoButton k="syllabus" onOpen={setExplain} /></p>
          </div>
          <ul className="mt-5 space-y-2 text-sm">
            {[['Chapters opened', `${l.chaptersOpened}/${l.totalChapters}`], ['Topics studied', `${l.topicsStudied}/${l.totalTopics}`], ['Topics mastered', l.topicsCompleted], ['Material views', l.materialViews]].map(([k, v]) => (
              <li key={k} className="flex justify-between"><span className="text-ink-500">{k}</span><span className="font-bold text-ink-900">{v}</span></li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="section-title mb-4 flex items-center gap-2"><NotebookPen className="h-5 w-5 text-rose-500" />Mistakes</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Total', mk.total, 'text-ink-900'], ['Active', mk.active, 'text-amber-600'], ['Resolved', mk.resolved, 'text-emerald-600']].map(([k, v, c]) => (
              <div key={k} className="rounded-xl bg-ink-50 py-3"><p className={cn('font-display text-xl font-bold', c)}>{v}</p><p className="text-xs text-ink-500">{k}</p></div>
            ))}
          </div>
          <div className="mt-4"><div className="mb-1.5 flex items-center justify-between text-sm"><span className="flex items-center text-ink-500">Resolution rate<InfoButton k="resolution" onOpen={setExplain} /></span><span className="font-bold">{mk.resolutionRate ?? 0}%</span></div><ProgressBar value={mk.resolutionRate ?? 0} tone="success" /></div>
          {mk.mostRepeatedTopic && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Most repeated: <strong>{mk.mostRepeatedTopic.name}</strong>{mk.mostRepeatedTopic.count ? ` (${mk.mostRepeatedTopic.count}×)` : ''}</p>}
          <Link to="/mistakes" className="mt-4 inline-flex text-sm font-bold text-brand-600 hover:underline">Open Mistake Bank →</Link>
        </Card>
        <Card>
          <h2 className="section-title mb-4 flex items-center gap-2"><Trophy className="h-5 w-5 text-gold-500" />Rewards</h2>
          <div className="flex items-center gap-4">
            <ProgressRing value={g.levelProgress} size={84} stroke={8} tone="#6d5dfc"><div className="text-center"><p className="text-[10px] font-bold uppercase text-ink-400">Level</p><p className="font-display text-xl font-bold">{g.level}</p></div></ProgressRing>
            <div className="text-sm"><p className="font-bold text-ink-900">{formatNumber(g.totalXp)} XP</p><p className="text-ink-500">{g.xpToNextLevel} XP to level {g.level + 1}</p></div>
          </div>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex justify-between"><span className="flex items-center gap-1.5 text-ink-500"><Coins className="h-4 w-4 text-gold-500" />Gold Coins</span><span className="font-bold">{g.goldCoins}</span></li>
            <li className="flex justify-between"><span className="flex items-center gap-1.5 text-ink-500"><Trophy className="h-4 w-4 text-brand-500" />Weekly rank</span><span className="font-bold">{g.rank ? `#${g.rank}${g.classSize ? ` of ${g.classSize}` : ''}` : '—'}</span></li>
            <li className="flex justify-between"><span className="flex items-center gap-1.5 text-ink-500"><Zap className="h-4 w-4 text-flame-500" />Streak</span><span className="font-bold">{plural(g.currentStreak, 'day')}</span></li>
          </ul>
          <Link to="/rewards" className="mt-4 inline-flex text-sm font-bold text-brand-600 hover:underline">See rewards →</Link>
        </Card>
      </div>

      {/* Mastery map */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title flex items-center">Topic mastery<InfoButton k="mastery" onOpen={setExplain} /></h2>
          <div className="flex flex-wrap gap-3 text-xs font-semibold text-ink-500">
            {[['bg-emerald-500', 'Strong 75+'], ['bg-amber-400', 'Partial 50–74'], ['bg-rose-400', 'Needs work'], ['bg-ink-200', 'Not enough data']].map(([c, t]) => <span key={t} className="flex items-center gap-1.5"><span className={cn('h-3 w-3 rounded', c)} />{t}</span>)}
          </div>
        </div>
        <div className="space-y-4">
          {p.mastery.map((ch) => (
            <div key={ch.chapterId}>
              <Link to={`/learn/chapter/${ch.chapterId}`} className="text-sm font-bold text-ink-800 hover:text-brand-600">{ch.number}. {ch.name}</Link>
              <div className="mt-2 flex flex-wrap gap-2">
                {ch.topics.map((t) => {
                  const b = masteryBand(t.mastery);
                  return (
                    <Link key={t.topicId} to={`/learn/topic/${t.topicId}`} title={`${t.name}: ${b.label}${t.attempts ? ` (${t.attempts} attempts)` : ''}`}
                      className="flex items-center gap-2 rounded-xl border border-ink-100 bg-white py-1.5 pl-1.5 pr-3 text-xs font-semibold text-ink-700 transition hover:border-brand-200 hover:shadow-sm"
                    >
                      <span className="flex h-7 min-w-7 items-center justify-center rounded-lg px-1 text-[11px] font-bold text-white" style={{ background: masteryColor(t.mastery) }}>{t.mastery ?? '–'}</span>
                      <span className="max-w-[180px] truncate">{t.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Link to="/tests" className="flex items-center justify-center gap-2 text-sm font-semibold text-ink-500 hover:text-brand-600"><Timer className="h-4 w-4" />Ready to measure your progress? Take a test</Link>

      <Modal open={Boolean(explain)} onClose={() => setExplain(null)} title={explain ? EXPLAIN[explain][0] : ''} size="sm">
        <p className="leading-relaxed text-ink-700">{explain && EXPLAIN[explain][1]}</p>
      </Modal>
    </div>
  );
}
