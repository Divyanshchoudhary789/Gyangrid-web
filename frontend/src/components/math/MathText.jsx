import { memo, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/cn';

/**
 * One renderer for all maths on the web (F3-07): questions, explanations, AI answers and material
 * are stored as text with $inline$ and $$display$$ LaTeX.
 *
 * Security: plain-text segments are rendered as React text (escaped). Only KaTeX's own output is set as
 * HTML, with `trust: false` so commands like \href / \url / \htmlClass cannot inject links or markup.
 */
const cache = new Map();

function renderTex(tex, displayMode) {
  const key = `${displayMode ? 'D' : 'I'}:${tex}`;
  if (cache.has(key)) return cache.get(key);
  let html;
  try {
    html = katex.renderToString(tex, { displayMode, throwOnError: false, trust: false, strict: 'ignore', output: 'htmlAndMathml', maxExpand: 500 });
  } catch {
    html = null;
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, html);
  return html;
}

export function tokenize(text = '') {
  const out = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    out.push(m[1] != null ? { t: 'display', v: m[1] } : { t: 'inline', v: m[2] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

function renderInlineMarks(str, keyBase) {
  // **bold** only; everything else stays literal text
  const parts = str.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**')
    ? <strong key={`${keyBase}-${i}`} className="font-semibold text-ink-900">{p.slice(2, -2)}</strong>
    : p));
}

export const MathText = memo(function MathText({ text, className, as: Comp = 'span', block }) {
  const nodes = useMemo(() => tokenize(String(text ?? '')), [text]);
  return (
    <Comp className={cn('math-text', block && 'block', className)}>
      {nodes.map((n, i) => {
        if (n.t === 'text') return <span key={i}>{renderInlineMarks(n.v, i)}</span>;
        const html = renderTex(n.v, n.t === 'display');
        if (html == null) return <code key={i}>{n.v}</code>;
        return n.t === 'display'
          ? <span key={i} className="my-2 block" dangerouslySetInnerHTML={{ __html: html }} />
          : <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </Comp>
  );
});
