import { memo, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/cn';
import { looksMathy, nodesToText, parsePlainMath } from './plainMath';

/**
 * One renderer for all maths on the web (F3-07): questions, explanations, AI answers and material
 * are stored as text with $inline$ and $$display$$ LaTeX (\( \) and \[ \] are accepted too).
 * Text outside those delimiters is often calculator-style maths from the AI (x^3, -1/3, sqrt(2));
 * plainMath turns it into real superscripts, fractions and roots.
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
  const re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    const display = m[1] ?? m[2];
    out.push(display != null ? { t: 'display', v: display } : { t: 'inline', v: m[3] ?? m[4] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

const isBox = (n) => n && typeof n === 'object' && (n.t === 'frac' || n.t === 'sqrt');

/**
 * Fractions and roots are inline boxes, and browsers may wrap a line on either side of a box.
 * Glue the characters touching a box (a sign before it, a "." or ")" after it) into one unbreakable
 * group so a line never ends in a lone "−" with the fraction on the next line.
 */
function glueBoxes(input) {
  if (!input.some(isBox)) return input;
  const nodes = [...input];
  const out = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    if (!isBox(n)) { out.push(n); continue; }
    const group = [n];
    const prev = out[out.length - 1];
    if (typeof prev === 'string') {
      const m = /\S+$/.exec(prev);
      if (m) { out[out.length - 1] = prev.slice(0, m.index); group.unshift(m[0]); }
    } else if (prev && prev.t === 'glue') {
      out.pop(); group.unshift(...prev.c);
    }
    const next = nodes[i + 1];
    if (typeof next === 'string') {
      const m = /^[^\s]+/.exec(next);
      // Only pull the next characters in when another box doesn't follow them (that one glues itself).
      if (m && !(m[0].length === next.length && isBox(nodes[i + 2]))) { group.push(m[0]); nodes[i + 1] = next.slice(m[0].length); }
    }
    out.push({ t: 'glue', c: group });
  }
  return out.filter((n) => n !== '');
}

function MathNodes({ nodes, glued = false }) {
  return (glued ? nodes : glueBoxes(nodes)).map((n, i) => {
    if (typeof n === 'string') return n;
    if (n.t === 'glue') return <span key={i} className="whitespace-nowrap"><MathNodes nodes={n.c} glued /></span>;
    if (n.t === 'sup') return <sup key={i} className="math-sup"><MathNodes nodes={n.c} /></sup>;
    if (n.t === 'sub') return <sub key={i} className="math-sub"><MathNodes nodes={n.c} /></sub>;
    if (n.t === 'frac') {
      return (
        <span key={i} className="math-frac" role="math" aria-label={nodesToText([n])}>
          <span className="math-frac-n" aria-hidden><MathNodes nodes={n.n} /></span>
          <span className="math-frac-d" aria-hidden><MathNodes nodes={n.d} /></span>
        </span>
      );
    }
    if (n.t === 'sqrt') {
      return (
        <span key={i} className="math-sqrt" role="math" aria-label={nodesToText([n])}>
          {n.root && <sup className="math-root-index" aria-hidden>{n.root}</sup>}
          <span className="math-sqrt-sign" aria-hidden>√</span>
          <span className="math-sqrt-body" aria-hidden><MathNodes nodes={n.c} /></span>
        </span>
      );
    }
    return null;
  });
}

function PlainMath({ text }) {
  const nodes = useMemo(() => (looksMathy(text) ? parsePlainMath(text) : null), [text]);
  return nodes ? <MathNodes nodes={nodes} /> : text;
}

function renderInlineMarks(str, keyBase) {
  // **bold** only; everything else is literal text, with calculator-style maths formatted
  const parts = str.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4
    ? <strong key={`${keyBase}-${i}`} className="font-semibold text-ink-900"><PlainMath text={p.slice(2, -2)} /></strong>
    : <PlainMath key={`${keyBase}-${i}`} text={p} />));
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
