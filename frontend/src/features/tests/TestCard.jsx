import { Link } from 'react-router-dom';
import { Clock, FileQuestion, Lock, CheckCircle2, PlayCircle, Award, MinusCircle } from 'lucide-react';
import { Badge } from '@/components/ui';
import { humanDuration } from '@/lib/date';
import { cn } from '@/lib/cn';

export const STATUS_BADGE = {
  AVAILABLE: { tone: 'brand', label: 'Available', icon: PlayCircle },
  IN_PROGRESS: { tone: 'warning', label: 'In progress', icon: Clock },
  COMPLETED: { tone: 'success', label: 'Completed', icon: CheckCircle2 },
  LOCKED: { tone: 'neutral', label: 'Locked', icon: Lock },
};

export function TestCard({ test, compact }) {
  const s = STATUS_BADGE[test.status];
  const locked = test.status === 'LOCKED';
  const Wrapper = locked ? 'div' : Link;
  return (
    <Wrapper
      to={locked ? undefined : test.status === 'COMPLETED' && !test.canReattempt ? `/tests/result/${test.firstAttempt.attemptId}` : `/tests/${test.id}`}
      className={cn('card flex h-full flex-col p-5', locked ? 'cursor-not-allowed opacity-70' : 'card-hover')}
      aria-disabled={locked || undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>
        {test.firstAttempt && <span className="flex items-center gap-1 font-display text-lg font-bold text-emerald-600"><Award className="h-5 w-5" />{test.firstAttempt.scorePct}%</span>}
      </div>
      <h3 className="mt-3 font-bold leading-snug text-ink-900">{test.title}</h3>
      {!compact && test.chapters?.length > 0 && <p className="mt-1 line-clamp-1 text-sm text-ink-500">{test.chapters.length > 3 ? `${test.chapters.length} chapters` : test.chapters.join(' · ')}</p>}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-xs font-semibold text-ink-500">
        <span className="flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" />{test.questionCount} Qs</span>
        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{humanDuration(test.durationSec)}</span>
        <span>{test.totalMarks} marks</span>
        {test.negativeMarks > 0 && <span className="flex items-center gap-1 text-rose-500"><MinusCircle className="h-3.5 w-3.5" />−{test.negativeMarks}</span>}
      </div>
      {locked && <p className="mt-3 text-xs font-semibold text-ink-500">🔒 Finish the previous test to unlock</p>}
    </Wrapper>
  );
}
