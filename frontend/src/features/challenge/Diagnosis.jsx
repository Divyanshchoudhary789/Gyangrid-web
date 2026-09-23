import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

const STATUS = {
  STRONG: { label: 'Strong', cls: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500', emoji: '💪' },
  PARTIAL: { label: 'Partial', cls: 'bg-amber-100 text-amber-800', bar: 'bg-amber-400', emoji: '🙂' },
  NEEDS_PRACTICE: { label: 'Needs practice', cls: 'bg-rose-100 text-rose-700', bar: 'bg-rose-400', emoji: '🎯' },
};

/** Topic diagnosis (F5-08). Weak areas are framed as next steps, never as failure (F9-05). */
export function DiagnosisList({ items }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 bg-ink-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-500">
        <span>Topic</span><span className="w-14 text-right">Accuracy</span><span className="w-28 text-right sm:w-32">Status</span>
      </div>
      {items.map((d) => {
        const s = STATUS[d.status];
        return (
          <Link key={d.topicId} to={`/learn/topic/${d.topicId}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-ink-100 px-4 py-3 transition hover:bg-ink-50">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink-900">{d.name}</span>
              <span className="mt-1.5 block h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-ink-100"><span className={cn('block h-full rounded-full', s.bar)} style={{ width: `${d.accuracy}%` }} /></span>
            </span>
            <span className="w-14 text-right font-display font-bold text-ink-800">{d.accuracy}%</span>
            <span className="flex w-28 justify-end sm:w-32"><span className={cn('chip', s.cls)}><span aria-hidden>{s.emoji}</span>{s.label}</span></span>
          </Link>
        );
      })}
    </div>
  );
}
