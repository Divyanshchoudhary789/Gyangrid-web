import { Sparkles } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useCommon';

/**
 * Honest placeholder for features whose backend API isn't available yet
 * (tracked in docs/PENDING_BACKEND_APIS.md). Never shows sample or mock data.
 */
export function ComingSoon({ title, subtitle, emoji = '🚀', points = [], primary = { to: '/home', label: 'Back to Home' }, secondary }) {
  useDocumentTitle(title);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-brand-50 via-white to-emerald-50 px-6 py-10 text-center sm:px-10">
          <div className="text-6xl" aria-hidden>{emoji}</div>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700"><Sparkles className="h-3.5 w-3.5" />Coming soon</p>
          <h2 className="mt-3 text-2xl font-bold">We&apos;re putting the finishing touches on this</h2>
          <p className="mx-auto mt-2 max-w-lg text-ink-500">It will appear here automatically as soon as it&apos;s ready — no update needed.</p>
          {points.length > 0 && (
            <ul className="mx-auto mt-6 grid max-w-xl gap-2 text-left sm:grid-cols-2">
              {points.map((p) => <li key={p} className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-ink-700 shadow-sm">✓ {p}</li>)}
            </ul>
          )}
          <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
            {primary && <Button to={primary.to}>{primary.label}</Button>}
            {secondary && <Button variant="outline" to={secondary.to}>{secondary.label}</Button>}
          </div>
        </div>
      </Card>
    </div>
  );
}
