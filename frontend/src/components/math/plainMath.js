/**
 * Plain-text maths → a small display tree.
 *
 * AI answers (and some typed content) arrive as calculator-style text: `3x^3 - 5x^2`, `(-1/3)^2`,
 * `sqrt(2)`, `a_1`, `<=`, sometimes stray LaTeX like `\frac{1}{3}` without $ delimiters.
 * This parser turns that into nodes that MathText renders as real superscripts, subscripts,
 * stacked fractions and roots. It never produces HTML, so it adds no injection surface.
 *
 * Node shapes:
 *   string                         plain text (already symbol-substituted)
 *   { t: 'sup' | 'sub', c: Node[] }
 *   { t: 'frac', n: Node[], d: Node[] }
 *   { t: 'sqrt', c: Node[], root?: string }
 */

const GREEK_WORDS = { pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', lambda: 'λ', sigma: 'σ', phi: 'φ', omega: 'ω', Delta: 'Δ' };

const LATEX_SYMBOLS = {
  times: '×', div: '÷', cdot: '·', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠',
  approx: '≈', equiv: '≡', infty: '∞', circ: '°', degree: '°', angle: '∠', triangle: '△', parallel: '∥', perp: '⊥',
  therefore: '∴', because: '∵', rightarrow: '→', Rightarrow: '⇒', to: '→', implies: '⇒', iff: '⇔', in: '∈', notin: '∉',
  cup: '∪', cap: '∩', subset: '⊂', subseteq: '⊆', emptyset: '∅', sum: 'Σ', ldots: '…', cdots: '⋯', dots: '…',
  pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', lambda: 'λ', mu: 'μ', sigma: 'σ', phi: 'φ', omega: 'ω',
  left: '', right: '', quad: ' ', qquad: '  ', ',': ' ', ';': ' ', '!': '', '{': '{', '}': '}', '%': '%', '$': '$',
};

// Longest first so `<=>` wins over `<=`.
const TEXT_SYMBOLS = [
  ['<=>', '⇔'], ['<=', '≤'], ['>=', '≥'], ['!=', '≠'], ['=/=', '≠'], ['+-', '±'], ['+/-', '±'], ['->', '→'], ['=>', '⇒'], ['~=', '≈'],
];

const isWordChar = (ch) => !!ch && /[A-Za-z0-9]/.test(ch);
const isLetter = (ch) => !!ch && /[A-Za-z]/.test(ch);

/** Symbol substitution for a run of plain text. */
export function prettifySymbols(s) {
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    const sym = TEXT_SYMBOLS.find(([k]) => s.startsWith(k, i));
    if (sym) { out += sym[1]; i += sym[0].length - 1; continue; }
    if (ch === '*' && s[i + 1] !== '*' && s[i - 1] !== '*') { out += '×'; continue; }
    if (ch === '-') {
      // A hyphen between two letters is a word hyphen (step-by-step); anything else here is a minus sign.
      if (!(isLetter(s[i - 1]) && isLetter(s[i + 1])) && s[i + 1] !== '-' && s[i - 1] !== '-') { out += '−'; continue; }
    }
    if (isLetter(ch) && !isLetter(s[i - 1])) {
      const m = /^[A-Za-z]+/.exec(s.slice(i))[0];
      if (GREEK_WORDS[m]) { out += GREEK_WORDS[m]; i += m.length - 1; continue; }
      out += m; i += m.length - 1; continue;
    }
    out += ch;
  }
  // Keep an operator with the term after it, so a line never ends in a dangling "−" or "=".
  return out.replace(/([−+=×÷±≤≥≠≈→⇒]) (?=\S)/g, '$1\u00A0');
}

/** Index of the bracket that closes the one at `open`, or -1. */
function matchClose(s, open) {
  const o = s[open];
  const c = o === '(' ? ')' : o === '{' ? '}' : ']';
  let depth = 0;
  for (let i = open; i < s.length; i += 1) {
    if (s[i] === o) depth += 1;
    else if (s[i] === c) { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

// A fraction operand: a number (1, 2.5), a number with a variable (2x), or one letter (a, b).
const OPERAND = /^(?:\d+(?:\.\d+)?[A-Za-z]?|[A-Za-z])(?![A-Za-z0-9])/;

/** Reads a script (power / index) after ^ or _ at `i`. Returns [content, endIndex] or null. */
function readScript(s, i) {
  const ch = s[i];
  if (ch === '{' || ch === '(') {
    const end = matchClose(s, i);
    if (end > i + 1) return [s.slice(i + 1, end), end + 1];
    return null;
  }
  const m = /^[-+−]?(?:\d+(?:\.\d+)?|[A-Za-z](?![A-Za-z]{2})|°)/.exec(s.slice(i));
  if (m) return [m[0], i + m[0].length];
  return null;
}

/** Tries to read a fraction that starts at `i`. Returns { n, d, end } or null. */
function readFraction(s, i) {
  const prev = s[i - 1];
  if (prev && (/[A-Za-z0-9./^_]/.test(prev))) return null;
  let numer;
  let j;
  if (s[i] === '(') {
    const close = matchClose(s, i);
    if (close < 0 || s[close + 1] !== '/') return null;
    numer = s.slice(i + 1, close);
    j = close + 1;
  } else {
    const m = OPERAND.exec(s.slice(i));
    if (!m || s[i + m[0].length] !== '/') return null;
    numer = m[0];
    j = i + m[0].length;
  }
  // j points at '/'
  let denom;
  let end;
  if (s[j + 1] === '(') {
    const close = matchClose(s, j + 1);
    if (close < 0) return null;
    denom = s.slice(j + 2, close);
    end = close + 1;
  } else {
    const m = OPERAND.exec(s.slice(j + 1));
    if (!m) return null;
    denom = m[0];
    end = j + 1 + m[0].length;
  }
  // Dates and paths (1/2/2026, a/b/c) are not fractions.
  if (s[end] === '/' || (s[end] && /[A-Za-z0-9]/.test(s[end]))) return null;
  if (!numer.trim() || !denom.trim()) return null;
  return { n: numer, d: denom, end };
}

/** Reads a `{...}` LaTeX argument at `i` (skipping spaces). Returns [content, end] or null. */
function readArg(s, i) {
  let k = i;
  while (s[k] === ' ') k += 1;
  if (s[k] !== '{') return null;
  const close = matchClose(s, k);
  return close < 0 ? null : [s.slice(k + 1, close), close + 1];
}

const MAX_DEPTH = 6;

/** Parses plain-text maths into display nodes. */
export function parsePlainMath(src, depth = 0) {
  const s = String(src ?? '');
  const nodes = [];
  let buf = '';
  const flush = () => { if (buf) { nodes.push(prettifySymbols(buf)); buf = ''; } };
  if (depth > MAX_DEPTH) return [prettifySymbols(s)];

  for (let i = 0; i < s.length;) {
    const ch = s[i];

    // Stray LaTeX commands: \frac{a}{b}, \sqrt{x}, \sqrt[3]{x}, \times, \pi …
    if (ch === '\\') {
      const name = /^\\([A-Za-z]+|[,;!{}%$])/.exec(s.slice(i));
      if (name) {
        const cmd = name[1];
        const after = i + name[0].length;
        if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
          const a = readArg(s, after);
          const b = a && readArg(s, a[1]);
          if (a && b) { flush(); nodes.push({ t: 'frac', n: parsePlainMath(a[0], depth + 1), d: parsePlainMath(b[0], depth + 1) }); i = b[1]; continue; }
        }
        if (cmd === 'sqrt') {
          let k = after;
          let root;
          if (s[k] === '[') { const close = s.indexOf(']', k); if (close > k) { root = s.slice(k + 1, close); k = close + 1; } }
          const a = readArg(s, k);
          if (a) { flush(); nodes.push({ t: 'sqrt', c: parsePlainMath(a[0], depth + 1), root }); i = a[1]; continue; }
        }
        if (cmd === 'text' || cmd === 'mathrm' || cmd === 'mathbf' || cmd === 'operatorname') {
          const a = readArg(s, after);
          if (a) { buf += a[0]; i = a[1]; continue; }
        }
        if (cmd in LATEX_SYMBOLS) {
          // Keep these out of prettifySymbols so e.g. \to doesn't become "→" twice.
          flush(); nodes.push(LATEX_SYMBOLS[cmd]);
          i = after;
          continue;
        }
      }
    }

    // Powers and indices: x^2, (−1/3)^3, 2^(n+1), x^{10}, a_1, x_{n}
    if ((ch === '^' || ch === '_') && i > 0) {
      const script = readScript(s, i + 1);
      // For `_` require a letter/digit/bracket base so snake_case words stay as they are.
      const okBase = ch === '^' || /[A-Za-z)\]}]/.test(s[i - 1]);
      if (script && okBase && !(ch === '_' && isLetter(s[i + 1]) && isLetter(s[i + 2]))) {
        flush();
        nodes.push({ t: ch === '^' ? 'sup' : 'sub', c: parsePlainMath(script[0], depth + 1) });
        i = script[1];
        continue;
      }
    }

    // Roots: sqrt(x), √(x), cbrt(x), ∛(x)
    const rootWord = /^(sqrt|cbrt|√|∛)\s?\(/.exec(s.slice(i));
    if (rootWord && !isWordChar(s[i - 1])) {
      const open = i + rootWord[0].length - 1;
      const close = matchClose(s, open);
      if (close > open + 1) {
        flush();
        const cube = rootWord[1] === 'cbrt' || rootWord[1] === '∛';
        nodes.push({ t: 'sqrt', c: parsePlainMath(s.slice(open + 1, close), depth + 1), root: cube ? '3' : undefined });
        i = close + 1;
        continue;
      }
    }

    // Fractions: 1/3, -b/a, 2x/5, (x+1)/(x−1)
    if (ch === '(' || /[A-Za-z0-9]/.test(ch)) {
      const f = readFraction(s, i);
      if (f) {
        flush();
        nodes.push({ t: 'frac', n: parsePlainMath(f.n, depth + 1), d: parsePlainMath(f.d, depth + 1) });
        i = f.end;
        continue;
      }
    }

    buf += ch;
    i += 1;
  }
  flush();
  return nodes;
}

/** Cheap check so plain prose skips the parser entirely. */
export function looksMathy(s) {
  return /[\^_/\\*]|<=|>=|!=|\+-|->|sqrt|cbrt|√|∛|\d\s*-|-\s*\d|\bpi\b|\btheta\b/.test(s);
}

/** Flattens nodes back to readable text (used for screen-reader labels and tests). */
export function nodesToText(nodes) {
  return nodes.map((n) => {
    if (typeof n === 'string') return n;
    if (n.t === 'sup') return `^(${nodesToText(n.c)})`;
    if (n.t === 'sub') return `_(${nodesToText(n.c)})`;
    if (n.t === 'frac') return `(${nodesToText(n.n)})/(${nodesToText(n.d)})`;
    if (n.t === 'sqrt') return `${n.root === '3' ? '∛' : n.root ? `root${n.root}` : '√'}(${nodesToText(n.c)})`;
    return '';
  }).join('');
}
