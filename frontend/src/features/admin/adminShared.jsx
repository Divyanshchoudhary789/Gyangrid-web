import { useAdminStore } from '@/store/authStore';
import { Badge, SelectField } from '@/components/ui';
import { CLASSES } from '@/config/constants';
import { cn } from '@/lib/cn';
import { adminApi } from '@/services/api/admin';
import {
  CheckCircle2, Clock, Eye, XCircle, Ban,
  Search, X, TrendingUp, TrendingDown, ChevronUp, ChevronDown,
  Minus, AlertCircle,
} from 'lucide-react';

/** Backend capability flags (real mode). In mock mode everything in the PRD is supported. */
export const ADMIN_CAPS = adminApi.caps || null;
export const supports = (key, fallback = true) => (ADMIN_CAPS ? ADMIN_CAPS[key] !== false && ADMIN_CAPS[key] != null : fallback);

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

/* ─── StatusBadge ────────────────────────────────────────────────────────── */

const STATUS_TONE = {
  PUBLISHED: 'success', APPROVED: 'success', INDEXED: 'success', RESOLVED: 'success', ACTIVE: 'success',
  DRAFT: 'neutral', IN_REVIEW: 'warning', INDEXING: 'info', OPEN: 'warning', SUSPENDED: 'danger',
  RETIRED: 'danger', FAILED: 'danger', DELETION_PENDING: 'danger', DEACTIVATED: 'danger', ARCHIVED: 'danger',
};

const STATUS_ICON = {
  PUBLISHED: CheckCircle2, APPROVED: CheckCircle2, ACTIVE: CheckCircle2, INDEXED: CheckCircle2, RESOLVED: CheckCircle2,
  DRAFT: Clock,
  IN_REVIEW: Eye, OPEN: Eye, INDEXING: Eye,
  RETIRED: XCircle, FAILED: XCircle, DELETION_PENDING: XCircle, DEACTIVATED: XCircle, ARCHIVED: XCircle,
  SUSPENDED: Ban,
};

export const StatusBadge = ({ status }) => {
  const Icon = STATUS_ICON[status];
  return (
    <Badge tone={STATUS_TONE[status] || 'neutral'}>
      <span className="inline-flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
        {String(status).replace(/_/g, ' ')}
      </span>
    </Badge>
  );
};

/* ─── ClassSelect ─────────────────────────────────────────────────────────── */

export function ClassSelect({ value, onChange, className, label = 'Class' }) {
  return (
    <SelectField label={label} className={className} value={value} onChange={(e) => onChange(Number(e.target.value))} options={CLASSES.map((c) => ({ value: c, label: `Class ${c}` }))} />
  );
}

/* ─── AdminTable ──────────────────────────────────────────────────────────── */

export function AdminTable({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty = 'No records',
  className,
  loading = false,
  striped = false,
  emptyIcon: EmptyIcon = AlertCircle,
  emptyMessage,
}) {
  return (
    <div className={cn('relative overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card', className)}>
      {/* Loading shimmer overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 rounded-2xl bg-white/70 backdrop-blur-[1px]">
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              <span className="text-xs text-ink-400">Loading…</span>
            </div>
          </div>
        </div>
      )}

      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-gradient-to-b from-ink-50 to-ink-50/80 text-xs font-bold uppercase tracking-wide text-ink-500">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn('py-3.5 px-5', c.isSortable && 'cursor-pointer select-none', c.className)}
                aria-sort={c.isSortable ? 'none' : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {c.isSortable && (
                    <span className="ml-0.5 inline-flex flex-col text-ink-300" aria-hidden="true">
                      <ChevronUp className="h-2.5 w-2.5 -mb-0.5" />
                      <ChevronDown className="h-2.5 w-2.5" />
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-14 text-center">
                <div className="flex flex-col items-center gap-3 text-ink-400">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-50">
                    <EmptyIcon className="h-6 w-6 text-ink-300" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-ink-500">{emptyMessage || empty}</p>
                    <p className="mt-0.5 text-xs text-ink-400">No data to display</p>
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn(
                  'align-top transition-colors duration-100',
                  onRowClick && 'cursor-pointer hover:bg-brand-50/30',
                  striped && idx % 2 === 1 && 'bg-ink-50/40',
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-5 py-3', c.className)}>
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ─── AdminPageHeader ─────────────────────────────────────────────────────── */

export function AdminPageHeader({
  title,
  subtitle,
  action,
  icon: Icon,
  iconColor = 'bg-brand-100 text-brand-600',
  noBorder = false,
  breadcrumbs,
}) {
  return (
    <div className={cn('mb-5', !noBorder && 'border-b border-ink-100 pb-5')}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-xs text-ink-400" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-ink-300">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-ink-700 transition-colors">{crumb.label}</a>
              ) : (
                <span className={i === breadcrumbs.length - 1 ? 'text-ink-600 font-medium' : ''}>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          {/* Optional icon circle */}
          {Icon && (
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconColor)}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold font-display text-ink-900 leading-tight">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

/* ─── ReadOnlyNote ────────────────────────────────────────────────────────── */

export function ReadOnlyNote() {
  return <p className="mb-4 rounded-xl bg-ink-100 px-4 py-2 text-sm text-ink-600">Read-only view — your role can&apos;t change this section.</p>;
}

/* ─── AdminSearchBar ─────────────────────────────────────────────────────── */

export function AdminSearchBar({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search
        className="pointer-events-none absolute left-3 h-4 w-4 text-ink-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          'input h-10 w-full rounded-xl border border-ink-200 bg-white py-2 pl-9 pr-9 text-sm text-ink-900',
          'placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-shadow',
        )}
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange({ target: { value: '' } })}
          className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full bg-ink-200 text-ink-500 hover:bg-ink-300 transition-colors"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/* ─── StatsCard ───────────────────────────────────────────────────────────── */

const TONE_STYLES = {
  brand:   { ring: 'bg-brand-100',   icon: 'text-brand-600',   value: 'text-ink-900' },
  success: { ring: 'bg-emerald-100', icon: 'text-emerald-600', value: 'text-ink-900' },
  danger:  { ring: 'bg-rose-100',    icon: 'text-rose-600',    value: 'text-ink-900' },
  warning: { ring: 'bg-amber-100',   icon: 'text-amber-600',   value: 'text-ink-900' },
  info:    { ring: 'bg-sky-100',     icon: 'text-sky-600',     value: 'text-ink-900' },
  gold:    { ring: 'bg-gold-100',    icon: 'text-gold-600',    value: 'text-ink-900' },
};

export function StatsCard({ icon: Icon, label, value, hint, tone = 'brand', trend, trendLabel }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.brand;
  const trendPositive = typeof trend === 'number' && trend > 0;
  const trendNegative = typeof trend === 'number' && trend < 0;
  const trendNeutral  = typeof trend === 'number' && trend === 0;

  return (
    <div className="card card-hover flex flex-col gap-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition-shadow">
      <div className="flex items-start justify-between">
        {/* Icon circle */}
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', styles.ring)}>
          {Icon && <Icon className={cn('h-5 w-5', styles.icon)} aria-hidden="true" />}
        </div>

        {/* Trend badge */}
        {typeof trend === 'number' && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
              trendPositive && 'bg-emerald-50 text-emerald-700',
              trendNegative && 'bg-rose-50 text-rose-700',
              trendNeutral  && 'bg-ink-100 text-ink-500',
            )}
            aria-label={`Trend: ${trend > 0 ? '+' : ''}${trend}${trendLabel ? ` ${trendLabel}` : ''}`}
          >
            {trendPositive && <TrendingUp className="h-3 w-3" aria-hidden="true" />}
            {trendNegative && <TrendingDown className="h-3 w-3" aria-hidden="true" />}
            {trendNeutral  && <Minus className="h-3 w-3" aria-hidden="true" />}
            {trend > 0 ? '+' : ''}{trend}{trendLabel || '%'}
          </span>
        )}
      </div>

      <div>
        <p className={cn('text-3xl font-bold font-display leading-none', styles.value)}>{value}</p>
        <p className="mt-1.5 text-sm font-medium text-ink-500">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
      </div>
    </div>
  );
}
