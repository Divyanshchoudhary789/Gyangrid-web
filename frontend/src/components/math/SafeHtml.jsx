import { memo, useMemo } from 'react';
import DOMPurify from 'dompurify';
import katex from 'katex';
import { cn } from '@/lib/cn';

/**
 * Renders admin-authored HTML study material safely.
 * - DOMPurify strips scripts, event handlers, iframes, forms and javascript: URLs.
 * - Links open in a new tab with rel="noopener noreferrer".
 * - $…$ / $$…$$ LaTeX inside text is rendered with KaTeX (trust: false).
 */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img', 'hr'];
const ALLOWED_ATTR = ['href', 'title', 'alt', 'src', 'colspan', 'rowspan', 'class'];

let hooked = false;
function ensureHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy');
      const src = node.getAttribute('src') || '';
      if (!/^https:\/\//i.test(src)) node.removeAttribute('src');
    }
  });
}

function renderMath(html) {
  return html.replace(/\$\$([\s\S]+?)\$\$|\$([^$<\n]+?)\$/g, (m, display, inline) => {
    try {
      return katex.renderToString((display ?? inline).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), { displayMode: display != null, throwOnError: false, trust: false, strict: 'ignore' });
    } catch {
      return m;
    }
  });
}

export const SafeHtml = memo(function SafeHtml({ html, className }) {
  const clean = useMemo(() => {
    ensureHooks();
    const sanitized = DOMPurify.sanitize(String(html || ''), { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false });
    // KaTeX output is generated from text we control after sanitisation, with trust disabled.
    return renderMath(sanitized);
  }, [html]);
  return (
    <div
      className={cn(
        'prose-gg space-y-3 text-[15.5px] leading-relaxed text-ink-700',
        '[&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:font-bold [&_h1]:text-ink-900 [&_h2]:text-ink-900 [&_h3]:text-ink-900',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_a]:font-semibold [&_a]:text-brand-600 [&_a]:underline',
        '[&_blockquote]:rounded-xl [&_blockquote]:border-l-4 [&_blockquote]:border-amber-300 [&_blockquote]:bg-amber-50 [&_blockquote]:p-3',
        '[&_table]:w-full [&_td]:border [&_td]:border-ink-100 [&_td]:p-2 [&_th]:border [&_th]:border-ink-100 [&_th]:bg-ink-50 [&_th]:p-2 [&_img]:max-w-full [&_img]:rounded-xl',
        '[&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-ink-900 [&_pre]:p-3 [&_pre]:text-white',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
});
