import { memo, useMemo } from 'react';
import { Lightbulb, PenLine } from 'lucide-react';
import { MathText } from './MathText';

/**
 * Renders study material written in "GG-Markdown" (a safe subset, no raw HTML):
 *   ## Heading · - bullet · > tip · >> worked example · $$display$$ · **bold** · $inline$
 */
function parse(src = '') {
  const blocks = [];
  let list = null;
  src.split(/\r?\n/).forEach((raw) => {
    const line = raw.trimEnd();
    if (/^\s*-\s+/.test(line)) {
      if (!list) { list = { type: 'list', items: [] }; blocks.push(list); }
      list.items.push(line.replace(/^\s*-\s+/, ''));
      return;
    }
    list = null;
    if (!line.trim()) return;
    if (line.startsWith('## ')) blocks.push({ type: 'h', text: line.slice(3) });
    else if (line.startsWith('>> ')) blocks.push({ type: 'example', text: line.slice(3) });
    else if (line.startsWith('> ')) blocks.push({ type: 'tip', text: line.slice(2) });
    else if (/^\$\$.+\$\$$/.test(line.trim())) blocks.push({ type: 'formula', text: line.trim() });
    else blocks.push({ type: 'p', text: line });
  });
  return blocks;
}

export const RichText = memo(function RichText({ source }) {
  const blocks = useMemo(() => parse(source), [source]);
  return (
    <div className="space-y-3.5 text-[15.5px] leading-relaxed text-ink-700">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h':
            return <h3 key={i} className="pt-2 text-lg font-bold text-ink-900 first:pt-0">{b.text}</h3>;
          case 'list':
            return (
              <ul key={i} className="space-y-2">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                    <MathText text={it} />
                  </li>
                ))}
              </ul>
            );
          case 'formula':
            return (
              <div key={i} className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white px-4 py-3 text-center text-ink-900">
                <MathText text={b.text} />
              </div>
            );
          case 'example':
            return (
              <div key={i} className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700"><PenLine className="h-3.5 w-3.5" aria-hidden /> Example</p>
                <MathText text={b.text} className="text-ink-800" />
              </div>
            );
          case 'tip':
            return (
              <div key={i} className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                <MathText text={b.text} className="text-amber-950" />
              </div>
            );
          default:
            return <p key={i}><MathText text={b.text} /></p>;
        }
      })}
    </div>
  );
});
