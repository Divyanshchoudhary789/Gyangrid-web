import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { Button, Modal, TextField } from '@/components/ui';
import { authApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { isEmail, isValidName } from '@/lib/validators';
import { track } from '@/lib/analytics';
import { env } from '@/config/env';
import { signInWithGoogleProvider } from '@/services/auth/googleProvider';
import { startSession, homePathFor } from './session';

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

/**
 * "Continue with Google". In production this is Firebase `signInWithPopup(GoogleAuthProvider)` and the ID
 * token goes to the backend. The mock shows an account chooser so both a returning and a brand-new
 * Google identity can be demonstrated (F1-01, F1-09 account merge by email).
 */
export function GoogleSignIn({ label = 'Continue with Google' }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [busy, setBusy] = useState(null);

  const signIn = async (account) => {
    setBusy(account.email);
    try {
      const res = await authApi.google(account);
      startSession(res);
      track(res.user.onboarded ? 'login' : 'signup_started', { method: 'google' });
      setOpen(false);
      navigate(homePathFor(res.user), { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const customValid = isValidName(form.name) && isEmail(form.email);

  const start = async () => {
    if (env.useMockApi) { setOpen(true); return; }
    try {
      const res = await signInWithGoogleProvider();
      startSession(res);
      navigate(homePathFor(res.user), { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <Button variant="outline" size="lg" block leftIcon={GoogleG} onClick={start}>{label}</Button>
      <Modal open={open} onClose={() => { setOpen(false); setCustom(false); }} title="Choose an account" description="to continue to Gyaangrid" size="sm">
        {!custom ? (
          <div className="space-y-2">
            <button type="button" disabled={Boolean(busy)} onClick={() => signIn({ email: 'demo@gyaangrid.in', name: 'Aarav Kumar' })} className="flex w-full items-center gap-3 rounded-2xl border border-ink-100 p-3 text-left transition hover:bg-ink-50">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-xl">🦊</span>
              <span className="min-w-0 flex-1"><span className="block font-semibold text-ink-900">Aarav Kumar</span><span className="block truncate text-sm text-ink-500">demo@gyaangrid.in · demo student</span></span>
              {busy === 'demo@gyaangrid.in' && <span className="text-xs text-ink-400">Signing in…</span>}
            </button>
            <button type="button" onClick={() => setCustom(true)} className="flex w-full items-center gap-3 rounded-2xl border border-ink-100 p-3 text-left transition hover:bg-ink-50">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 text-ink-600"><UserPlus className="h-5 w-5" /></span>
              <span className="font-semibold text-ink-900">Use another account</span>
            </button>
            <p className="pt-2 text-xs text-ink-400">Demo mode: Google sign-in is simulated. Real sign-in uses Firebase Authentication.</p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (customValid) signIn({ name: form.name.trim(), email: form.email.trim() }); }}>
            <TextField label="First and last name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" data-autofocus />
            <TextField label="Google email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCustom(false)}>Back</Button>
              <Button type="submit" block disabled={!customValid} loading={Boolean(busy)}>Continue</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
