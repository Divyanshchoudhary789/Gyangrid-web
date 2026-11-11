import { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, BarChart, Bar,
} from 'recharts';
import {
  Users, Activity, Target, MessageCircleQuestion, Cpu, IndianRupee,
  ShieldAlert, ListChecks, Download, RefreshCw, TrendingUp, TrendingDown,
  Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card, Stat, PageSkeleton, ErrorState, Button, ProgressBar, ProgressRing, Alert,
} from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { AdminPageHeader } from './adminShared';

/* ─── CSV helpers (unchanged) ────────────────────────────────────────────── */
function toCsv(rows) {
  const keys = Object.keys(rows[0] || {});
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
}

const humanKey = (k) =>
  String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Flattens the backend analytics object into labelled metrics, grouped by its top-level sections. */
function analyticsGroups(analytics) {
  const groups = [];
  const top = [];
  const walk = (obj, prefix, out) => {
    Object.entries(obj || {}).forEach(([k, v]) => {
      const label = prefix ? `${prefix} · ${humanKey(k)}` : humanKey(k);
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') out.push({ label, value: v });
      else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, label, out);
    });
  };
  Object.entries(analytics || {}).forEach(([k, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const items = [];
      walk(v, '', items);
      if (items.length) groups.push({ title: humanKey(k), items });
    } else if (typeof v === 'number' || typeof v === 'string') top.push({ label: humanKey(k), value: v });
  });
  if (top.length) groups.unshift({ title: 'Overview', items: top });
  return groups;
}

const fmtMetric = (v) =>
  typeof v === 'number' ? formatNumber(Math.round(v * 100) / 100) : String(v);

/* ─── Shared chart tooltip style ─────────────────────────────────────────── */
const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #dde1ec',
  boxShadow: '0 4px 16px -4px rgba(20,26,43,.12)',
  fontSize: 12,
};

/* ─── KPI card (enhanced Stat) ───────────────────────────────────────────── */
function KpiCard({ icon: I, label, value, hint, tone = 'brand', trend }) {
  const toneMap = {
    brand:   { icon: 'bg-brand-50 text-brand-600',   border: 'border-brand-100' },
    success: { icon: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100' },
    info:    { icon: 'bg-sky-50 text-sky-600',         border: 'border-sky-100' },
    gold:    { icon: 'bg-gold-50 text-gold-600',       border: 'border-gold-100' },
    danger:  { icon: 'bg-rose-50 text-rose-600',       border: 'border-rose-100' },
  };
  const { icon: iconCls } = toneMap[tone] || toneMap.brand;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="card flex items-start gap-4 rounded-2xl p-4 shadow-card"
    >
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconCls)}>
        <I className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        <div className="mt-0.5 flex items-end gap-2">
          <p className="break-words font-display text-2xl font-bold leading-tight text-ink-900">{value}</p>
          {trend != null && (
            trend > 0
              ? <TrendingUp className="mb-0.5 h-4 w-4 text-emerald-500" aria-label="Trending up" />
              : <TrendingDown className="mb-0.5 h-4 w-4 text-rose-500" aria-label="Trending down" />
          )}
        </div>
        {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
      </div>
    </motion.div>
  );
}

/* ─── Accuracy colour ─────────────────────────────────────────────────────── */
const accuracyColor = (pct) => {
  if (pct >= 70) return 'from-emerald-400 to-emerald-500';
  if (pct >= 40) return 'from-amber-400 to-amber-500';
  return 'from-rose-400 to-rose-500';
};

/* ─── Collapsible accordion section for AnalyticsOverview ──────────────── */
function AccordionSection({ title, items }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="overflow-hidden p-0 shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-ink-50"
        aria-expanded={open}
      >
        <h2 className="section-title">{title}</h2>
        {open
          ? <ChevronUp className="h-4 w-4 text-ink-400" aria-hidden />
          : <ChevronDown className="h-4 w-4 text-ink-400" aria-hidden />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
              {items.map((i) => (
                <div
                  key={i.label}
                  className="rounded-xl border border-ink-100 bg-ink-50/50 p-3 transition hover:border-brand-200 hover:bg-brand-50/30"
                >
                  <p className="text-xs font-semibold text-ink-500">{i.label}</p>
                  <p className="mt-1 font-display text-xl font-bold text-ink-900">{fmtMetric(i.value)}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/* ─── AI Budget ring ──────────────────────────────────────────────────────── */
function AiBudgetRing({ pct }) {
  const color = pct >= 80 ? '#f43f5e' : pct >= 60 ? '#f59e0b' : '#6d5dfc';
  return (
    <div className="flex flex-col items-center gap-2">
      <ProgressRing value={pct} size={80} stroke={8} tone={color} label={`AI budget ${pct}% used`}>
        <span className="font-display text-sm font-bold text-ink-900">{pct}%</span>
      </ProgressRing>
      <p className="text-center text-xs font-semibold text-ink-500">AI budget used</p>
    </div>
  );
}

/* ─── Last-updated bar ────────────────────────────────────────────────────── */
function RefreshBar({ lastUpdated, onRefresh }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 bg-white px-4 py-2.5 shadow-card">
      <div className="flex items-center gap-2 text-xs text-ink-400">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        <span>
          Last updated{' '}
          <span className="font-semibold text-ink-600">
            {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}
          </span>
        </span>
        <span className="hidden sm:inline">· Auto-refresh every 60s</span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
        aria-label="Refresh dashboard"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Refresh
      </button>
    </div>
  );
}

/* ─── AnalyticsOverview (real backend path) ───────────────────────────────── */
function AnalyticsOverview({ data, onRefresh }) {
  const { analytics, series = [], weakTopics = [], aiBudgetUsedPct = null } = data;
  const groups = analyticsGroups(analytics);
  const exportCsv = () => {
    const rows = groups.flatMap((g) => g.items.map((i) => ({ section: g.title, metric: i.label, value: i.value })));
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gyaangrid-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        subtitle="Live platform summary from the backend analytics service."
        action={
          <>
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={!groups.length}
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden />
              Export CSV
            </Button>
          </>
        }
      />

      <RefreshBar lastUpdated={Date.now()} onRefresh={onRefresh} />

      {aiBudgetUsedPct != null && aiBudgetUsedPct >= 80 && (
        <Alert tone="warning" title="AI budget alert">
          {aiBudgetUsedPct}% of this month&apos;s AI budget has been used.
        </Alert>
      )}

      {/* AI budget ring + series charts */}
      {(aiBudgetUsedPct != null || series.length > 0) && (
        <div className="grid gap-6 xl:grid-cols-3">
          {series.length > 0 && (
            <Card className="xl:col-span-2 shadow-card">
              <h2 className="section-title mb-4">Daily active students &amp; challenges (14 days)</h2>
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={series} margin={{ left: -10, right: 8 }}>
                    <defs>
                      <linearGradient id="rdau" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#6d5dfc" stopOpacity={0.35} />
                        <stop offset="1" stopColor="#6d5dfc" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="rch" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="1" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#eef0f6" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#667089' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#667089' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="dau" name="Active students" stroke="#6d5dfc" strokeWidth={2.5} fill="url(#rdau)" dot={false} />
                    <Area type="monotone" dataKey="challenges" name="Challenges" stroke="#10b981" strokeWidth={2.5} fill="url(#rch)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="shadow-card">
            {aiBudgetUsedPct != null && (
              <div className="mb-6 flex flex-col items-center">
                <AiBudgetRing pct={aiBudgetUsedPct} />
                <p className="mt-2 text-center text-xs text-ink-400">Alert fires at 80% of monthly budget</p>
              </div>
            )}
            {series.length > 0 && (
              <>
                <h3 className="mb-2 text-sm font-bold text-ink-700">New registrations per day</h3>
                <div className="h-32">
                  <ResponsiveContainer>
                    <BarChart data={series.slice(-7)}>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#667089' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="registrations" name="Registrations" fill="#8a7cfd" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Weak topics */}
      {weakTopics.length > 0 && (
        <Card className="shadow-card">
          <h2 className="section-title mb-4">Weakest topics across all students</h2>
          <div className="space-y-2">
            {weakTopics.map((t, idx) => (
              <div key={t.topicId} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-600">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink-800">{t.name}</span>
                    <span className="shrink-0 font-bold text-rose-600">{t.accuracy}%</span>
                  </div>
                  {t.classId && <p className="text-xs text-ink-400">Class {t.classId}</p>}
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-700', accuracyColor(t.accuracy))}
                      style={{ width: `${t.accuracy}%` }}
                      role="progressbar"
                      aria-valuenow={t.accuracy}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${t.name} accuracy`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Analytics accordion groups */}
      {groups.length === 0 ? (
        <Alert tone="info" title="No analytics yet">
          The analytics endpoint returned no metrics. They appear here as soon as students start using the app.
        </Alert>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <AccordionSection key={g.title} title={g.title} items={g.items} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main dashboard page (mock/KPI path) ────────────────────────────────── */
export default function DashboardPage() {
  useDocumentTitle('Admin dashboard');
  const { data, error, loading, refetch } = useQuery('admin:dashboard', adminApi.dashboard, { staleMs: 60000 });

  if (loading && !data) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <PageSkeleton />
      </motion.div>
    );
  }
  if (!data) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <ErrorState error={error} onRetry={refetch} />
      </motion.div>
    );
  }
  if (data.analytics) return <AnalyticsOverview data={data} onRefresh={refetch} />;

  const k = data.kpis;

  const exportCsv = () => {
    const blob = new Blob([toCsv(data.series)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gyaangrid-daily-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        subtitle={`Live overview · remote config v${data.configVersion}`}
        action={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        }
      />

      <RefreshBar lastUpdated={Date.now()} onRefresh={refetch} />

      {k.monthBudgetUsedPct >= 80 && (
        <Alert tone="warning" title="AI budget alert">
          80% of this month&apos;s cohort AI budget has been used.
        </Alert>
      )}

      {/* KPI grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users}                 label="Registrations"       value={formatNumber(k.registrations)}                         tone="brand"   />
        <KpiCard icon={Activity}              label="DAU / WAU"           value={`${formatNumber(k.dau)} / ${formatNumber(k.wau)}`}     tone="info"    />
        <KpiCard icon={Target}                label="Challenge completion" value={`${k.challengeCompletion}%`}                           tone="success" hint="target ≥ 60%" trend={k.challengeCompletion >= 60 ? 1 : -1} />
        <KpiCard icon={MessageCircleQuestion} label="Doubts today"        value={formatNumber(k.doubtsToday)}                           tone="brand"   />
        <KpiCard icon={Cpu}                   label="AI tokens today"     value={`${(k.aiTokensToday / 1e6).toFixed(2)}M`}              tone="info"    />
        <KpiCard icon={IndianRupee}           label="AI cost today"       value={`₹${formatNumber(k.aiCostTodayInr)}`}                  tone="gold"    />
        <KpiCard icon={ShieldAlert}           label="Open moderation"     value={k.openModeration}                                      tone="danger"  trend={k.openModeration > 0 ? -1 : 1} />
        <KpiCard icon={ListChecks}            label="Approved questions"  value={formatNumber(k.approvedQuestions)}                     tone="success" hint={`${k.reviewQueue} in review`} />
      </div>

      {/* Charts + AI budget */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 shadow-card">
          <h2 className="section-title mb-4">Daily active students &amp; challenges (14 days)</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={data.series} margin={{ left: -10, right: 8 }}>
                <defs>
                  <linearGradient id="dau" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#6d5dfc" stopOpacity={0.35} />
                    <stop offset="1" stopColor="#6d5dfc" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ch" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="1" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef0f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#667089' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#667089' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="dau" name="DAU" stroke="#6d5dfc" strokeWidth={2.5} fill="url(#dau)" dot={false} />
                <Area type="monotone" dataKey="challenges" name="Challenges" stroke="#10b981" strokeWidth={2.5} fill="url(#ch)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="shadow-card">
          <div className="mb-4 flex flex-col items-center">
            <AiBudgetRing pct={k.monthBudgetUsedPct} />
            <p className="mt-2 text-center text-xs text-ink-400">Alert fires at 80% of monthly budget</p>
          </div>

          <h3 className="mb-2 text-sm font-bold text-ink-700">Doubts per day</h3>
          <div className="h-32">
            <ResponsiveContainer>
              <BarChart data={data.series.slice(-7)}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#667089' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="doubts" name="Doubts" fill="#8a7cfd" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Weak topics ranked list */}
      <Card className="shadow-card">
        <h2 className="section-title mb-4">Cohort-wide weakest topics</h2>
        <div className="space-y-2">
          {data.weakTopics.map((t, idx) => (
            <div key={t.topicId} className="flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-50/40 p-3 transition hover:border-brand-200 hover:bg-brand-50/20">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-200 text-xs font-bold text-ink-700">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink-800">{t.name}</span>
                  <span className="shrink-0 font-bold text-rose-600">{t.accuracy}%</span>
                </div>
                <p className="text-xs text-ink-400">Class {t.classId}</p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-700', accuracyColor(t.accuracy))}
                    style={{ width: `${t.accuracy}%` }}
                    role="progressbar"
                    aria-valuenow={t.accuracy}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${t.name} accuracy`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
