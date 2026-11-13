import { describe, expect, it } from 'vitest';
import { CATEGORIES, applySmartReplace, searchKeys, toScript } from './mathInput';

describe('smart symbols', () => {
  it.each([
    ['x <=', 4, 'x ≤'],
    ['a != b', 4, 'a ≠ b'],
    ['p <=>', 5, 'p ⇔'],
    ['x^2', 3, 'x²'],
    ['sqrt(', 5, '√('],
    ['area = pi ', 10, 'area = π '],
  ])('%s → %s', (value, caret, expected) => {
    expect(applySmartReplace(value, caret).value).toBe(expected);
  });

  it('puts the cursor right after the symbol', () => {
    expect(applySmartReplace('a<=b', 3)).toEqual({ value: 'a≤b', caret: 2 });
  });

  it('leaves words that only end in a shortcut alone', () => {
    expect(applySmartReplace('topi ', 5)).toBeNull();
  });

  it('does nothing when no shortcut is before the cursor', () => {
    expect(applySmartReplace('2x + 3 = 11', 11)).toBeNull();
  });
});

describe('super / subscript typing', () => {
  it('converts digits, signs and letters that have a form', () => {
    expect(toScript('2n-1', 'sup')).toBe('²ⁿ⁻¹');
    expect(toScript('10', 'sub')).toBe('₁₀');
  });

  it('passes through characters without a form', () => {
    expect(toScript('q', 'sup')).toBe('q');
    expect(toScript('ab', null)).toBe('ab');
  });
});

describe('symbol catalogue', () => {
  it('finds symbols by name and keyword', () => {
    expect(searchKeys('theta').map((k) => k.insert)).toContain('θ');
    expect(searchKeys('root').map((k) => k.insert)).toEqual(expect.arrayContaining(['√()', '∛()']));
  });

  it('has unique ids inside each group, and templates place the cursor inside their text', () => {
    CATEGORIES.forEach((c) => {
      const ids = c.keys.map((k) => k.id);
      expect(new Set(ids).size).toBe(ids.length);
      c.keys.filter((k) => k.caret != null).forEach((k) => {
        expect(k.caret).toBeGreaterThanOrEqual(0);
        expect(k.caret).toBeLessThanOrEqual(k.insert.length);
      });
    });
  });
});
