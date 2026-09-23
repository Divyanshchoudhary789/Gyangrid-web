import { useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export function LogoMark({ className }) {
  // Unique per instance: a shared id breaks when the first copy sits in a display:none subtree
  const gradientId = `gg-logo-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9', className)} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d5dfc" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <path d="M20 20h24M20 32h24M20 44h24M20 20v24M32 20v24M44 20v24" stroke="#fff" strokeOpacity=".3" strokeWidth="2" />
      <circle cx="44" cy="20" r="6" fill="#fbbf24" />
      <path d="M21 42l8-10 6 6 8-12" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ to = '/', className, light, compact }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5 rounded-xl', className)} aria-label="Gyaangrid home">
      <LogoMark />
      {!compact && (
        <span className={cn('font-display text-xl font-bold tracking-tight', light ? 'text-white' : 'text-ink-900')}>
          Gyaan<span className={light ? 'text-gold-300' : 'text-brand-600'}>grid</span>
        </span>
      )}
    </Link>
  );
}
