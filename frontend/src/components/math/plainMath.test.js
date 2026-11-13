import { describe, expect, it } from 'vitest';
import { looksMathy, nodesToText, parsePlainMath, prettifySymbols } from './plainMath';

const nbsp = (s) => s.replace(/\u00A0/g, ' ');
const show = (s) => nbsp(nodesToText(parsePlainMath(s)));

describe('powers and indices', () => {
  it.each([
    ['p(x) = 3x^3 - 5x^2 - 11x - 3', 'p(x) = 3x^(3) − 5x^(2) − 11x − 3'],
    ['3(-1/3)^3', '3(−(1)/(3))^(3)'],
    ['2^(n+1)', '2^(n+1)'],
    ['x^{10}', 'x^(10)'],
    ['10^-3', '10^(−3)'],
    ['a_1 + a_n', 'a_(1) + a_(n)'],
    ['x^ny', 'x^(n)y'],
  ])('%s', (src, expected) => expect(show(src)).toBe(expected));

  it('leaves snake_case words and a lone caret alone', () => {
    expect(show('use step_by_step')).toBe('use step_by_step');
    expect(show('x ^ ')).toBe('x ^ ');
  });
});

describe('fractions', () => {
  it.each([
    ['= -1/9 - 5/9 + 11/3', '= −(1)/(9) − (5)/(9) + (11)/(3)'],
    ['-b/a = -(-5)/3', '−(b)/(a) = −(−5)/(3)'],
    ['(x+1)/(x-1)', '(x+1)/(x−1)'],
    ['2x/5', '(2x)/(5)'],
  ])('%s', (src, expected) => expect(show(src)).toBe(expected));

  it('does not treat dates, units or words as fractions', () => {
    expect(show('on 13/11/2026')).toBe('on 13/11/2026');
    expect(show('speed in km/h')).toBe('speed in km/h');
    expect(show('and/or')).toBe('and/or');
  });
});

describe('roots and symbols', () => {
  it('formats square and cube roots', () => {
    expect(show('sqrt(2) and cbrt(27)')).toBe('√(2) and ∛(27)');
    expect(show('√(x+1)')).toBe('√(x+1)');
  });

  it('turns ASCII operators into maths symbols but keeps word hyphens', () => {
    expect(nbsp(prettifySymbols('x <= 5, a != b, 3 * 4, x - 3'))).toBe('x ≤ 5, a ≠ b, 3 × 4, x − 3');
    expect(prettifySymbols('a step-by-step check')).toBe('a step-by-step check');
    expect(nbsp(prettifySymbols('area = pi r'))).toBe('area = π r');
    expect(prettifySymbols('topic')).toBe('topic');
  });
});

describe('stray LaTeX without $ delimiters', () => {
  it('handles \\frac, \\sqrt and symbol commands', () => {
    expect(show('\\frac{1}{3} \\times 3')).toBe('(1)/(3) × 3');
    expect(show('\\sqrt{16} = 4')).toBe('√(16) = 4');
    expect(show('\\sqrt[3]{8}')).toBe('∛(8)');
    expect(show('x \\le 2')).toBe('x ≤ 2');
  });
});

describe('looksMathy', () => {
  it('skips plain prose', () => {
    expect(looksMathy('Great work, keep going!')).toBe(false);
    expect(looksMathy('x^2')).toBe(true);
  });
});
