import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#how', label: 'How it works' },
  { href: '/#parents', label: 'For parents' },
  { href: '/#faq', label: 'FAQ' },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { token, user } = useAuthStore();
  const signedIn = Boolean(token && user);
  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/75 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100 hover:text-ink-900">{l.label}</a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Button to={user.onboarded ? '/home' : '/onboarding'}>Open my dashboard</Button>
          ) : (
            <>
              <Button to="/login" variant="ghost">Sign in</Button>
              <Button to="/signup">Start learning free</Button>
            </>
          )}
        </div>
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-ink-100 md:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      <div className={cn('overflow-hidden border-t border-ink-100 bg-white transition-all md:hidden', open ? 'max-h-96' : 'max-h-0 border-t-0')}>
        <div className="space-y-1 px-4 py-3">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 font-semibold text-ink-700 hover:bg-ink-50">{l.label}</a>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {signedIn ? <Button to="/home" block className="col-span-2">Open my dashboard</Button> : (
              <>
                <Button to="/login" variant="outline" block>Sign in</Button>
                <Button to="/signup" block>Start free</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-ink-500">An AI-powered Mathematics tutor for Classes 6–10 (NCERT / CBSE). Learn, practise, test, clear doubts and improve — every day.</p>
          <p className="mt-4 text-xs text-ink-400">No ads. No tracking. Your data is never sold.</p>
        </div>
        <div>
          <p className="text-sm font-bold text-ink-900">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-500">
            <li><a href="/#features" className="hover:text-brand-600">Features</a></li>
            <li><a href="/#parents" className="hover:text-brand-600">For parents</a></li>
            <li><Link to="/signup" className="hover:text-brand-600">Create account</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold text-ink-900">Trust</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-500">
            <li><NavLink to="/privacy" className="hover:text-brand-600">Privacy policy</NavLink></li>
            <li><NavLink to="/terms" className="hover:text-brand-600">Terms of use</NavLink></li>
            <li><NavLink to="/admin/login" className="hover:text-brand-600">Staff console</NavLink></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100 py-5 text-center text-xs text-ink-400">© {new Date().getFullYear()} Gyaangrid. Built with care for young learners in India.</div>
    </footer>
  );
}
