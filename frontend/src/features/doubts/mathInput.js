/**
 * Pure helpers for the maths editor: symbol catalogue, super/subscript conversion and the
 * "smart symbols" auto-replacements. Kept free of React so they are easy to unit test.
 *
 * A key is { id, label, insert, caret?, name, keywords?, wide? }:
 *  - insert: the text placed at the cursor
 *  - caret:  where the cursor lands inside `insert` (default: after it), so templates like "√()"
 *            leave the cursor between the brackets
 */

const k = (insert, name, extra = {}) => ({ id: `${name}:${insert}`, label: insert, insert, name, ...extra });
const t = (label, insert, caret, name, extra = {}) => ({ id: `${name}:${insert}`, label, insert, caret, name, template: true, ...extra });
const w = (insert, name, extra = {}) => k(insert, name, { wide: true, ...extra });

export const CATEGORIES = [
  {
    id: 'basic',
    label: 'Basic',
    keys: [
      k('+', 'plus'), k('−', 'minus'), k('×', 'multiply', { keywords: 'times into' }), k('÷', 'divide', { keywords: 'by' }),
      k('=', 'equals'), k('≠', 'not equal'), k('±', 'plus or minus'), k('·', 'dot multiply'),
      t('( )', '()', 1, 'brackets', { keywords: 'parentheses' }), t('[ ]', '[]', 1, 'square brackets'), t('{ }', '{}', 1, 'curly brackets'),
      k('<', 'less than'), k('>', 'greater than'), k('≤', 'less than or equal'), k('≥', 'greater than or equal'),
      k('≈', 'approximately equal', { keywords: 'about nearly' }), k('%', 'percent'), k('∞', 'infinity'), k('…', 'and so on', { keywords: 'ellipsis dots' }),
      k('.', 'decimal point'), k(',', 'comma'),
    ],
  },
  {
    id: 'algebra',
    label: 'Algebra',
    keys: [
      k('x', 'x'), k('y', 'y'), k('z', 'z'), k('a', 'a'), k('b', 'b'), k('c', 'c'), k('n', 'n'), k('k', 'k'),
      t('x²', 'x²', 2, 'x squared'), t('x³', 'x³', 2, 'x cubed'), t('xⁿ', 'xⁿ', 2, 'x to the power n'), t('x⁻¹', 'x⁻¹', 3, 'inverse', { keywords: 'reciprocal' }),
      t('√( )', '√()', 2, 'square root', { keywords: 'root sqrt' }), t('∛( )', '∛()', 2, 'cube root', { keywords: 'root' }),
      t('|x|', '||', 1, 'absolute value', { keywords: 'modulus mod' }), t('a/b', '()/()', 1, 'fraction', { keywords: 'divide over' }),
      k('∝', 'proportional to', { keywords: 'varies' }), k('≡', 'identically equal'), k('!', 'factorial'),
      w('f(x)', 'function of x'), w('(a+b)²', 'a plus b whole square', { keywords: 'identity' }), w('(a−b)²', 'a minus b whole square', { keywords: 'identity' }), w('a²−b²', 'difference of squares', { keywords: 'identity' }),
    ],
  },
  {
    id: 'powers',
    label: 'Fractions & powers',
    keys: [
      k('½', 'one half'), k('⅓', 'one third'), k('⅔', 'two thirds'), k('¼', 'one quarter'), k('¾', 'three quarters'), k('⅕', 'one fifth'), k('⅛', 'one eighth'),
      t('a/b', '()/()', 1, 'fraction'), t('a b/c', ' ()/()', 2, 'mixed fraction'),
      k('⁰', 'superscript 0'), k('¹', 'superscript 1'), k('²', 'squared', { keywords: 'superscript 2 power' }), k('³', 'cubed', { keywords: 'superscript 3 power' }),
      k('⁴', 'superscript 4'), k('⁵', 'superscript 5'), k('⁶', 'superscript 6'), k('⁷', 'superscript 7'), k('⁸', 'superscript 8'), k('⁹', 'superscript 9'),
      k('ⁿ', 'superscript n'), k('⁻', 'superscript minus', { keywords: 'negative power' }), k('⁺', 'superscript plus'),
      k('₀', 'subscript 0'), k('₁', 'subscript 1'), k('₂', 'subscript 2'), k('₃', 'subscript 3'), k('ₙ', 'subscript n'),
      t('√( )', '√()', 2, 'square root'), t('∛( )', '∛()', 2, 'cube root'), t('∜( )', '∜()', 2, 'fourth root'),
      w('× 10ⁿ', 'times ten to the power', { keywords: 'scientific notation standard form' }),
    ],
  },
  {
    id: 'geometry',
    label: 'Geometry',
    keys: [
      k('∠', 'angle'), k('△', 'triangle'), k('°', 'degree'), k('′', 'minute', { keywords: 'prime' }), k('″', 'second', { keywords: 'double prime' }),
      k('⊥', 'perpendicular'), k('∥', 'parallel'), k('≅', 'congruent'), k('∼', 'similar'), k('π', 'pi'),
      k('○', 'circle'), k('□', 'square'), k('▭', 'rectangle'), k('⌒', 'arc'), k('↔', 'line', { keywords: 'arrow both' }), k('→', 'ray', { keywords: 'arrow' }),
      w('AB', 'line segment AB'), w('∠ABC', 'angle ABC'), w('△ABC', 'triangle ABC'), w('πr²', 'area of circle'), w('2πr', 'circumference'), w('½ × b × h', 'area of triangle'),
    ],
  },
  {
    id: 'trig',
    label: 'Trigonometry',
    keys: [
      t('sin', 'sin ', 4, 'sine', { wide: true }), t('cos', 'cos ', 4, 'cosine', { wide: true }), t('tan', 'tan ', 4, 'tangent', { wide: true }),
      t('cosec', 'cosec ', 6, 'cosecant', { wide: true }), t('sec', 'sec ', 4, 'secant', { wide: true }), t('cot', 'cot ', 4, 'cotangent', { wide: true }),
      k('θ', 'theta'), k('α', 'alpha'), k('β', 'beta'), k('φ', 'phi'), k('°', 'degree'),
      w('sin²θ', 'sine squared theta'), w('cos²θ', 'cosine squared theta'), w('tan²θ', 'tangent squared theta'),
      w('sin²θ + cos²θ = 1', 'identity', { keywords: 'pythagorean' }), t('sin⁻¹', 'sin⁻¹ ', 6, 'inverse sine', { wide: true }), w('90° − θ', 'complementary angle'),
    ],
  },
  {
    id: 'sets',
    label: 'Sets & logic',
    keys: [
      k('∈', 'belongs to', { keywords: 'element of in' }), k('∉', 'does not belong to'), k('⊂', 'subset'), k('⊆', 'subset or equal'), k('⊃', 'superset'),
      k('∪', 'union'), k('∩', 'intersection'), k('∅', 'empty set', { keywords: 'null' }), t('{ }', '{}', 1, 'set brackets'),
      k('ℕ', 'natural numbers'), k('𝕎', 'whole numbers'), k('ℤ', 'integers'), k('ℚ', 'rational numbers'), k('ℝ', 'real numbers'),
      k('∴', 'therefore'), k('∵', 'because', { keywords: 'since' }), k('⇒', 'implies'), k('⇔', 'if and only if'), k('∀', 'for all'), k('∃', 'there exists'),
    ],
  },
  {
    id: 'stats',
    label: 'Statistics',
    keys: [
      k('Σ', 'sum', { keywords: 'sigma summation' }), k('x̄', 'mean', { keywords: 'x bar average' }), k('σ', 'standard deviation', { keywords: 'sigma' }), k('μ', 'mu mean'),
      w('Σfx', 'sum of f x'), w('Σf', 'sum of f'), t('P( )', 'P()', 2, 'probability'), t('n!', 'n!', 2, 'factorial'),
      w('ⁿCᵣ', 'combinations'), w('ⁿPᵣ', 'permutations'), k('%', 'percent'), k('∞', 'infinity'),
    ],
  },
  {
    id: 'greek',
    label: 'Greek',
    keys: [
      ['α', 'alpha'], ['β', 'beta'], ['γ', 'gamma'], ['δ', 'delta'], ['ε', 'epsilon'], ['θ', 'theta'], ['λ', 'lambda'], ['μ', 'mu'],
      ['π', 'pi'], ['ρ', 'rho'], ['σ', 'sigma'], ['τ', 'tau'], ['φ', 'phi'], ['ω', 'omega'], ['Δ', 'capital delta', 'change'], ['Σ', 'capital sigma', 'sum'], ['Π', 'capital pi'], ['Ω', 'capital omega'],
    ].map(([ch, name, kw]) => k(ch, name, kw ? { keywords: kw } : {})),
  },
];

const ALL_KEYS = (() => {
  const seen = new Map();
  CATEGORIES.forEach((c) => c.keys.forEach((key) => { if (!seen.has(key.insert)) seen.set(key.insert, key); }));
  return [...seen.values()];
})();

/** Symbols whose name, keywords or character match the query (case-insensitive). */
export function searchKeys(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return ALL_KEYS.filter((key) => key.name.toLowerCase().includes(q) || (key.keywords || '').toLowerCase().includes(q) || key.label.includes(query.trim()));
}

export const keyByInsert = (insert) => ALL_KEYS.find((key) => key.insert === insert) || null;

const SUPER = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ' };
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ' };

/** Converts each character that has a superscript / subscript form; others pass through unchanged. */
export function toScript(text, mode) {
  const map = mode === 'sup' ? SUPER : mode === 'sub' ? SUB : null;
  if (!map) return text;
  return [...String(text)].map((ch) => map[ch] ?? map[ch.toLowerCase()] ?? ch).join('');
}

/** Typed shortcuts that become symbols, checked against the text just before the cursor. */
export const SMART_RULES = [
  ['<=', '≤'], ['>=', '≥'], ['!=', '≠'], ['=/=', '≠'], ['+-', '±'], ['->', '→'], ['<-', '←'], ['=>', '⇒'], ['<=>', '⇔'],
  ['^2', '²'], ['^3', '³'], ['sqrt(', '√('], ['cbrt(', '∛('], ['~=', '≈'], ['...', '…'], ['pi ', 'π '], ['theta ', 'θ '], ['deg ', '° '],
];

/**
 * If the text before `caret` ends with a shortcut, returns the replaced text and the new caret.
 * Longer shortcuts are tried first so "<=>" wins over "<=". Returns null when nothing applies.
 * Word shortcuts (pi, theta, deg) only fire as whole words.
 */
export function applySmartReplace(value, caret) {
  const before = value.slice(0, caret);
  const rules = [...SMART_RULES].sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of rules) {
    if (!before.endsWith(from)) continue;
    const start = caret - from.length;
    if (/^[a-z]/i.test(from) && start > 0 && /[a-z0-9]/i.test(value[start - 1])) continue;
    const next = value.slice(0, start) + to + value.slice(caret);
    return { value: next, caret: start + to.length };
  }
  return null;
}
