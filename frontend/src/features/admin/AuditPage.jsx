import { useState } from 'react';
import { Search, Lock } from 'lucide-react';
import { TextField, PageSkeleton, ErrorState, Card } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { useDebounced, useDocumentTitle } from '@/hooks/useCommon';
import { formatDateTime } from '@/lib/date';
import { AdminPageHeader, AdminTable } from './adminShared';

const fmt = (v) => (v == null ? '—' : JSON.stringify(v));

/** Audit log (F12-11): read-only, actor + timestamp + before/after, retained 12 months. */
export default function AuditPage() {
  useDocumentTitle('Audit log');
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);
  const { data, error, loading, refetch } = useQuery(`admin:audit:${q}`, () => adminApi.audit(q || undefined), { staleMs: 0 });
  return (
    <div>
      <AdminPageHeader title="Audit log" subtitle="Every content, config, role and student-data action. Read-only · retained 12 months." />
      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-4">
        <TextField icon={Search} className="flex-1" placeholder="Filter by actor, action or target…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Filter audit log" />
        <span className="flex items-center gap-1.5 text-xs text-ink-500"><Lock className="h-4 w-4" />Entries cannot be edited or deleted</span>
      </Card>
      {loading && !data ? <PageSkeleton rows={1} /> : !data ? <ErrorState error={error} onRetry={refetch} /> : (
        <AdminTable
          rowKey={(r) => r.id}
          rows={data.items}
          columns={[
            { key: 'at', label: 'When', className: 'whitespace-nowrap text-xs text-ink-500', render: (r) => formatDateTime(r.at) },
            { key: 'actor', label: 'Actor', className: 'text-xs', render: (r) => <span>{r.actor}<span className="block text-ink-400">{r.role}</span></span> },
            { key: 'action', label: 'Action', className: 'font-mono text-xs font-semibold text-brand-700' },
            { key: 'target', label: 'Target', className: 'max-w-[160px] truncate font-mono text-xs' },
            { key: 'before', label: 'Before', className: 'max-w-[200px] truncate font-mono text-[11px] text-ink-500', render: (r) => fmt(r.before) },
            { key: 'after', label: 'After', className: 'max-w-[220px] truncate font-mono text-[11px] text-ink-500', render: (r) => fmt(r.after) },
          ]}
        />
      )}
    </div>
  );
}
