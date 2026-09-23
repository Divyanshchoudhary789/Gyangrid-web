import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Field({ label, htmlFor, error, hint, required, children, className, labelAction }) {
  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={htmlFor} className="label">
            {label} {required && <span className="text-rose-500" aria-hidden>*</span>}
          </label>
          {labelAction}
        </div>
      )}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-sm font-medium text-rose-600" role="alert">{error}</p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextField = forwardRef(function TextField({ label, error, hint, required, className, inputClassName, icon: I, id, labelAction, ...rest }, ref) {
  const autoId = useId();
  const fid = id || autoId;
  return (
    <Field label={label} htmlFor={fid} error={error} hint={hint} required={required} className={className} labelAction={labelAction}>
      <div className="relative">
        {I && <I className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" aria-hidden />}
        <input
          ref={ref}
          id={fid}
          className={cn('input', I && 'pl-10', error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15', inputClassName)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
          required={required}
          {...rest}
        />
      </div>
    </Field>
  );
});

export const PasswordField = forwardRef(function PasswordField(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextField ref={ref} type={show ? 'text' : 'password'} inputClassName="pr-11" {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className={cn('absolute right-2 flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700', props.label ? 'top-[30px]' : 'top-1')}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
});

export const SelectField = forwardRef(function SelectField({ label, error, hint, options, className, id, placeholder, required, ...rest }, ref) {
  const autoId = useId();
  const fid = id || autoId;
  return (
    <Field label={label} htmlFor={fid} error={error} hint={hint} required={required} className={className}>
      <select ref={ref} id={fid} className={cn('input appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2020%2020%27%20fill=%27%23667089%27%3E%3Cpath%20d=%27M5.23%207.21a.75.75%200%20011.06.02L10%2011.17l3.71-3.94a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%27/%3E%3C/svg%3E")] bg-[length:20px] bg-[right_10px_center] bg-no-repeat pr-10', error && 'border-rose-400')} aria-invalid={Boolean(error) || undefined} required={required} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
});

export const TextArea = forwardRef(function TextArea({ label, error, hint, className, id, maxLength, value, required, textareaClassName, ...rest }, ref) {
  const autoId = useId();
  const fid = id || autoId;
  return (
    <Field
      label={label} htmlFor={fid} error={error} required={required} className={className}
      hint={hint || (maxLength ? `${(value || '').length}/${maxLength}` : undefined)}
    >
      <textarea ref={ref} id={fid} value={value} maxLength={maxLength} className={cn('input min-h-[110px] resize-y leading-relaxed', error && 'border-rose-400', textareaClassName)} aria-invalid={Boolean(error) || undefined} required={required} {...rest} />
    </Field>
  );
});

export function Checkbox({ checked, onChange, label, description, id, className, required }) {
  const autoId = useId();
  const fid = id || autoId;
  return (
    <label htmlFor={fid} className={cn('group flex cursor-pointer items-start gap-3 rounded-xl', className)}>
      <span className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
        <input id={fid} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} required={required} />
        <span className="absolute inset-0 rounded-md border-2 border-ink-300 bg-white transition peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-500/25 group-hover:border-brand-400" />
        <Check className={cn('relative h-4 w-4 text-white transition', checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0')} strokeWidth={3} aria-hidden />
      </span>
      <span className="text-sm leading-relaxed text-ink-700">
        {label}
        {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
      </span>
    </label>
  );
}

export function Switch({ checked, onChange, label, description, disabled }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-ink-800">{label}</label>
        {description && <p className="text-xs text-ink-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-7 w-12 shrink-0 rounded-full transition focus-visible:ring-4 focus-visible:ring-brand-500/25 disabled:opacity-50', checked ? 'bg-brand-600' : 'bg-ink-300')}
      >
        <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
      </button>
    </div>
  );
}

/** Big tappable choice card used in onboarding and settings. */
export function ChoiceCard({ selected, onClick, disabled, children, className, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'relative rounded-2xl border-2 bg-white p-4 text-left transition-all focus-visible:ring-4 focus-visible:ring-brand-500/25',
        selected ? 'border-brand-500 bg-brand-50/60 shadow-lift' : 'border-ink-100 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card',
        disabled && 'cursor-not-allowed opacity-50 hover:translate-y-0 hover:border-ink-100 hover:shadow-none',
        className,
      )}
      {...rest}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white">
          <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
        </span>
      )}
      {children}
    </button>
  );
}
