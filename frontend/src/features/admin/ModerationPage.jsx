import { useState } from 'react';
import { toast } from 'sonner';
import { Flag, Bot, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Card, Button, Tabs, Badge, TextArea, Modal, PageSkeleton, ErrorState, EmptyState } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { formatDateTime } from '@/lib/date';
import { AdminPageHeader } from './adminShared';

const TYPE = {
  QUESTION_REPORT: { label: 'Reported question', icon: Flag, tone: 'warning' },
  AI_ANSWER_REPORT: { label: 'Flagged AI answer', icon: Bot, tone: 'info' },
  SAFETY_FLAG: { label: 'Safety flag', icon: ShieldAlert, tone: 'danger' },
};
const REASONS = { WRONG_ANSWER: 'Answer seems wrong', UNCLEAR: 'Question unclear', NOT_IN_SYLLABUS: 'Not in syllabus' };

/** Moderation queue (F12-09). Doubt content is visible here only because the student or safety filter flagged it (F12-12). */
export default function ModerationPage() {
  useDocumentTitle('Moderation');
  const [status, setStatus] = useState('OPEN');
  const { data, error, loading, refetch } = useQuery(`admin:moderation:${status}`, () => adminApi.moderation(status), { staleMs: 0 });
  const [resolving, setResolving] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const resolve = async (action) => {
    setBusy(true);
    try {
      await adminApi.resolveModeration(resolving.id, { action, note });
      toast.success('Resolved.');
      setResolving(null);
      setNote('');
      refetch();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <AdminPageHeader title="Moderation queue" subtitle="Reported questions and flagged AI answers, with minimum personal data." />
      <Tabs className="mb-5" value={status} onChange={setStatus} tabs={[{ value: 'OPEN', label: 'Open' }, { value: 'RESOLVED', label: 'Resolved' }]} />
      {loading && !data ? <PageSkeleton rows={1} /> : !data ? <ErrorState error={error} onRetry={refetch} /> : data.items.length === 0 ? (
        <EmptyState emoji="🧹" title="All clear" description="Nothing is waiting for review." />
      ) : (
        <div className="space-y-3">
          {data.items.map((m) => {
            const t = TYPE[m.type];
            return (
              <Card key={m.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={t.tone} icon={t.icon}>{t.label}</Badge>
                    {m.reason && <Badge>{REASONS[m.reason] || m.reason}</Badge>}
                    {m.topicName && <Badge tone="brand">{m.topicName}</Badge>}
                  </div>
                  <span className="text-xs text-ink-400">{formatDateTime(m.at)}{m.studentRef ? ` · ${m.studentRef}` : ''}</span>
                </div>
                {m.question && <div className="mt-3 rounded-xl bg-ink-50 p-3 text-sm"><p className="mb-1 font-mono text-xs text-ink-400">{m.questionId}</p><MathText text={m.question.text} /></div>}
                {m.snapshot && (
                  <div className="mt-3 space-y-1 rounded-xl bg-ink-50 p-3 text-sm">
                    <p><strong>Student asked:</strong> {m.snapshot.input}</p>
                    {m.snapshot.concept && <p><strong>Concept:</strong> {m.snapshot.concept}</p>}
                    {m.snapshot.steps && <ol className="list-decimal pl-5">{m.snapshot.steps.map((s) => <li key={s}><MathText text={s} /></li>)}</ol>}
                  </div>
                )}
                {m.note && <p className="mt-2 text-sm text-ink-600">“{m.note}”</p>}
                {m.type === 'SAFETY_FLAG' && <p className="mt-2 text-sm text-rose-700">The student received the safe, trusted-adult response. Content is not shown to protect the student; escalate per the safeguarding process.</p>}
                <div className="mt-4 flex items-center justify-between gap-3">
                  {m.status === 'RESOLVED' ? (
                    <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{m.resolution?.replace(/_/g, ' ').toLowerCase()} by {m.resolvedBy}</p>
                  ) : <span />}
                  {m.status === 'OPEN' && <Button size="sm" onClick={() => setResolving(m)}>Review</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Modal open={Boolean(resolving)} onClose={() => setResolving(null)} title="Resolve item" description="Your action is recorded in the audit log.">
        <TextArea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="success" loading={busy} onClick={() => resolve('CORRECTED')}>Mark corrected</Button>
          {resolving?.questionId && <Button variant="danger" loading={busy} onClick={() => resolve('RETIRED_QUESTION')}>Retire question</Button>}
          {resolving?.type !== 'QUESTION_REPORT' && <Button variant="secondary" loading={busy} onClick={() => resolve('ANNOTATED_KB')}>Annotate knowledge base</Button>}
          {resolving?.type === 'SAFETY_FLAG' && <Button variant="danger" loading={busy} onClick={() => resolve('ESCALATED')}>Escalate</Button>}
          <Button variant="outline" loading={busy} onClick={() => resolve('DISMISSED')}>Dismiss</Button>
        </div>
      </Modal>
    </div>
  );
}
