import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MathText } from './MathText';

const html = (text) => renderToStaticMarkup(<MathText text={text} />);

describe('MathText plain maths rendering', () => {
  it('renders powers as superscripts', () => {
    expect(html('3x^3 - 5x^2')).toContain('<sup class="math-sup">3</sup>');
  });

  it('keeps a sign and trailing punctuation on the same line as a fraction', () => {
    const out = html('and αβγ = -d/a.');
    expect(out).toMatch(/<span class="whitespace-nowrap">−<span class="math-frac"[^>]*>.*<\/span>\.<\/span>/);
  });

  it('handles fractions back to back without looping', () => {
    const out = html('-1/9 - 5/9 + 11/3 = 3(-1/27) + (1/3)(2/3)');
    expect(out.match(/math-frac"/g)).toHaveLength(6);
  });

  it('escapes text and keeps KaTeX for $…$', () => {
    expect(html('<b>x</b>^2')).not.toContain('<b>');
    expect(html('$x^2$')).toContain('katex');
  });
});
