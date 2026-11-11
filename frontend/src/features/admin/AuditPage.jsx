import { useState } from 'react';
import {
  Lock, Search, Eye, Shield, FileEdit, Trash2, PlusCircle,
  RefreshCw, ChevronDown, Funnel, Calendar, AlertCircle,
} from 'lucide-react';
import { PageSkeleton, ErrorState } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { useDebounced, useDocumentTitle } from '@/hooks/useCommon';
import { formatDateTime } from '@/lib/date';
import { cn } from '@/lib/cn';
import { AdminPageHeader, AdminSearchBar, AdminTable } from './adminShared';

/* ─── helpers ──────────────────────────────────────────────────────────────── */

const fmt = (v) => (v == null ? '—' : JSON.stringify(v));

/** Relative time (e.g. "3 min ago"). Falls back to absolute. */
function relativeTime(isoString) {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(isoString);
}

/** Classify an action string into a visual category. */
function actionCategory(action = '') {
  const a = String(action).toUpperCase();
  if (a.includes('DELETE') || a.includes('REMOVE') || a.includes('REVOKE')) return 'danger';
  if (a.includes('CREATE') || a.includes('ADD') || a.includes('PUBLISH') || a.includes('APPROVE')) return 'success';
  if (a.includes('CONFIG') || a.includes('UPDATE') || a.includes('SET') || a.includes('CHANGE')) return 'warning';
  return 'info'; // reads / lists / views
}

const ACTION_PILL = {
  danger:  'bg-rose-50   text-rose-700   ring-1 ring-rose-200',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  warning: 'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
  info:    'bg-sky-50    text-sky-600    ring-1 ring-sky-200',
};

const TIMELINE_DOT = {
  danger:  'bg-rose-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  info:    'bg-sky-500',
};

const ROLE_BADGE = {
  SUPER_ADMIN:     'bg-brand-100 text-brand-700',
  CONTENT_MANAGER: 'bg-indigo-100 text-indigo-700',
  SUPPORT:         'bg-gold-100 text-gold-700',
};

const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'CREATE', label: 'Creates' },
  { value: 'UPDATE', label: 'Updates / Config' },
  { value: 'DELETE', label: 'Deletions' },
  { value: 'READ',   label: 'Reads / Views' },
];

/* ─── sub-components ───────────────────────────────────────────────────────── */

function ActionPill({ action }) {
  const cat = actionCategory(action);
  return (
    <span className={cn('inline-block rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold tracking-tight', ACTION_PILL[cat])}>
      {action}
    </span>
  );
}

function DiffViewer({ before, after }) {
  if (before == null && after == null) return <span className="text-xs text-ink-400">—</span>;
  return (
    <details className="group text-xs">
      <summary className="cursor-pointer select-none list-none text-ink-400 hover:text-ink-700 transition-colors flex items-center gap-1 font-medium">
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
        Diff
      </summary>
      <div className="mt-2 flex flex-col gap-1 rounded-lg border border-ink-100 bg-ink-50 p-2">
        {before != null && (
          <div className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-[10px] font-bold text-rose-500 w-10">before</span>
            <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-rose-700 bg-rose-50 rounded px-1.5 py-0.5 flex-1 border border-rose-100">{fmt(before)}</pre>
          </div>
        )}
        {after != null && (
          <div className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-[10px] font-bold text-emerald-500 w-10">after</span>
            <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 flex-1 border border-emerald-100">{fmt(after)}</pre>
          </div>
        )}
      </div>
    </details>
  );
}

function TimelineEntry({ entry }) {
  const cat = actionCategory(entry.action);

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0 group">
      {/* Vertical line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow-sm',
            TIMELINE_DOT[cat],
          )}
          aria-hidden="true"
        />
        <div className="mt-1.5 flex-1 w-px bg-ink-100 group-last:hidden" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="card min-w-0 flex-1 rounded-xl border border-ink-100 bg-white p-4 shadow-card hover:shadow-lift transition-shadow">
        <div className="flex flex-wrap items-start justify-between gap-2">
          {/* Actor + role */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink-900 text-sm">{entry.actor || 'Unknown'}</span>
            {entry.role && (
              <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', ROLE_BADGE[entry.role] || 'bg-ink-100 text-ink-600')}>
                {entry.role.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {/* Timestamp */}
          {entry.at && (
            <time
              dateTime={entry.at}
              title={formatDateTime(entry.at)}
              className="cursor-default text-xs text-ink-400 hover:text-ink-600 transition-colors whitespace-nowrap"
            >
              {relativeTime(entry.at)}
            </time>
          )}
        </div>

        {/* Action + Target */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ActionPill action={entry.action} />
          {entry.target && (
            <span className="max-w-[200px] truncate font-mono text-[11px] text-ink-500" title={entry.target}>
              {entry.target}
            </span>
          )}
        </div>

        {/* Diff viewer */}
        {(entry.before != null || entry.after != null) && (
          <div className="mt-3 border-t border-ink-100 pt-3">
            <DiffViewer before={entry.before} after={entry.after} />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyAuditState({ filtered }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-ink-200 bg-ink-50/50 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-card">
        <Search className="h-6 w-6 text-ink-300" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-ink-600">{filtered ? 'No matching entries' : 'No audit log entries'}</p>
        <p className="mt-1 text-sm text-ink-400">
          {filtered ? 'Try adjusting your search or filters.' : 'Actions will appear here as admins make changes.'}
        </p>
      </div>
    </div>
  );
}

/* ─── FilterBar ─────────────────────────────────────────────────────────────── */

function FilterBar({ actionFilter, onActionFilter, onRefresh, loading }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Action type filter */}
      <div className="relative flex items-center gap-1.5">
        <Funnel className="h-3.5 w-3.5 text-ink-400 shrink-0" aria-hidden="true" />
        <select
          value={actionFilter}
          onChange={(e) => onActionFilter(e.target.value)}
          className="rounded-lg border border-ink-200 bg-white py-1.5 pl-2 pr-6 text-xs text-ink-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 cursor-pointer"
          aria-label="Filter by action type"
        >
          {ACTION_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Immutability note */}
      <span className="ml-auto flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1.5 text-[11px] font-medium text-ink-500 border border-ink-100">
        <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
        Entries cannot be edited or deleted
      </span>

      {/* Refresh */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-500 hover:bg-ink-50 hover:text-ink-700 disabled:opacity-50 transition-colors"
        aria-label="Refresh audit log"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
      </button>
    </div>
  );
}

/* ─── AuditPage ─────────────────────────────────────────────────────────────── */

/** Audit log (F12-11): read-only, actor + timestamp + before/after, retained 12 months. */
export default function AuditPage() {
  useDocumentTitle('Audit log');
  const [search, setSearch]           = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const q = useDebounced(search, 300);

  const { data, error, loading, refetch } = useQuery(
    `admin:audit:${q}`,
    () => adminApi.audit(q || undefined),
    { staleMs: 0 },
  );

  /* Apply client-side action filter (the query already filters by text) */
  const items = data?.items ?? [];
  const filtered = actionFilter
    ? items.filter((r) => String(r.action ?? '').toUpperCase().includes(actionFilter))
    : items;

  const hasSearch = Boolean(search || actionFilter);

  return (
    <div>
      {/* Page header */}
      <AdminPageHeader
        icon={Lock}
        iconColor="bg-brand-100 text-brand-600"
        title="Audit log"
        subtitle="Every content, config, role and student-data action — immutable · retained 12 months."
        breadcrumbs={[{ label: 'Admin' }, { label: 'Audit log' }]}
      />

      {/* Search + filter bar */}
      <div className="mb-5 flex flex-col gap-3">
        <AdminSearchBar
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by actor, action or target…"
          className="w-full sm:max-w-md"
        />
        <FilterBar
          actionFilter={actionFilter}
          onActionFilter={setActionFilter}
          onRefresh={refetch}
          loading={loading}
        />
      </div>

      {/* Loading / error states */}
      {loading && !data ? (
        <PageSkeleton rows={1} />
      ) : !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyAuditState filtered={hasSearch} />
      ) : (
        /* ── Timeline ── */
        <section aria-label="Audit log timeline">
          <div className="pl-1">
            {filtered.map((entry) => (
              <TimelineEntry key={entry.id} entry={entry} />
            ))}
          </div>

          {/* Footer note */}
          <p className="mt-4 text-center text-xs text-ink-400">
            Showing {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            {hasSearch ? ' matching your filter' : ''}
            {' '}· Retained for 12 months
          </p>
        </section>
      )}
    </div>
  );
}
