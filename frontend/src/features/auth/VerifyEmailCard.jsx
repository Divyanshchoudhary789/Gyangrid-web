import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MailCheck, RefreshCw } from 'lucide-react';
import { Alert, Button, TextField } from '@/components/ui';
import { authApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';

const RESEND_AFTER_SEC = 60;

/** Email ownership check: a 6-digit code by email. The Firebase link sent at sign-up still works too. */
export function VerifyEmailCard({ className }) {
  const { user, setUser } = useAuthStore();
  const [step, setStep] = useState('intro');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const startCooldown = () => {
    setCooldown(RESEND_AFTER_SEC);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((n) => {
        if (n <= 1) clearInterval(timer.current);
        return Math.max(0, n - 1);
      });
    }, 1000);
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await authApi.requestEmailOtp();
      setStep('code');
      setCode('');
      startCooldown();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setUser(await authApi.verifyEmailOtp(code));
      toast.success('Email verified. Thank you!');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const usedLink = async () => {
    setBusy(true);
    setError(null);
    try {
      setUser(await authApi.verifyEmail());
      toast.success('Email verified. Thank you!');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  if (step === 'intro') {
    return (
      <Alert tone="info" className={className} title="Verify your email"
        action={<div className="flex flex-wrap gap-2"><Button size="sm" loading={busy} onClick={send}>Send code</Button><Button size="sm" variant="ghost" disabled={busy} onClick={usedLink}>I used the link</Button></div>}
      >
        Confirm {user?.email} so you can always get back into your account.
        {error && <span className="mt-1 block font-semibold text-rose-700">{error}</span>}
      </Alert>
    );
  }

  return (
    <form onSubmit={verify} className={cn('card flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5', className)}>
      <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600 sm:flex"><MailCheck className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <TextField label={`Enter the 6-digit code sent to ${user?.email}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} inputClassName="tracking-[0.3em] font-bold" autoFocus error={error || undefined} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={code.length !== 6}>Verify</Button>
        <Button type="button" variant="ghost" leftIcon={RefreshCw} disabled={cooldown > 0 || busy} onClick={send}>{cooldown > 0 ? `${cooldown}s` : 'Resend'}</Button>
      </div>
    </form>
  );
}
