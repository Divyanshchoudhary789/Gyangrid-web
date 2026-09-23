import { useState } from 'react';
import { toast } from 'sonner';
import { Search, Download, Ban, CheckCircle2, FileDown, Trash2, EyeOff } from 'lucide-react';
import { Button, TextField, SelectField, Modal, ConfirmDialog, PageSkeleton, ErrorState, Card, Alert, Spinner } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDebounced, useDocumentTitle } from '@/hooks/useCommon';
import { formatDate, timeAgo } from '@/lib/date';
import { CLASSES } from '@/config/constants';
import { AdminPageHeader, AdminTable, StatusBadge, useCan } from './adminShared';

function StudentDrawer({ id, onClose, onChanged }) {
  const { data: s, loading, refetch } = useQuery(`admin:student:${id}`, () => adminApi.student(id), { enabled: Boolean(id), staleMs: 0 });
  const [confirm, setConfirm] = useState(false);
  const act = async (action) => {
    try {
      const res = await adminApi.studentAction(id, action);
      toast.success(res.message);
      refetch();
      onChanged();
      setConfirm(false);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <Modal open={Boolean(id)} onClose={onClose} title={s?.displayName || 'Student'} description={s ? `ID ${s.id}` : ''} size="lg">
      {loading || !s ? <div className="flex justify-center py-10"><Spinner /></div> : (
        <div className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {[['Email', s.emailMasked], ['Class', s.classId ? `Class ${s.classId}` : '—'], ['Parent contact', s.parentMasked], ['Joined', formatDate(s.joinedAt)], ['Consent', s.consentAt ? `${formatDate(s.consentAt)}${s.consentMethod ? ` · ${s.consentMethod}` : ''}` : 'Missing'], ['Status', <StatusBadge key="s" status={s.status} />]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ink-50 p-3"><p className="text-xs font-semibold text-ink-500">{k}</p><p className="font-medium text-ink-900">{v}</p></div>
            ))}
          </div>
          {s.summary && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[['XP', s.summary.totalXp], ['Coins', s.summary.goldCoins], ['Streak', s.summary.currentStreak], ['Accuracy', s.summary.accuracyOverall != null ? `${s.summary.accuracyOverall}%` : '—']].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-ink-100 p-3 text-center"><p className="font-display text-lg font-bold">{v}</p><p className="text-xs text-ink-500">{k}</p></div>
              ))}
            </div>
          )}
          <Alert tone="info" title="Privacy"><span className="flex items-center gap-1.5"><EyeOff className="h-4 w-4" />Contact details are masked and doubt conversations are hidden unless flagged. This view is logged.</span></Alert>
          <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
            {s.status === 'SUSPENDED' ? <Button variant="success" leftIcon={CheckCircle2} onClick={() => act('UNSUSPEND')}>Reinstate</Button> : <Button variant="outline" leftIcon={Ban} onClick={() => act('SUSPEND')}>Suspend</Button>}
            <Button variant="outline" leftIcon={FileDown} onClick={() => act('EXPORT')}>Trigger data export</Button>
            <Button variant="danger" leftIcon={Trash2} disabled={s.status === 'DELETION_PENDING'} onClick={() => setConfirm(true)}>Action deletion request</Button>
          </div>
        </div>
      )}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => act('DELETE')} tone="danger" title="Delete this student's data?" description="Soft-deleted now; personal data erased within 30 days; the parent contact is notified." confirmLabel="Delete" typeToConfirm="DELETE" />
    </Modal>
  );
}

/** Student manager (F12-08): search, masked profile & progress, suspend, export, deletion. Bulk export is Super Admin only. */
export default function StudentsPage() {
  useDocumentTitle('Students');
  const canBulk = useCan('bulkExport');
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(null);
  const params = { q: q || undefined, classId: classId || undefined, status: status || undefined };
  const { data, error, loading, refetch } = useQuery(`admin:students:${JSON.stringify(params)}`, () => adminApi.students(params), { staleMs: 0 });

  const bulk = async () => {
    try {
      const { rows } = await adminApi.bulkExport();
      const keys = Object.keys(rows[0] || {});
      const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'gyangrid-students-masked.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Export downloaded and logged.');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div>
      <AdminPageHeader title="Students" subtitle="Masked by default. Every profile view is recorded in the audit log." action={canBulk && <Button variant="outline" leftIcon={Download} onClick={bulk}>Bulk export (CSV)</Button>} />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_160px_200px] sm:p-4">
        <TextField icon={Search} placeholder="Search by display name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" />
        <SelectField aria-label="Class" value={classId} placeholder="All classes" onChange={(e) => setClassId(e.target.value)} options={CLASSES.map((c) => ({ value: c, label: `Class ${c}` }))} />
        <SelectField aria-label="Status" value={status} placeholder="All statuses" onChange={(e) => setStatus(e.target.value)} options={['ACTIVE', 'SUSPENDED', 'DELETION_PENDING'].map((s) => ({ value: s, label: s.replace('_', ' ') }))} />
      </Card>
      {loading && !data ? <PageSkeleton rows={1} /> : !data ? <ErrorState error={error} onRetry={refetch} /> : (
        <>
          <AdminTable
            rowKey={(r) => r.id}
            rows={data.items}
            onRowClick={(r) => setOpen(r.id)}
            columns={[
              { key: 'name', label: 'Student', className: 'font-semibold', render: (r) => <span>{r.displayName}<span className="block font-mono text-[11px] font-normal text-ink-400">{r.id}</span></span> },
              { key: 'email', label: 'Email', className: 'text-ink-500', render: (r) => r.emailMasked },
              { key: 'class', label: 'Class', render: (r) => (r.classId ? r.classId : '—') },
              { key: 'joined', label: 'Joined', className: 'text-xs', render: (r) => formatDate(r.joinedAt) },
              { key: 'active', label: 'Last active', className: 'text-xs', render: (r) => timeAgo(r.lastActiveAt) },
              { key: 'consent', label: 'Consent', render: (r) => (r.consent ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="DRAFT" />) },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            ]}
          />
          <p className="mt-3 text-sm text-ink-500">{data.total} students</p>
        </>
      )}
      <StudentDrawer id={open} onClose={() => setOpen(null)} onChanged={refetch} />
    </div>
  );
}
