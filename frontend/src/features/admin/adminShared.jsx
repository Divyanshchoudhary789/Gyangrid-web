import { useAdminStore } from '@/store/authStore';
import { Badge, SelectField } from '@/components/ui';
import { CLASSES } from '@/config/constants';
import { cn } from '@/lib/cn';

/** Client-side mirror of the admin permission matrix (3.1). The API enforces the same rules. */
export const CAN = {
  editContent: ['SUPER_ADMIN', 'CONTENT_MANAGER'],
  viewConfig: ['SUPER_ADMIN', 'CONTENT_MANAGER'],
  editConfig: ['SUPER_ADMIN'],
  students: ['SUPER_ADMIN', 'SUPPORT'],
  bulkExport: ['SUPER_ADMIN'],
  audit: ['SUPER_ADMIN', 'SUPPORT'],
  kb: ['SUPER_ADMIN', 'CONTENT_MANAGER'],
};

export function useCan(permission) {
  const role = useAdminStore((s) => s.admin?.role);
  return Boolean(role && CAN[permission]?.includes(role));
}

const STATUS_TONE = {
  PUBLISHED: 'success', APPROVED: 'success', INDEXED: 'success', RESOLVED: 'success', ACTIVE: 'success',
  DRAFT: 'neutral', IN_REVIEW: 'warning', INDEXING: 'info', OPEN: 'warning', SUSPENDED: 'danger',
  RETIRED: 'danger', FAILED: 'danger', DELETION_PENDING: 'danger',
};
export const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status] || 'neutral'}>{String(status).replace(/_/g, ' ')}</Badge>;

export function ClassSelect({ value, onChange, className, label = 'Class' }) {
  return (
    <SelectField label={label} className={className} value={value} onChange={(e) => onChange(Number(e.target.value))} options={CLASSES.map((c) => ({ value: c, label: `Class ${c}` }))} />
  );
}

export function AdminTable({ columns, rows, rowKey, onRowClick, empty = 'No records', className }) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-ink-100 bg-white', className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-ink-50 text-xs font-bold uppercase tracking-wide text-ink-500">
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={cn('px-4 py-3', c.className)}>{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-ink-400">{empty}</td></tr>
          ) : rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn('align-top transition', onRowClick && 'cursor-pointer hover:bg-brand-50/40')}>
              {columns.map((c) => <td key={c.key} className={cn('px-4 py-3', c.className)}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function ReadOnlyNote() {
  return <p className="mb-4 rounded-xl bg-ink-100 px-4 py-2 text-sm text-ink-600">Read-only view — your role can&apos;t change this section.</p>;
}
