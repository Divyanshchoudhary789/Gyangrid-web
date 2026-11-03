import { TrendingUp, TrendingDown, CalendarDays, Target, Timer, Percent } from 'lucide-react';

const fmt = (key) => (key ? new Date(`${key}T12:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
export const weekLabel = (start, end) => `${fmt(start)} – ${fmt(end)}`;

/** The report body shared by the student's preview and the parent's signed-link page. */
export function ParentReportCard({ report, name = 'Your child' }) {
  const g = report.atAGlance;
  const tiles = [
    { icon: CalendarDays, value: g.daysActive, label: 'days active', cls: 'bg-sky-50 text-sky-600' },
    { icon: Target, value: g.challengesDone, label: 'challenges', cls: 'bg-emerald-50 text-emerald-600' },
    { icon: Timer, value: g.testsTaken, label: 'tests', cls: 'bg-violet-50 text-violet-600' },
    { icon: Percent, value: g.accuracy != null ? `${Math.round(g.accuracy)}%` : '—', label: 'accuracy', cls: 'bg-gold-50 text-gold-600' },
  ];
  const quiet = !g.daysActive && !g.challengesDone && !g.testsTaken;
  return (
    <div className="space-y-6">
      {quiet && <p className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">It was a quiet week for {name}. A 6-minute Daily Challenge is a great way to get back into the rhythm. 🌱</p>}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-400">At a glance</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl border border-ink-100 p-3 text-center">
              <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl ${t.cls}`}><t.icon className="h-4 w-4" aria-hidden /></span>
              <p className="mt-2 font-display text-2xl font-bold text-ink-900">{t.value}</p>
              <p className="text-xs text-ink-500">{t.label}</p>
            </div>
          ))}
        </div>
        {g.accuracyChange != null && g.accuracyChange !== 0 && (
          <p className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${g.accuracyChange > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {g.accuracyChange > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            Accuracy {g.accuracyChange > 0 ? 'up' : 'down'} {Math.abs(g.accuracyChange)} points from the week before
          </p>
        )}
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-emerald-50/70 p-4">
          <h2 className="mb-2 text-sm font-bold text-emerald-800">Doing well</h2>
          {report.strongTopics.length ? <ul className="space-y-1 text-sm text-ink-800">{report.strongTopics.map((t) => <li key={t}>• {t}</li>)}</ul> : <p className="text-sm text-ink-500">Not enough practice yet to tell.</p>}
        </div>
        <div className="rounded-2xl bg-amber-50/70 p-4">
          <h2 className="mb-2 text-sm font-bold text-amber-800">Worth focusing on</h2>
          {report.focusTopics.length ? <ul className="space-y-1 text-sm text-ink-800">{report.focusTopics.map((t) => <li key={t}>• {t}</li>)}</ul> : <p className="text-sm text-ink-500">Nothing stands out this week.</p>}
        </div>
      </section>
    </div>
  );
}
