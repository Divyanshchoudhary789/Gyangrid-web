const SYMBOLS = ['+', '−', '×', '÷', '=', '(', ')', '^', '√', 'π', '²', '³', '/', '≤', '≥', '°', 'x', 'y', '∠', '△'];

/** One-tap maths symbols for typed doubts (F7 input table: "maths keypad for common symbols"). */
export function MathKeypad({ onInsert }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Maths symbols">
      {SYMBOLS.map((s) => (
        <button
          key={s}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(s)}
          className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-ink-200 bg-white px-2 font-display text-lg font-semibold text-ink-700 transition hover:border-brand-300 hover:bg-brand-50 active:scale-95"
          aria-label={`Insert ${s}`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
