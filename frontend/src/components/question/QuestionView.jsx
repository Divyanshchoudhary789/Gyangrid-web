import { useEffect, useState } from 'react';
import { Check, X, Flag, Lightbulb, ListOrdered, Delete } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { MathText } from '@/components/math/MathText';
import { Button, DifficultyBadge, Modal, TextArea, ChoiceCard } from '@/components/ui';
import { accountApi } from '@/services/api/student';
import { ERROR_CODES, errorMessage } from '@/services/errors';

/* ------------------------------------------------------------------ option button */
function OptionButton({ option, selected, state, disabled, onSelect }) {
  // state: undefined | 'correct' | 'wrong' | 'dim'
  return (
    <button
      type="button"
      onClick={() => onSelect(option.key)}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'group flex w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3.5 text-left transition-all',
        'focus-visible:ring-4 focus-visible:ring-brand-500/25',
        !state && selected && 'border-brand-500 bg-brand-50 shadow-lift',
        !state && !selected && 'border-ink-100 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card',
        state === 'correct' && 'border-emerald-500 bg-emerald-50',
        state === 'wrong' && 'border-rose-400 bg-rose-50',
        state === 'dim' && 'border-ink-100 opacity-60',
        disabled && !state && 'cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition',
          state === 'correct' ? 'bg-emerald-500 text-white'
            : state === 'wrong' ? 'bg-rose-500 text-white'
              : state ? 'bg-ink-100 text-ink-600'
                : selected ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600 group-hover:bg-brand-100 group-hover:text-brand-700',
        )}
      >
        {state === 'correct' ? <Check className="h-5 w-5" /> : state === 'wrong' ? <X className="h-5 w-5" /> : /^[A-H]$/.test(option.key) ? option.key : <span className="h-3 w-3 rounded-full border-2 border-current" aria-hidden />}
      </span>
      <MathText text={option.text} className="text-[15.5px] font-medium text-ink-800" />
    </button>
  );
}

/* ------------------------------------------------------------------ numeric input + keypad */
// Phone-style layout: 7 8 9 ⌫ / 4 5 6 ± / 1 2 3 . / 0
const KEYS = ['7', '8', '9', 'DEL', '4', '5', '6', '-', '1', '2', '3', '.', '0'];
const finePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

export function NumericAnswer({ value, onChange, disabled, state, onSubmit, autoFocus }) {
  const push = (k) => {
    if (disabled) return undefined;
    if (k === 'DEL') return onChange(value.slice(0, -1));
    if (k === '-') return onChange(value.startsWith('-') ? value.slice(1) : `-${value}`);
    if (k === '.' && value.includes('.')) return undefined;
    return onChange(`${value}${k}`.slice(0, 14));
  };
  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          inputMode="decimal"
          autoComplete="off"
          // On touch devices our keypad is shown, so don't pop the system keyboard over it
          autoFocus={autoFocus && finePointer()}
          aria-label="Your answer"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.\-/]/g, '').slice(0, 14))}
          onKeyDown={(e) => { if (e.key === 'Enter' && value && onSubmit) onSubmit(); }}
          placeholder="Type your answer"
          className={cn(
            'input h-14 text-center font-display text-2xl font-bold tracking-wide',
            state === 'correct' && 'border-emerald-500 bg-emerald-50 text-emerald-800',
            state === 'wrong' && 'border-rose-400 bg-rose-50 text-rose-800',
          )}
        />
        {state && (
          <span className={cn('absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white', state === 'correct' ? 'bg-emerald-500' : 'bg-rose-500')}>
            {state === 'correct' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </span>
        )}
      </div>
      {!disabled && (
        <div className="grid grid-cols-4 gap-2 sm:hidden" aria-label="Number keypad">
          {KEYS.map((k) => (
            <button
              key={k} type="button" onClick={() => push(k)}
              aria-label={k === 'DEL' ? 'Delete last digit' : k === '-' ? 'Plus or minus' : k === '.' ? 'Decimal point' : k}
              className={cn('flex h-12 items-center justify-center rounded-xl font-display text-lg font-bold text-ink-800 active:bg-brand-100', k === 'DEL' ? 'bg-ink-200' : 'bg-ink-100', k === '0' && 'col-span-4')}
            >
              {k === 'DEL' ? <Delete className="h-5 w-5" /> : k === '-' ? '±' : k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ short (free-text) answer */
export function TextAnswer({ value, onChange, disabled, state, onSubmit, autoFocus }) {
  return (
    <div className="relative">
      <input
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus={autoFocus && finePointer()}
        aria-label="Your answer"
        value={value}
        disabled={disabled}
        maxLength={100}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && value.trim() && onSubmit) onSubmit(); }}
        placeholder="Type your answer, e.g. 12 or 1/2"
        className={cn(
          'input h-14 pr-12 font-display text-xl font-semibold',
          state === 'correct' && 'border-emerald-500 bg-emerald-50 text-emerald-800',
          state === 'wrong' && 'border-rose-400 bg-rose-50 text-rose-800',
        )}
      />
      {state && (
        <span className={cn('absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white', state === 'correct' ? 'bg-emerald-500' : 'bg-rose-500')}>
          {state === 'correct' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </span>
      )}
      {!state && <p className="mt-2 text-xs text-ink-400">Write just the final answer. Press Enter to check.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ question */
/**
 * Renders one question. With `reveal` (the graded payload from the server), options/inputs show
 * correctness. The component never receives the correct answer before submission (F4-04).
 */
export function QuestionView({ question, value, onChange, disabled, reveal, onSubmit, number, total, showMeta = true, autoFocus }) {
  const locked = disabled || Boolean(reveal);

  useEffect(() => {
    if (locked || question.type !== 'MCQ_SINGLE') return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = ['1', '2', '3', '4'].indexOf(e.key) >= 0 ? Number(e.key) - 1 : ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
      if (idx >= 0 && question.options[idx]) onChange(question.options[idx].key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked, question, onChange]);

  const optionState = (key) => {
    if (!reveal) return undefined;
    if (key === reveal.correctAnswer) return 'correct';
    if (key === reveal.yourAnswer) return 'wrong';
    return 'dim';
  };

  return (
    <div>
      {showMeta && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {number != null && <span className="font-semibold text-ink-500">Question {number}{total ? ` of ${total}` : ''}</span>}
          <DifficultyBadge level={question.difficulty} />
        </div>
      )}
      <MathText as="div" text={question.questionText} className="text-lg font-semibold leading-relaxed text-ink-900 sm:text-xl" />
      {question.questionImageUrl && <img src={question.questionImageUrl} alt="Question diagram" className="mt-4 max-h-72 rounded-2xl border border-ink-100" loading="lazy" />}
      <div className="mt-6">
        {question.type === 'MCQ_SINGLE' ? (
          <div className="grid grid-cols-1 gap-2.5" role="radiogroup" aria-label="Options">
            {question.options.map((o) => (
              <OptionButton key={o.key} option={o} selected={value === o.key} state={optionState(o.key)} disabled={locked} onSelect={onChange} />
            ))}
          </div>
        ) : question.type === 'SHORT_ANSWER' ? (
          <TextAnswer value={value || ''} onChange={onChange} disabled={locked} onSubmit={onSubmit} autoFocus={autoFocus} state={reveal ? (reveal.correct ? 'correct' : 'wrong') : undefined} />
        ) : (
          <NumericAnswer value={value || ''} onChange={onChange} disabled={locked} onSubmit={onSubmit} autoFocus={autoFocus} state={reveal ? (reveal.correct ? 'correct' : 'wrong') : undefined} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ solution */
export function SolutionPanel({ result, compact }) {
  if (!result) return null;
  return (
    <div className={cn('space-y-4', !compact && 'mt-6')}>
      <div className={cn('flex items-start gap-3 rounded-2xl p-4', result.correct ? 'bg-emerald-50 text-emerald-900' : result.skipped ? 'bg-ink-100 text-ink-800' : 'bg-rose-50 text-rose-900')}>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white', result.correct ? 'bg-emerald-500' : result.skipped ? 'bg-ink-400' : 'bg-rose-500')}>
          {result.correct ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </span>
        <div className="min-w-0 text-sm">
          <p className="font-display text-base font-bold">
            {result.correct ? 'Correct! Well done.' : result.skipped ? 'Not answered' : "Not quite — that's how we learn."}
          </p>
          {!result.correct && (
            <p className="mt-1">
              {!result.skipped && <>Your answer: <MathText text={result.yourAnswerLabel} className="font-semibold" />{result.correctAnswerLabel ? ' · ' : ''}</>}
              {result.correctAnswerLabel && <>Correct answer: <MathText text={result.correctAnswerLabel} className="font-semibold" /></>}
            </p>
          )}
          {!result.correct && !result.skipped && result.mistakeSaved !== false && <p className="mt-1 text-xs opacity-80">Saved to your Mistake Bank so you can review it later.</p>}
        </div>
      </div>

      {result.explanation?.length > 0 && (
        <div className="rounded-2xl border border-ink-100 bg-white p-4 sm:p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-900"><ListOrdered className="h-4 w-4 text-brand-500" /> {result.explanation.length > 1 ? 'Step-by-step solution' : 'Solution'}</p>
          {result.explanation.length > 1 ? (
            <ol className="space-y-2.5">
              {result.explanation.map((s, i) => (
                <li key={i} className="flex gap-3 text-[15px] text-ink-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                  <MathText text={s} />
                </li>
              ))}
            </ol>
          ) : <MathText as="p" text={result.explanation[0]} className="text-[15px] leading-relaxed text-ink-700" />}
        </div>
      )}
      {result.conceptNote && (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
          <div><p className="font-bold">The concept</p><p className="mt-0.5 leading-relaxed">{result.conceptNote}</p></div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ report a question (F4-07) */
const REASONS = [
  { value: 'WRONG_ANSWER', label: 'The answer seems wrong', emoji: '❌' },
  { value: 'UNCLEAR', label: 'The question is unclear', emoji: '🤔' },
  { value: 'NOT_IN_SYLLABUS', label: 'Not in my syllabus', emoji: '📚' },
  { value: 'OTHER', label: 'Something else', emoji: '💬' },
];

export function ReportQuestionButton(props) {
  // Hidden until the backend exposes a report endpoint (see docs/PENDING_BACKEND_APIS.md).
  if (accountApi.canReportQuestion === false) return null;
  return <ReportQuestionDialog {...props} />;
}

function ReportQuestionDialog({ questionId, className }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await accountApi.reportQuestion({ questionId, reason, note });
      toast.success('Thanks! Our team will check this question.');
      setOpen(false);
      setReason('');
      setNote('');
    } catch (e) {
      if (e.code === ERROR_CODES.CONFLICT) { // already reported: nothing more for the student to do
        toast.info(errorMessage(e));
        setOpen(false);
      } else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink-400 hover:bg-ink-100 hover:text-ink-700', className)}>
        <Flag className="h-3.5 w-3.5" aria-hidden /> Report
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Report this question"
        description="Tell us what's wrong. We review every report."
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!reason} loading={busy} onClick={submit}>Send report</Button></>}
      >
        <div className="grid grid-cols-1 gap-2">
          {REASONS.map((r) => (
            <ChoiceCard key={r.value} selected={reason === r.value} onClick={() => setReason(r.value)} className="py-3">
              <span className="flex items-center gap-3 font-semibold text-ink-800"><span className="text-xl" aria-hidden>{r.emoji}</span>{r.label}</span>
            </ChoiceCard>
          ))}
        </div>
        <TextArea className="mt-4" label="Anything else? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Please don't include personal details." />
      </Modal>
    </>
  );
}
