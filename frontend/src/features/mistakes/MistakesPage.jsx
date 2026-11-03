import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ChevronRight, CalendarClock, Repeat, CheckCircle2, Archive, AlertCircle, Eye } from 'lucide-react';
import { PageHeader, Tabs, TextField, SelectField, Badge, EmptyState, ErrorState, Skeleton, Card } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { useQuery } from '@/hooks/useQuery';
import { mistakeApi } from '@/services/api/student';
import { useDebounced, useDocumentTitle } from '@/hooks/useCommon';
import { SOURCE_LABELS } from '@/config/constants';
import { formatDate, istDateKey } from '@/lib/date';

const STATUS_LABELS = { DUE: 'Due today', ACTIVE: 'Active', REVIEWED: 'Reviewed', RESOLVED: 'Resolved', ARCHIVED: 'Archived', ALL: 'All' };
// The API declares which statuses it supports; the local mock supports the full PRD set.
const STATUS_TABS = (mistakeApi.statuses || ['DUE', 'ACTIVE', 'RESOLVED', 'ARCHIVED', 'ALL']).map((value) => ({ value, label: STATUS_LABELS[value] || value }));
const HAS_DUE = STATUS_TABS.some((t) => t.value === 'DUE');

export default function MistakesPage() {
  useDocumentTitle('Mistake Bank');
  const [params, setParams] = useSearchParams();
  const status = params.get('due') === 'true' ? 'DUE' : params.get('status') || 'ACTIVE';
  const [search, setSearch] = useState(params.get('q') || '');
  const q = useDebounced(search, 300);
  const query = useMemo(() => ({
    status: status === 'DUE' ? 'ACTIVE' : status,
    due: status === 'DUE' ? 'true' : undefined,
    chapterId: params.get('chapterId') || undefined,
    topicId: params.get('topicId') || undefined,
    source: params.get('source') || undefined,
    sort: params.get('sort') || 'RECENT',
    q: q || undefined,
  }), [status, params, q]);
  const key = `mistakes:${JSON.stringify(query)}`;
  const { data, error, loading, refetch } = useQuery(key, () => mistakeApi.list(query), { staleMs: 5000 });

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  const setStatus = (v) => update({ status: v === 'DUE' ? null : v, due: v === 'DUE' ? 'true' : null });

  const counts = data?.counts;
  const today = istDateKey();

  return (
    <div>
      <PageHeader
        title="Mistake Bank"
        subtitle={HAS_DUE
          ? 'Every wrong answer is saved here with its full solution. Fix them to earn XP — each one comes back in 3 days until you do.'
          : 'Every wrong answer is saved here automatically with its solution. Review them, then mark them resolved once you understand.'}
      />
      {counts && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            HAS_DUE
              ? { label: 'Due today', value: counts.DUE, icon: CalendarClock, cls: 'text-rose-600 bg-rose-50' }
              : { label: 'Reviewed', value: counts.REVIEWED, icon: Eye, cls: 'text-sky-600 bg-sky-50' },
            { label: 'Active', value: counts.ACTIVE, icon: AlertCircle, cls: 'text-amber-600 bg-amber-50' },
            { label: 'Resolved', value: counts.RESOLVED, icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' },
            { label: 'Resolution rate', value: counts.ALL ? `${Math.round(((counts.RESOLVED || 0) / counts.ALL) * 100)}%` : '—', icon: Repeat, cls: 'text-brand-600 bg-brand-50' },
          ].map((s) => (
            <Card key={s.label} className="flex items-center gap-3 p-4 sm:p-4">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.cls}`}><s.icon className="h-5 w-5" /></span>
              <div><p className="font-display text-xl font-bold">{s.value ?? '—'}</p><p className="text-xs font-semibold text-ink-500">{s.label}</p></div>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <Tabs value={status} onChange={setStatus} tabs={STATUS_TABS.map((t) => ({ ...t, count: counts?.[t.value] ?? undefined }))} />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,1fr)_180px_160px_170px]">
          <TextField className="sm:col-span-3 lg:col-span-1" icon={Search} placeholder="Search by keyword or topic…" value={search} onChange={(e) => { setSearch(e.target.value); }} aria-label="Search mistakes" />
          <SelectField aria-label="Chapter" value={params.get('chapterId') || ''} onChange={(e) => update({ chapterId: e.target.value, topicId: null })} placeholder="All chapters" options={(data?.chapters || []).map((c) => ({ value: c.id, label: c.name }))} />
          <SelectField aria-label="Source" value={params.get('source') || ''} onChange={(e) => update({ source: e.target.value })} placeholder="All sources" options={Object.entries(SOURCE_LABELS).filter(([value]) => !mistakeApi.capabilities || value !== 'DOUBT').map(([value, label]) => ({ value, label }))} />
          <SelectField aria-label="Sort" value={params.get('sort') || 'RECENT'} onChange={(e) => update({ sort: e.target.value })} options={[{ value: 'RECENT', label: 'Most recent' }, { value: 'REPEATED', label: 'Most repeated' }]} />
        </div>
        {params.get('topicId') && (
          <div><button type="button" onClick={() => update({ topicId: null })} className="chip bg-brand-100 text-brand-700 hover:bg-brand-200">Filtered to one topic ✕</button></div>
        )}
      </div>

      {loading && !data ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState
          emoji={status === 'DUE' ? '🎉' : status === 'RESOLVED' ? '🌱' : '✨'}
          title={status === 'DUE' ? 'Nothing due today' : q ? 'No matching mistakes' : 'Nothing here yet'}
          description={status === 'DUE' ? 'All caught up! Mistakes come back for review 3 days after you last tried them.' : q ? 'Try a different word or topic name.' : 'Wrong answers from challenges, practice and tests will appear here automatically.'}
        />
      ) : (
        <ul className="space-y-3">
          {data.items.map((m) => (
            <li key={m.id}>
              <Link to={`/mistakes/${encodeURIComponent(m.id)}`} className="card card-hover flex items-start gap-4 p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {m.due && <Badge tone="danger" icon={CalendarClock}>Due</Badge>}
                    {m.status === 'RESOLVED' && <Badge tone="success" icon={CheckCircle2}>Resolved</Badge>}
                    {m.status === 'ARCHIVED' && <Badge icon={Archive}>Archived</Badge>}
                    {m.status === 'REVIEWED' && <Badge tone="info" icon={Eye}>Reviewed</Badge>}
                    {m.kind === 'CONCEPT' && <Badge tone="info">Concept</Badge>}
                    {m.topicName && <Badge tone="brand">{m.topicName}</Badge>}
                    {m.sources.map((s) => <Badge key={s}>{SOURCE_LABELS[s] || s}</Badge>)}
                    {m.wrongCount > 1 && <Badge tone="warning" icon={Repeat}>×{m.wrongCount}</Badge>}
                  </div>
                  <MathText as="p" text={m.questionText} className="line-clamp-2 font-medium text-ink-900" />
                  <p className="mt-2 text-xs text-ink-500">
                    {m.chapterName} · last tried {formatDate(m.lastAttemptAt, { day: 'numeric', month: 'short' })}
                    {m.status === 'ACTIVE' && !m.due && m.nextReviewAt && ` · review on ${formatDate(`${m.nextReviewAt}T12:00:00+05:30`, { day: 'numeric', month: 'short' })}`}
                    {m.status === 'ACTIVE' && m.nextReviewAt && m.nextReviewAt < today && ' · overdue'}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
