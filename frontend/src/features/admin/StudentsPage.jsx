import { useState } from 'react';
import { toast } from 'sonner';
import {
  Search, Download, Ban, CheckCircle2, FileDown, Trash2, EyeOff,
  Calendar, Clock, Mail, Hash, GraduationCap, ShieldCheck, Zap,
  Coins, Flame, BookOpen, FlaskConical, Target, X,
} from 'lucide-react';
import { Button, TextField, SelectField, Modal, ConfirmDialog, PageSkeleton, ErrorState, Card, Alert, Spinner } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDebounced, useDocumentTitle } from '@/hooks/useCommon';
import { formatDate, timeAgo } from '@/lib/date';
import { CLASSES } from '@/config/constants';
import { AdminPageHeader, AdminTable, StatusBadge, useCan, ADMIN_CAPS, supports } from './adminShared';

const STATUSES = ADMIN_CAPS?.studentStatuses || ['ACTIVE', 'SUSPENDED', 'DELETION_PENDING'];

function saveFile(content, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Returns a consistent HSL color for a given string (name). */
function avatarColor(name = '') {
  const hues = [221, 262, 32, 14, 160, 199, 338, 291];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = hues[Math.abs(hash) % hues.length];
  return { bg: `hsl(${hue} 70% 92%)`, text: `hsl(${hue} 50% 32%)` };
}

function AvatarCircle({ name = '', size = 'md' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  const { bg, text } = avatarColor(name);
  const cls = size === 'lg'
    ? 'h-16 w-16 text-2xl font-bold rounded-2xl'
    : 'h-8 w-8 text-xs font-bold rounded-lg';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-display ${cls}`}
      style={{ backgroundColor: bg, color: text }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}

const STAT_META = [
  { key: 'totalXp',         label: 'XP',         icon: Zap,         color: 'text-brand-600',   bg: 'bg-brand-50'  },
  { key: 'goldCoins',       label: 'Coins',       icon: Coins,       color: 'text-gold-600',    bg: 'bg-gold-50'   },
  { key: 'currentStreak',   label: 'Streak',      icon: Flame,       color: 'text-flame-600',   bg: 'bg-flame-50'  },
  { key: 'attempts',        label: 'Questions',   icon: BookOpen,    color: 'text-sky-600',      bg: 'bg-sky-50'    },
  { key: 'testsAttempted',  label: 'Tests',       icon: FlaskConical, color: 'text-violet-600', bg: 'bg-violet-50' },
  { key: 'accuracyOverall', label: 'Accuracy',    icon: Target,      color: 'text-emerald-600', bg: 'bg-emerald-50', fmt: (v) => `${v}%` },
];

const INFO_META = [
  { key: 'emailMasked',  label: 'Email',          icon: Mail,        mono: true },
  { key: 'classId',      label: 'Class',          icon: GraduationCap, fmt: (v) => (v ? `Class ${v}` : '—') },
  { key: 'parentMasked', label: 'Parent contact', icon: Hash         },
  { key: 'joinedAt',     label: 'Joined',         icon: Calendar,    fmt: (v) => (v ? formatDate(v) : '—') },
  { key: 'consentAt',    label: 'Consent',        icon: ShieldCheck,
    fmt: (v, s) => v ? `${formatDate(v)}${s.consentMethod ? ` · ${s.consentMethod}` : ''}${s.consentVersion ? ` · ${s.consentVersion}` : ''}` : 'Missing' },
  { key: 'status',       label: 'Status',         icon: null,        custom: (s) => <StatusBadge status={s.status} /> },
];

function StudentDrawer({ id, onClose, onChanged }) {
  const { data: s, loading, refetch } = useQuery(`admin:student:${id}`, () => adminApi.student(id), { enabled: Boolean(id), staleMs: 0 });
  const [confirm, setConfirm] = useState(false);

  const act = async (action) => {
    try {
      const res = await adminApi.studentAction(id, action);
      if (res.download) saveFile(JSON.stringify(res.download, null, 2), `gyaangrid-student-${id}.json`, 'application/json');
      toast.success(res.message);
      refetch();
      onChanged();
      setConfirm(false);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <Modal open={Boolean(id)} onClose={onClose} title={s?.displayName || 'Student'} description={s ? `ID ${s.id}` : ''} size="lg">
      {loading || !s ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── Header ── */}
          <div className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-ink-50 p-4">
            <AvatarCircle name={s.displayName} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-xl font-bold text-ink-900">{s.displayName}</h2>
              <p className="font-mono text-xs text-ink-400">{ADMIN_CAPS ? `…${String(s.id).slice(-6)}` : s.id}</p>
              <div className="mt-1.5">
                <StatusBadge status={s.status} />
              </div>
            </div>
          </div>

          {/* ── Info grid ── */}
          <div className="grid gap-2 sm:grid-cols-2">
            {INFO_META.map(({ key, label, icon: Icon, fmt, mono, custom }) => {
              const rawVal = s[key];
              const display = custom
                ? custom(s)
                : fmt
                  ? fmt(rawVal, s)
                  : (rawVal ?? '—');
              return (
                <div key={key} className="rounded-xl border border-ink-100 bg-white p-3 shadow-sm">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                    {label}
                  </p>
                  <p className={`font-medium text-ink-900 ${mono ? 'font-mono text-sm' : ''}`}>
                    {display}
                  </p>
                </div>
              );
            })}
          </div>

          {/* ── Stats grid ── */}
          {s.summary && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Progress &amp; Stats</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {STAT_META.map(({ key, label, icon: Icon, color, bg, fmt }) => {
                  const val = s.summary[key];
                  if (val == null) return null;
                  const display = fmt ? fmt(val) : val;
                  return (
                    <div key={key} className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3 shadow-sm">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                        <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
                      </span>
                      <div>
                        <p className={`font-display text-xl font-bold leading-none ${color}`}>{display}</p>
                        <p className="mt-0.5 text-xs text-ink-500">{label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Privacy notice ── */}
          <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" aria-hidden="true" />
            <span>Contact details are masked and doubt conversations are hidden unless flagged. <strong>This view is logged.</strong></span>
          </div>

          {/* ── Actions ── */}
          <div className="border-t border-ink-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Account actions</p>
            <div className="flex flex-wrap gap-2">
              {s.status === 'SUSPENDED'
                ? <Button variant="success" leftIcon={CheckCircle2} onClick={() => act('UNSUSPEND')}>Reinstate</Button>
                : <Button variant="outline" leftIcon={Ban} onClick={() => act('SUSPEND')}>Suspend</Button>}
              {supports('studentExport') && (
                <Button variant="outline" leftIcon={FileDown} onClick={() => act('EXPORT')}>
                  {ADMIN_CAPS ? 'Download data package' : 'Trigger data export'}
                </Button>
              )}
            </div>

            {/* Danger zone */}
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-500">Danger zone</p>
              {ADMIN_CAPS ? (
                s.status === 'DEACTIVATED'
                  ? <Button variant="outline" leftIcon={CheckCircle2} onClick={() => act('REACTIVATE')}>Reactivate account</Button>
                  : <Button variant="danger" leftIcon={Trash2} onClick={() => setConfirm(true)}>Deactivate account</Button>
              ) : (
                <Button variant="danger" leftIcon={Trash2} disabled={s.status === 'DELETION_PENDING'} onClick={() => setConfirm(true)}>
                  Action deletion request
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => act('DELETE')}
        tone="danger"
        title={ADMIN_CAPS ? 'Deactivate this account?' : "Delete this student's data?"}
        description={ADMIN_CAPS
          ? 'The student can no longer sign in. You can reactivate the account later.'
          : 'Soft-deleted now; personal data erased within 30 days; the parent contact is notified.'}
        confirmLabel={ADMIN_CAPS ? 'Deactivate' : 'Delete'}
        typeToConfirm={ADMIN_CAPS ? 'DEACTIVATE' : 'DELETE'}
      />
    </Modal>
  );
}

/** Student manager (F12-08): search, masked profile & progress, suspend, export, deletion. Bulk export is Super Admin only. */
export default function StudentsPage() {
  useDocumentTitle('Students');
  const canBulk = useCan('bulkExport') && supports('bulkExport');
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(null);

  const params = { q: q || undefined, classId: classId || undefined, status: status || undefined };
  const { data, error, loading, refetch } = useQuery(
    `admin:students:${JSON.stringify(params)}`,
    () => adminApi.students(params),
    { staleMs: 0 },
  );

  const bulk = async () => {
    try {
      const res = await adminApi.bulkExport();
      const rows = res.rows || [];
      const keys = Object.keys(rows[0] || {});
      const csv = res.csv ?? [keys.join(','), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'gyaangrid-students-masked.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Export downloaded and logged.');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const hasFilters = Boolean(classId || status);

  return (
    <div>
      <AdminPageHeader
        title="Students"
        subtitle="Masked by default. Every profile view is recorded in the audit log."
        action={canBulk && (
          <Button variant="outline" leftIcon={Download} onClick={bulk}>
            Bulk export (CSV)
          </Button>
        )}
      />

      {/* ── Search / filter card ── */}
      <div className="mb-5 rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_200px]">
          {/* Search with icon */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
            <input
              className="input w-full pl-9"
              placeholder="Search by display name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search students"
            />
          </div>
          <SelectField
            aria-label="Class"
            value={classId}
            placeholder="All classes"
            onChange={(e) => setClassId(e.target.value)}
            options={CLASSES.map((c) => ({ value: c, label: `Class ${c}` }))}
          />
          <SelectField
            aria-label="Status"
            value={status}
            placeholder="All statuses"
            onChange={(e) => setStatus(e.target.value)}
            options={STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
          />
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-ink-400">Active filters:</span>
            {classId && (
              <button
                onClick={() => setClassId('')}
                className="chip flex items-center gap-1 hover:bg-ink-200 transition"
                aria-label={`Remove class ${classId} filter`}
              >
                Class {classId}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
            {status && (
              <button
                onClick={() => setStatus('')}
                className="chip flex items-center gap-1 hover:bg-ink-200 transition"
                aria-label={`Remove status ${status} filter`}
              >
                {status.replace('_', ' ')}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {loading && !data ? (
        <PageSkeleton rows={1} />
      ) : !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <AdminTable
            rowKey={(r) => r.id}
            rows={data.items}
            onRowClick={(r) => setOpen(r.id)}
            columns={[
              {
                key: 'name',
                label: 'Student',
                render: (r) => (
                  <div className="flex items-center gap-3">
                    <AvatarCircle name={r.displayName} size="sm" />
                    <span>
                      <span className="font-semibold text-ink-900">{r.displayName}</span>
                      <span className="block font-mono text-[11px] font-normal text-ink-400">
                        {ADMIN_CAPS ? `…${String(r.id).slice(-6)}` : r.id}
                      </span>
                    </span>
                  </div>
                ),
              },
              {
                key: 'email',
                label: 'Email',
                render: (r) => (
                  <span className="font-mono text-xs text-ink-500">{r.emailMasked}</span>
                ),
              },
              {
                key: 'class',
                label: 'Class',
                render: (r) => (r.classId ? `Class ${r.classId}` : '—'),
              },
              {
                key: 'joined',
                label: 'Joined',
                className: 'text-xs',
                render: (r) => r.joinedAt ? (
                  <span className="flex items-center gap-1 text-ink-500">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                    {formatDate(r.joinedAt)}
                  </span>
                ) : '—',
              },
              {
                key: 'active',
                label: 'Last active',
                className: 'text-xs',
                render: (r) => r.lastActiveAt ? (
                  <span className="flex items-center gap-1 text-ink-500">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                    {timeAgo(r.lastActiveAt)}
                  </span>
                ) : '—',
              },
              {
                key: 'consent',
                label: 'Consent',
                render: (r) => (r.consent ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="DRAFT" />),
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
            ]}
          />

          {/* Pagination info */}
          <div className="mt-3 flex items-center justify-between text-sm text-ink-500">
            <p>
              Showing <span className="font-semibold text-ink-700">{data.items.length}</span> of{' '}
              <span className="font-semibold text-ink-700">{data.total}</span> students
            </p>
          </div>
        </>
      )}

      <StudentDrawer id={open} onClose={() => setOpen(null)} onChanged={refetch} />
    </div>
  );
}
