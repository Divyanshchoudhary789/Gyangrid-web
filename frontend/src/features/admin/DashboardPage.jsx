import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { Users, Activity, Target, MessageCircleQuestion, Cpu, IndianRupee, ShieldAlert, ListChecks, Download } from 'lucide-react';
import { Card, Stat, PageSkeleton, ErrorState, Button, ProgressBar, Alert } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatNumber } from '@/lib/format';
import { AdminPageHeader } from './adminShared';

function toCsv(rows) {
  const keys = Object.keys(rows[0] || {});
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
}

export default function DashboardPage() {
  useDocumentTitle('Admin dashboard');
  const { data, error, loading, refetch } = useQuery('admin:dashboard', adminApi.dashboard, { staleMs: 60000 });
  if (loading && !data) return <PageSkeleton />;
  if (!data) return <ErrorState error={error} onRetry={refetch} />;
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
      <AdminPageHeader title="Dashboard" subtitle={`Live overview · remote config v${data.configVersion}`} action={<Button variant="outline" leftIcon={Download} onClick={exportCsv}>Export CSV</Button>} />
      {k.monthBudgetUsedPct >= 80 && <Alert tone="warning" title="AI budget alert">80% of this month&apos;s cohort AI budget has been used.</Alert>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Registrations" value={formatNumber(k.registrations)} />
        <Stat icon={Activity} tone="info" label="DAU / WAU" value={`${formatNumber(k.dau)} / ${formatNumber(k.wau)}`} />
        <Stat icon={Target} tone="success" label="Challenge completion" value={`${k.challengeCompletion}%`} hint="target ≥ 60%" />
        <Stat icon={MessageCircleQuestion} tone="brand" label="Doubts today" value={formatNumber(k.doubtsToday)} />
        <Stat icon={Cpu} tone="info" label="AI tokens today" value={`${(k.aiTokensToday / 1e6).toFixed(2)}M`} />
        <Stat icon={IndianRupee} tone="gold" label="AI cost today" value={`₹${formatNumber(k.aiCostTodayInr)}`} />
        <Stat icon={ShieldAlert} tone="danger" label="Open moderation" value={k.openModeration} />
        <Stat icon={ListChecks} tone="success" label="Approved questions" value={formatNumber(k.approvedQuestions)} hint={`${k.reviewQueue} in review`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h2 className="section-title mb-4">Daily active students & challenges (14 days)</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={data.series} margin={{ left: -10, right: 8 }}>
                <defs>
                  <linearGradient id="dau" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6d5dfc" stopOpacity={0.35} /><stop offset="1" stopColor="#6d5dfc" stopOpacity={0} /></linearGradient>
                  <linearGradient id="ch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity={0.3} /><stop offset="1" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#eef0f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#667089' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#667089' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #dde1ec' }} />
                <Area type="monotone" dataKey="dau" name="DAU" stroke="#6d5dfc" strokeWidth={2.5} fill="url(#dau)" />
                <Area type="monotone" dataKey="challenges" name="Challenges" stroke="#10b981" strokeWidth={2.5} fill="url(#ch)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="section-title mb-4">AI budget (month)</h2>
          <p className="font-display text-3xl font-bold">{k.monthBudgetUsedPct}%</p>
          <ProgressBar value={k.monthBudgetUsedPct} tone={k.monthBudgetUsedPct >= 80 ? 'danger' : 'brand'} className="mt-3" />
          <p className="mt-2 text-xs text-ink-500">Alert fires at 80% of the monthly cohort budget.</p>
          <h3 className="mb-2 mt-6 text-sm font-bold">Doubts per day</h3>
          <div className="h-32">
            <ResponsiveContainer>
              <BarChart data={data.series.slice(-7)}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#667089' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12 }} />
                <Bar dataKey="doubts" name="Doubts" fill="#8a7cfd" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="section-title mb-4">Cohort-wide weakest topics</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.weakTopics.map((t) => (
            <div key={t.topicId} className="rounded-xl border border-ink-100 p-3">
              <div className="flex items-center justify-between text-sm"><span className="truncate font-semibold">{t.name}</span><span className="font-bold text-rose-600">{t.accuracy}%</span></div>
              <p className="text-xs text-ink-500">Class {t.classId}</p>
              <ProgressBar value={t.accuracy} tone="danger" size="sm" className="mt-2" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
