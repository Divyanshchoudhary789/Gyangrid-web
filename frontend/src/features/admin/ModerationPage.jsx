import { useState } from 'react';
import { toast } from 'sonner';
import {
  Flag, Bot, ShieldAlert, CheckCircle2, Clock, AlertTriangle,
  BookOpen, MessageSquare, ChevronRight,
} from 'lucide-react';
import { Card, Button, Tabs, Badge, TextArea, Modal, PageSkeleton, ErrorState, EmptyState } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { useQuery } from '@/hooks/useQuery';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useDocumentTitle } from '@/hooks/useCommon';
import { ComingSoon } from '@/components/feedback/ComingSoon';
import { formatDateTime } from '@/lib/date';
import { AdminPageHeader, supports, ADMIN_CAPS } from './adminShared';

const TYPE = {
  QUESTION_REPORT: {
    label: 'Reported question',
    icon: Flag,
    tone: 'warning',
    border: 'border-l-amber-400',
    bg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
    badgeBg: 'bg-amber-100 text-amber-700',
  },
  AI_ANSWER_REPORT: {
    label: 'Flagged AI answer',
    icon: Bot,
    tone: 'info',
    border: 'border-l-sky-400',
    bg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    iconBg: 'bg-sky-100',
    badgeBg: 'bg-sky-100 text-sky-700',
  },
  SAFETY_FLAG: {
    label: 'Safety flag',
    icon: ShieldAlert,
    tone: 'danger',
    border: 'border-l-rose-500',
    bg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-100',
    badgeBg: 'bg-rose-100 text-rose-700',
  },
};

const REASONS = {
  WRONG_ANSWER: 'Answer seems wrong',
  INCORRECT_ANSWER: 'Answer seems wrong',
  UNCLEAR: 'Unclear',
  NOT_IN_SYLLABUS: 'Not in syllabus',
  OTHER: 'Other',
};

/** Moderation queue (F12-09). Doubt content is visible here only because the student or safety filter flagged it (F12-12). */
function ModerationPageFull() {
  useDocumentTitle('Moderation');
  const [status, setStatus] = useState('OPEN');
  const { data, error, loading, refetch } = useQuery(
    `admin:moderation:${status}`,
    () => adminApi.moderation(status),
    { staleMs: 0 },
  );
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
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Moderation queue"
        subtitle="Reported questions and flagged AI answers, with minimum personal data."
      />

      <Tabs
        className="mb-5"
        value={status}
        onChange={setStatus}
        tabs={[
          { value: 'OPEN', label: 'Open' },
          { value: 'RESOLVED', label: 'Resolved' },
          ...(ADMIN_CAPS ? [{ value: 'DISMISSED', label: 'Dismissed' }] : []),
        ]}
      />

      {loading && !data ? (
        <PageSkeleton rows={1} />
      ) : !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-ink-100 bg-white py-16 text-center shadow-card">
          <span className="mb-3 text-5xl" role="img" aria-label="All clear">🧹</span>
          <p className="font-display text-xl font-bold text-ink-800">All clear</p>
          <p className="mt-1 text-sm text-ink-500">Nothing is waiting for review. Great work!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.items.map((m) => {
            const t = TYPE[m.type] || TYPE.QUESTION_REPORT;
            const Icon = t.icon;
            const isResolved = m.status !== 'OPEN';

            return (
              <div
                key={m.id}
                className={`relative overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition-shadow hover:shadow-lift border-l-4 ${t.border} ${isResolved ? 'opacity-80' : ''}`}
              >
                <div className="p-4 sm:p-5">
                  {/* ── Card header ── */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Type badge */}
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${t.badgeBg}`}>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-md ${t.iconBg}`}>
                          <Icon className={`h-3.5 w-3.5 ${t.iconColor}`} aria-hidden="true" />
                        </span>
                        {t.label}
                      </span>

                      {/* Reason chip */}
                      {m.reason && (
                        <span className="chip">
                          {REASONS[m.reason] || m.reason}
                        </span>
                      )}

                      {/* Topic chip */}
                      {m.topicName && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                          <BookOpen className="h-3 w-3" aria-hidden="true" />
                          {m.topicName}
                        </span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="flex items-center gap-1 whitespace-nowrap text-xs text-ink-400">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatDateTime(m.at)}
                      {m.studentRef && <span className="ml-1 opacity-70">· {m.studentRef}</span>}
                    </span>
                  </div>

                  {/* ── Question content ── */}
                  {m.question && (
                    <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50 p-3">
                      {!ADMIN_CAPS && (
                        <p className="mb-1.5 font-mono text-[11px] text-ink-400">{m.questionId}</p>
                      )}
                      <div className="text-sm text-ink-800">
                        <MathText text={m.question.text} />
                      </div>
                    </div>
                  )}

                  {/* ── AI snapshot content ── */}
                  {m.snapshot && (
                    <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50 p-3 text-sm">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        Conversation snapshot
                      </p>
                      <div className="mt-2 space-y-2">
                        <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Student asked</p>
                          <p className="text-ink-800">{m.snapshot.input}</p>
                        </div>
                        {m.snapshot.concept && (
                          <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Concept</p>
                            <p className="text-ink-800">{m.snapshot.concept}</p>
                          </div>
                        )}
                        {m.snapshot.steps && (
                          <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">AI Steps</p>
                            <ol className="list-decimal pl-4 space-y-1 text-ink-800">
                              {m.snapshot.steps.map((s) => (
                                <li key={s}><MathText text={s} /></li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Resolution note ── */}
                  {m.note && (
                    <p className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-sm italic text-ink-600">
                      "{m.note}"
                    </p>
                  )}

                  {/* ── Safety flag notice ── */}
                  {m.type === 'SAFETY_FLAG' && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
                      <span>
                        The student received the safe, trusted-adult response. Content is not shown to protect the student; escalate per the safeguarding process.
                      </span>
                    </div>
                  )}

                  {/* ── Footer: resolution status or action ── */}
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
                    {isResolved ? (
                      <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                        </span>
                        {(m.resolution || m.status).replace(/_/g, ' ').toLowerCase()}
                        {m.resolvedBy && <span className="text-ink-500">by {m.resolvedBy}</span>}
                        {m.resolutionNote && <span className="text-ink-500">· {m.resolutionNote}</span>}
                      </p>
                    ) : (
                      <span />
                    )}
                    {m.status === 'OPEN' && (
                      <Button
                        size="sm"
                        rightIcon={ChevronRight}
                        onClick={() => setResolving(m)}
                        aria-label={`Review moderation item ${m.id}`}
                      >
                        Review
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Resolve modal ── */}
      <Modal
        open={Boolean(resolving)}
        onClose={() => setResolving(null)}
        title="Resolve item"
        description="Your action is recorded in the audit log."
      >
        <TextArea
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
        />
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="success" leftIcon={CheckCircle2} loading={busy} onClick={() => resolve('CORRECTED')}>
            Mark corrected
          </Button>
          {resolving?.questionId && (
            <Button variant="danger" leftIcon={Flag} loading={busy} onClick={() => resolve('RETIRED_QUESTION')}>
              Retire question
            </Button>
          )}
          {resolving?.type !== 'QUESTION_REPORT' && !ADMIN_CAPS && (
            <Button variant="secondary" leftIcon={Bot} loading={busy} onClick={() => resolve('ANNOTATED_KB')}>
              Annotate knowledge base
            </Button>
          )}
          {(ADMIN_CAPS || resolving?.type === 'SAFETY_FLAG') && (
            <Button variant="secondary" leftIcon={ShieldAlert} loading={busy} onClick={() => resolve('ESCALATED')}>
              Escalate
            </Button>
          )}
          <Button variant="outline" loading={busy} onClick={() => resolve('DISMISSED')}>
            Dismiss
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function ModerationPage() {
  if (!supports('moderation')) {
    return (
      <ComingSoon
        title="Moderation queue"
        subtitle="The backend has no reported-question or flagged-answer endpoints yet."
        emoji="🛡️"
        points={['Reported questions', 'Flagged AI answers', 'Safety flags', 'Resolve with audit trail']}
        primary={{ to: '/admin', label: 'Back to dashboard' }}
      />
    );
  }
  return <ModerationPageFull />;
}
