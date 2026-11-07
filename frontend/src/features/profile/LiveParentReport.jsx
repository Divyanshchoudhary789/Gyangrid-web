import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Mail, Send, RefreshCw, Link2Off, CalendarClock } from 'lucide-react';
import { PageHeader, Card, Button, PageSkeleton, ErrorState, Alert, ConfirmDialog } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { progressApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatDateTime } from '@/lib/date';
import { ParentReportCard, weekLabel } from './ParentReportCard';

const INCLUDES = ['Days active, challenges and tests', 'Accuracy and how it changed', 'Topics going well and topics to work on'];
const EXCLUDES = ['Your doubts and chats', 'Your answers to questions', 'Comparisons with other students'];

/** Delivery outcomes: ACCEPTED means the email provider took it, not that it reached the inbox. */
const OUTCOME = {
  ACCEPTED: { tone: 'success', title: 'Report sent', text: 'Our email service has accepted it. It should reach your parent shortly.' },
  DELIVERED: { tone: 'success', title: 'Report delivered', text: 'It has reached your parent.' },
  PENDING: { tone: 'info', title: 'On its way', text: 'This week’s report is being sent.' },
  UNKNOWN: { tone: 'info', title: 'Already attempted', text: 'We tried sending this week’s report and can’t confirm the result, so we won’t send it twice. Ask your parent to check their inbox.' },
  UNCONFIGURED: { tone: 'warning', title: 'Email isn’t set up yet', text: 'Reports can’t be sent right now. Please try again later.', retry: true },
  FAILED: { tone: 'warning', title: 'Couldn’t send it', text: 'Something went wrong while sending. You can try again.', retry: true },
  RETRY_REQUIRED: { tone: 'warning', title: 'Couldn’t send it', text: 'The last attempt didn’t go through. You can try again.', retry: true },
  ALREADY_ACCEPTED: { tone: 'success', title: 'Already sent', text: 'This week’s report has already gone out. A new one comes next week.' },
  DELIVERY_IN_PROGRESS: { tone: 'info', title: 'On its way', text: 'This week’s report is being sent right now.' },
};

/** Why a report couldn't be sent at all (takes priority over the delivery status). */
const REASON = {
  EMAIL_NOT_CONFIGURED: OUTCOME.UNCONFIGURED,
  PARENT_REPORT_DISABLED: { tone: 'info', title: 'Weekly report is switched off', text: 'Turn on “Send my parent a weekly report” in Settings to send it.' },
  PARENT_CONSENT_MISSING: { tone: 'warning', title: 'Parent permission needed', text: 'A report can only be sent once your parent’s permission is recorded.' },
};

export function LiveParentReport() {
  useDocumentTitle('Parent report');
  const { data: r, error, loading, refetch } = useQuery('parentReport', progressApi.parentReport);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [deliveryId, setDeliveryId] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  if (loading && !r) return <PageSkeleton rows={1} />;
  if (!r) return <ErrorState error={error} onRetry={refetch} />;

  const linkId = deliveryId === false ? null : deliveryId || r.lastDeliveryId;

  const deliver = async (retry = false) => {
    setBusy(true);
    try {
      const res = await progressApi.deliverParentReport({ retry });
      setOutcome(res);
      if (res.deliveryId) setDeliveryId(res.deliveryId);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await progressApi.revokeParentReport(linkId);
      setDeliveryId(false);
      setConfirmRevoke(false);
      toast.success('The report link no longer works.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const o = outcome && (REASON[outcome.reason] || OUTCOME[outcome.status] || OUTCOME.UNKNOWN);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader back={{ to: '/settings', label: 'Settings' }} title="Your weekly parent report"
        subtitle={r.sentTo ? `A short weekly summary goes to ${r.sentTo}.` : 'Add a parent contact to send a weekly summary.'}
      />

      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-bold text-ink-900"><Mail className="h-5 w-5 text-brand-500" />Preview · {weekLabel(r.weekStart, r.weekEnd)}</p>
          {r.nextSendAt && <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-500"><CalendarClock className="h-4 w-4" />Next: {formatDateTime(r.nextSendAt)}</p>}
        </div>
        <ParentReportCard report={r} name="you" />
      </Card>

      {o && (
        <Alert tone={o.tone} title={o.title} action={o.retry && <Button size="sm" variant="outline" leftIcon={RefreshCw} loading={busy} onClick={() => deliver(true)}>Try again</Button>}>{o.text}</Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {r.sentTo && !outcome && <Button leftIcon={Send} loading={busy} onClick={() => deliver(false)} className="flex-1">Send this report now</Button>}
        {linkId && <Button variant="outline" leftIcon={Link2Off} disabled={busy} onClick={() => setConfirmRevoke(true)} className="flex-1">Turn off the report link</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-emerald-100 bg-emerald-50/50">
          <p className="mb-3 font-bold text-emerald-800">What it includes</p>
          <ul className="space-y-2 text-sm text-ink-700">{INCLUDES.map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />{x}</li>)}</ul>
        </Card>
        <Card className="border-rose-100 bg-rose-50/50">
          <p className="mb-3 font-bold text-rose-800">What it never includes</p>
          <ul className="space-y-2 text-sm text-ink-700">{EXCLUDES.map((x) => <li key={x} className="flex gap-2"><XCircle className="h-4 w-4 shrink-0 text-rose-500" />{x}</li>)}</ul>
        </Card>
      </div>

      <ConfirmDialog open={confirmRevoke} onClose={() => setConfirmRevoke(false)} onConfirm={revoke} loading={busy} title="Turn off the report link?" description="Anyone opening the link from the email will no longer see this report." confirmLabel="Turn off" />
    </div>
  );
}
