import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { TextField } from './Form';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])';

/** Accessible dialog: focus trap, ESC to close, scroll lock, bottom-sheet on phones. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true, className }) {
  const panel = useRef(null);
  const lastFocus = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const first = panel.current?.querySelector('[data-autofocus]') || panel.current?.querySelector(FOCUSABLE);
      first?.focus();
    }, 30);
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) closeRef.current?.();
      if (e.key === 'Tab' && panel.current) {
        const els = [...panel.current.querySelectorAll(FOCUSABLE)];
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      lastFocus.current?.focus?.();
    };
  }, [open, dismissible]);

  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => dismissible && onClose?.()}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            className={cn('relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl', widths[size], className)}
            initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-ink-200 sm:hidden" aria-hidden />
            {(title || dismissible) && (
              <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-4 sm:px-6 sm:pt-5">
                <div>
                  {title && <h2 id="modal-title" className="text-lg font-bold sm:text-xl">{title}</h2>}
                  {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
                </div>
                {dismissible && (
                  <button type="button" onClick={onClose} className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Close">
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
            <div className="overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
            {footer && <div className="safe-bottom flex flex-col-reverse gap-2 border-t border-ink-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Confirm dialog. With `typeToConfirm`, the user must type the word to enable the action (irreversible actions). */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', tone = 'primary', loading, typeToConfirm, children }) {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (!open) setTyped(''); }, [open]);
  const blocked = typeToConfirm && typed.trim() !== typeToConfirm;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={tone} loading={loading} disabled={blocked} onClick={() => onConfirm(typed)}>{confirmLabel}</Button>
        </>
      )}
    >
      {children}
      {typeToConfirm && (
        <TextField label={`Type ${typeToConfirm} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="mt-3" data-autofocus />
      )}
    </Modal>
  );
}
