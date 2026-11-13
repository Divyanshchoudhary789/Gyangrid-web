import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info, XCircle, LoaderCircle, RefreshCw, SearchX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ALL_AVATARS, DEFAULT_AVATAR_ID } from '@/config/constants';
import { Button } from './Button';

/* ------------------------------------------------------------------ Card */
export function Card({ as: Comp = 'div', className, hover, padded = true, children, ...rest }) {
  // An explicit base padding in className (e.g. "p-4") replaces the default instead of fighting it.
  const customPadding = /(^|\s)p-\d/.test(className || '');
  return (
    <Comp className={cn('card', padded && !customPadding && 'p-5 sm:p-6', hover && 'card-hover', className)} {...rest}>
      {children}
    </Comp>
  );
}

export function CardHeader({ title, subtitle, action, icon: I, className }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {I && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <I className="h-5 w-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="section-title truncate">{title}</h2>
          {subtitle && <p className="muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ Badge */
const TONES = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-sky-100 text-sky-800',
  gold: 'bg-gold-100 text-gold-700',
  dark: 'bg-ink-900 text-white',
};
export function Badge({ tone = 'neutral', icon: I, className, children }) {
  return (
    <span className={cn('chip', TONES[tone], className)}>
      {I && <I className="h-3.5 w-3.5" aria-hidden />}
      {children}
    </span>
  );
}

const DIFF = { EASY: ['success', 'Easy'], MEDIUM: ['warning', 'Medium'], HARD: ['danger', 'Hard'] };
export const DifficultyBadge = ({ level }) => (level ? <Badge tone={DIFF[level]?.[0]}>{DIFF[level]?.[1] || level}</Badge> : null);

/* ------------------------------------------------------------------ Loading */
export function Spinner({ className, label = 'Loading' }) {
  return <LoaderCircle className={cn('h-5 w-5 animate-spin text-brand-500', className)} aria-label={label} role="status" />;
}

export function Skeleton({ className }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-ink-100', className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function PageSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ States */
export function EmptyState({ icon: I = SearchX, title, description, action, className, emoji }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-12 text-center', className)}>
      {emoji ? <div className="mb-3 text-5xl" aria-hidden>{emoji}</div> : (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
          <I className="h-7 w-7" aria-hidden />
        </span>
      )}
      <h3 className="text-lg font-bold">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "We couldn't load this", className }) {
  const offline = error?.code === 'NETWORK_ERROR';
  return (
    <EmptyState
      className={className}
      emoji={offline ? '📡' : '🧩'}
      title={offline ? "You're offline" : title}
      description={error?.message || 'Something went wrong. Please try again.'}
      action={onRetry && <Button variant="outline" leftIcon={RefreshCw} onClick={onRetry}>Try again</Button>}
    />
  );
}

const ALERT = {
  info: ['bg-sky-50 border-sky-200 text-sky-900', Info, 'text-sky-500'],
  success: ['bg-emerald-50 border-emerald-200 text-emerald-900', CheckCircle2, 'text-emerald-500'],
  warning: ['bg-amber-50 border-amber-200 text-amber-900', AlertTriangle, 'text-amber-500'],
  danger: ['bg-rose-50 border-rose-200 text-rose-900', XCircle, 'text-rose-500'],
};
export function Alert({ tone = 'info', title, children, className, action }) {
  const [cls, I, icls] = ALERT[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', cls, className)}>
      <I className={cn('mt-0.5 h-5 w-5 shrink-0', icls)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ Progress */
export function ProgressBar({ value = 0, max = 100, tone = 'brand', className, size = 'md', label }) {
  const pctVal = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const colors = { brand: 'from-brand-500 to-violet-500', success: 'from-emerald-400 to-emerald-600', warning: 'from-amber-300 to-amber-500', danger: 'from-rose-400 to-rose-600', gold: 'from-gold-300 to-gold-500', white: 'from-white to-white' };
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-ink-100', size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2', className)}
      role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}
    >
      <div className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out', colors[tone])} style={{ width: `${pctVal}%` }} />
    </div>
  );
}

export function ProgressRing({ value = 0, size = 64, stroke = 7, tone = '#6d5dfc', track = '#eef0f6', children, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label || `${Math.round(v)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} style={{ transition: 'stroke-dashoffset .8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export const masteryColor = (m) => (m == null ? '#c1c7d8' : m >= 75 ? '#10b981' : m >= 50 ? '#f59e0b' : '#f43f5e');

/* ------------------------------------------------------------------ Avatar */
export function Avatar({ id, size = 'md', className, ring }) {
  const a = ALL_AVATARS.find((x) => x.id === id) || ALL_AVATARS.find((x) => x.id === DEFAULT_AVATAR_ID);
  const dims = { xs: 'h-7 w-7 text-base', sm: 'h-9 w-9 text-lg', md: 'h-11 w-11 text-2xl', lg: 'h-16 w-16 text-4xl', xl: 'h-24 w-24 text-6xl' }[size];
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br', a.bg, dims, ring && 'ring-4 ring-white', className)} aria-hidden>
      <span className="leading-none">{a.emoji}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ Tabs / segmented control */
export function Tabs({ tabs, value, onChange, className, size = 'md', ariaLabel = 'Tabs' }) {
  const listRef = useRef(null);
  // On narrow screens the strip scrolls sideways; keep the selected tab in view (e.g. when a URL opens a later tab).
  useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector('[aria-selected="true"]');
    if (!list || !tab) return;
    const left = tab.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft || left + tab.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 8), behavior: 'smooth' });
    }
  }, [value]);
  return (
    <div ref={listRef} role="tablist" aria-label={ariaLabel} className={cn('no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1', className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition',
              size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
              active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {t.icon && <t.icon className="h-4 w-4" aria-hidden />}
            {t.label}
            {t.count != null && (
              <span className={cn('rounded-full px-1.5 text-[11px]', active ? 'bg-brand-100 text-brand-700' : 'bg-ink-200 text-ink-600')}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Page header */
export function PageHeader({ title, subtitle, action, back, eyebrow, className }) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-brand-600">
            ← {back.label}
          </Link>
        )}
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

/* ------------------------------------------------------------------ Stat */
export function Stat({ label, value, hint, icon: I, tone = 'brand', className }) {
  const toneCls = { brand: 'bg-brand-50 text-brand-600', gold: 'bg-gold-100 text-gold-600', flame: 'bg-flame-100 text-flame-600', success: 'bg-emerald-50 text-emerald-600', danger: 'bg-rose-50 text-rose-600', info: 'bg-sky-50 text-sky-600' }[tone];
  return (
    <div className={cn('card flex items-center gap-3.5 p-4', className)}>
      {I && (
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', toneCls)}>
          <I className="h-5 w-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="line-clamp-2 text-xs font-semibold uppercase leading-tight tracking-wide text-ink-500">{label}</p>
        <p className="mt-0.5 break-words font-display text-xl font-bold leading-tight text-ink-900">{value}</p>
        {hint && <p className="line-clamp-2 text-xs text-ink-500">{hint}</p>}
      </div>
    </div>
  );
}
