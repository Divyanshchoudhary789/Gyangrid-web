import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Delete, ChevronLeft, ChevronRight, Keyboard, Wand2, History, ChevronDown } from 'lucide-react';
import { Tabs } from '@/components/ui';
import { storage } from '@/lib/storage';
import { cn } from '@/lib/cn';
import { CATEGORIES, applySmartReplace, keyByInsert, searchKeys, toScript } from './mathInput';

const RECENT_KEY = 'math-recent';
const SMART_KEY = 'math-smart';
const MAX_RECENT = 16;

/** Inserts text at the cursor through the browser's own editing path, so Ctrl/⌘+Z still works. */
function insertAtCursor(el, text) {
  el.focus();
  const ok = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
  if (!ok) {
    el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function Key({ k, onPress }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      // Keep the textarea focused (and the phone keyboard where it is) while tapping keys.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPress(k)}
      title={k.name}
      aria-label={`Insert ${k.name}`}
      className={cn(
        'flex h-11 items-center justify-center rounded-xl border bg-white px-2 font-display font-semibold text-ink-800 shadow-[0_1px_0_rgba(15,23,42,0.06)] transition hover:-translate-y-px hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-visible:ring-4 focus-visible:ring-brand-500/25',
        k.wide ? 'col-span-2 text-[15px]' : 'text-lg',
        k.template ? 'border-violet-200 bg-violet-50/60 text-violet-800' : 'border-ink-200',
      )}
    >
      <span className="truncate">{k.label}</span>
    </motion.button>
  );
}

function ModeToggle({ active, onClick, label, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-9 min-w-9 items-center justify-center rounded-lg px-2 font-display text-sm font-bold transition',
        active ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-brand-50 hover:text-brand-700',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Text input built for maths: a symbol keyboard with categories, search and templates, super/subscript
 * typing, and smart shortcuts (<= → ≤). The value is plain Unicode text, which the AI tutor reads as written.
 */
export const MathComposer = forwardRef(function MathComposer(
  { value, onChange, label, placeholder, maxLength = 1000, rows = 5, compact = false, autoFocus = false, disabled = false, id },
  ref,
) {
  const autoId = useId();
  const fieldId = id || autoId;
  const el = useRef(null);
  const [open, setOpen] = useState(!compact);
  const [category, setCategory] = useState('basic');
  const [query, setQuery] = useState('');
  const [script, setScript] = useState(null); // null | 'sup' | 'sub'
  const [smart, setSmart] = useState(() => storage.get(SMART_KEY, true) !== false);
  const [recent, setRecent] = useState(() => storage.get(RECENT_KEY, []));

  useImperativeHandle(ref, () => el.current);
  useEffect(() => { if (autoFocus) el.current?.focus(); }, [autoFocus]);

  const remember = useCallback((insert) => {
    setRecent((list) => {
      const next = [insert, ...list.filter((x) => x !== insert)].slice(0, MAX_RECENT);
      storage.set(RECENT_KEY, next);
      return next;
    });
  }, []);

  const press = (k) => {
    const node = el.current;
    if (!node || disabled) return;
    const text = script ? toScript(k.insert, script) : k.insert;
    const start = node.selectionStart;
    insertAtCursor(node, text);
    if (k.caret != null && !script) {
      const pos = start + k.caret;
      requestAnimationFrame(() => node.setSelectionRange(pos, pos));
    }
    remember(k.insert);
  };

  const editKey = (action) => {
    const node = el.current;
    if (!node || disabled) return;
    node.focus();
    const { selectionStart: s, selectionEnd: e } = node;
    if (action === 'left') node.setSelectionRange(Math.max(0, s - 1), Math.max(0, s - 1));
    else if (action === 'right') node.setSelectionRange(Math.min(node.value.length, e + 1), Math.min(node.value.length, e + 1));
    else if (action === 'delete') {
      if (s === e && s > 0) node.setSelectionRange(s - 1, e);
      if (!(typeof document.execCommand === 'function' && document.execCommand('delete'))) {
        node.setRangeText('', node.selectionStart, node.selectionEnd, 'end');
        node.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };

  // Superscript / subscript typing works for hardware and phone keyboards alike.
  const onBeforeInput = (e) => {
    const data = e.nativeEvent?.data ?? e.data;
    if (!script || !data || e.nativeEvent?.inputType?.startsWith('insertComposition')) return;
    const converted = toScript(data, script);
    if (converted === data) return;
    e.preventDefault();
    insertAtCursor(e.currentTarget, converted);
  };

  const handleChange = (e) => {
    const node = e.target;
    const typed = e.nativeEvent?.inputType === 'insertText';
    if (smart && typed && !script) {
      const r = applySmartReplace(node.value, node.selectionStart);
      if (r && r.value.length <= maxLength) {
        onChange(r.value);
        requestAnimationFrame(() => node.setSelectionRange(r.caret, r.caret));
        return;
      }
    }
    onChange(node.value);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && script) { e.preventDefault(); setScript(null); }
  };

  const toggleSmart = () => setSmart((v) => { storage.set(SMART_KEY, !v); return !v; });

  const tabs = useMemo(() => [
    ...(recent.length ? [{ value: 'recent', label: 'Recent', icon: History }] : []),
    ...CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
  ], [recent.length]);

  const keys = useMemo(() => {
    if (query.trim()) return searchKeys(query);
    if (category === 'recent') return recent.map((ins) => keyByInsert(ins) || { id: ins, label: ins, insert: ins, name: ins });
    return CATEGORIES.find((c) => c.id === category)?.keys || [];
  }, [category, query, recent]);

  const count = value.length;
  const near = count > maxLength * 0.9;

  return (
    <div className={cn('rounded-2xl border border-ink-200 bg-white transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10', disabled && 'opacity-60')}>
      {label && <label htmlFor={fieldId} className="block px-4 pt-3 text-sm font-semibold text-ink-800">{label}</label>}
      <textarea
        ref={el}
        id={fieldId}
        value={value}
        onChange={handleChange}
        onBeforeInput={onBeforeInput}
        onKeyDown={onKeyDown}
        maxLength={maxLength}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        aria-describedby={`${fieldId}-hint`}
        className="block w-full resize-y border-0 bg-transparent px-4 py-3 font-display text-[17px] leading-relaxed text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-0"
      />

      {/* Status strip: active typing mode, shortcuts hint and length */}
      <div id={`${fieldId}-hint`} className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <ModeToggle active={script === 'sup'} onClick={() => setScript((m) => (m === 'sup' ? null : 'sup'))} label="Superscript typing (powers)">x<sup className="text-[10px]">2</sup></ModeToggle>
          <ModeToggle active={script === 'sub'} onClick={() => setScript((m) => (m === 'sub' ? null : 'sub'))} label="Subscript typing">x<sub className="text-[10px]">2</sub></ModeToggle>
          <ModeToggle active={smart} onClick={toggleSmart} label="Smart symbols: type <= for ≤, != for ≠, ^2 for ²"><Wand2 className="h-4 w-4" /></ModeToggle>
          <AnimatePresence>
            {script && (
              <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="rounded-full bg-brand-100 px-2.5 py-1 font-semibold text-brand-700">
                Typing {script === 'sup' ? 'powers ↑' : 'subscripts ↓'} · Esc to stop
              </motion.span>
            )}
          </AnimatePresence>
          {!script && smart && <span className="hidden text-ink-400 sm:inline">Tip: type &lt;= for ≤, != for ≠, ^2 for ²</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('tabular-nums', near ? 'font-semibold text-amber-600' : 'text-ink-400')}>{count}/{maxLength}</span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-brand-700 hover:bg-brand-50"
          >
            <Keyboard className="h-4 w-4" aria-hidden />{open ? 'Hide' : 'Maths'} keyboard
            <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} aria-hidden />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 rounded-b-2xl border-t border-ink-100 bg-ink-50/70 p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <Tabs className="min-w-0 flex-1" size="sm" ariaLabel="Symbol groups" value={query ? '' : category} onChange={(v) => { setCategory(v); setQuery(''); }} tabs={tabs} />
                <div className="relative lg:w-56">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
                  <input
                    type="text"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    value={query}
                    onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a symbol: theta, root…"
                    aria-label="Search maths symbols"
                    className="h-9 w-full rounded-lg border border-ink-200 bg-white pl-8 pr-8 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                  {query && <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700" aria-label="Clear search"><X className="h-4 w-4" /></button>}
                </div>
              </div>

              <div role="toolbar" aria-label="Maths symbols" className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(2.9rem,1fr))] gap-1.5 overflow-y-auto pr-0.5">
                {keys.map((key) => <Key key={key.id} k={key} onPress={press} />)}
                {keys.length === 0 && <p className="col-span-full py-4 text-center text-sm text-ink-500">No symbol called “{query}”. Try “root”, “angle” or “theta”.</p>}
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-ink-500"><span className="font-semibold text-violet-700">Purple keys</span> put the cursor inside the brackets for you.</p>
                <div className="flex gap-1.5">
                  {[['left', ChevronLeft, 'Move cursor left'], ['right', ChevronRight, 'Move cursor right'], ['delete', Delete, 'Delete']].map(([action, Icon, name]) => (
                    <button key={action} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editKey(action)} aria-label={name} title={name}
                      className="flex h-9 w-10 items-center justify-center rounded-lg bg-white text-ink-600 ring-1 ring-ink-200 transition hover:bg-ink-100 active:scale-95"
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
