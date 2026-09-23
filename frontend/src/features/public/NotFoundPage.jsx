import { Button } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useCommon';
import { useAuthStore } from '@/store/authStore';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  const token = useAuthStore((s) => s.token);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6 text-center">
      <p className="font-display text-8xl font-extrabold text-gradient">404</p>
      <h1 className="mt-4 text-2xl font-bold">This page divided by zero</h1>
      <p className="mt-2 max-w-sm text-ink-500">We couldn&apos;t find what you were looking for. Let&apos;s get you back on track.</p>
      <Button to={token ? '/home' : '/'} className="mt-8" size="lg">{token ? 'Back to Home' : 'Go to homepage'}</Button>
    </div>
  );
}
