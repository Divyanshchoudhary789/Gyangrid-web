import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

const VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200 disabled:text-brand-300',
  outline: 'border border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50 disabled:text-ink-400',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:text-ink-300',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  success: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-700 disabled:bg-emerald-300',
  gold: 'bg-gradient-to-r from-gold-400 to-gold-500 text-ink-900 shadow-sm shadow-gold-500/40 hover:from-gold-300 hover:to-gold-400',
  white: 'bg-white text-brand-700 shadow-sm hover:bg-brand-50',
};

const SIZES = {
  xs: 'h-8 px-2.5 text-xs gap-1 rounded-lg',
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
  xl: 'h-14 px-7 text-lg gap-2.5 rounded-2xl',
};

export const Button = forwardRef(function Button(
  { as, to, href, variant = 'primary', size = 'md', loading = false, disabled, leftIcon: L, rightIcon: R, block, className, children, type = 'button', ...rest },
  ref,
) {
  const classes = cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 active:scale-[.98] disabled:cursor-not-allowed disabled:active:scale-100',
    VARIANTS[variant], SIZES[size], block && 'w-full', className,
  );
  const content = (
    <>
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : L && <L className="h-[1.1em] w-[1.1em] shrink-0" aria-hidden />}
      {children}
      {R && !loading && <R className="h-[1.1em] w-[1.1em] shrink-0" aria-hidden />}
    </>
  );
  if (to) return <Link ref={ref} to={to} className={cn(classes, disabled && 'pointer-events-none opacity-60')} {...rest}>{content}</Link>;
  if (href) return <a ref={ref} href={href} className={classes} {...rest}>{content}</a>;
  const Comp = as || 'button';
  return (
    <Comp ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </Comp>
  );
});

export function IconButton({ icon: I, label, className, variant = 'ghost', size = 'md', ...rest }) {
  const dims = { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-12 w-12' }[size];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 disabled:opacity-40', VARIANTS[variant], dims, className)}
      {...rest}
    >
      <I className="h-5 w-5" aria-hidden />
    </button>
  );
}
