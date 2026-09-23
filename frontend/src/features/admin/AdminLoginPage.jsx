import { useState } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Mail, Lock, KeyRound, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button, TextField, PasswordField, Alert } from '@/components/ui';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';
import { useAdminStore } from '@/store/authStore';
import { useDocumentTitle } from '@/hooks/useCommon';
import { env } from '@/config/env';

/** Role-gated admin sign-in with a mandatory second factor (F12-01, SEC-14). Never reachable from the student app nav. */
export default function AdminLoginPage() {
  useDocumentTitle('Admin sign in');
  const navigate = useNavigate();
  const location = useLocation();
  const { token, setSession } = useAdminStore();
  const [step, setStep] = useState('password');
  const [form, setForm] = useState({ email: '', password: '' });
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/admin" replace />;

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.login(form);
      setChallenge(res);
      setStep('otp');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.verify({ challengeId: challenge.challengeId, code });
      setSession(res);
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink-950 px-4 py-16">
      <Link
        to="/"
        className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
      </Link>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center"><Logo light to="/" /><p className="mt-2 text-sm text-white/50">Staff console · authorised access only</p></div>
        <div className="rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          {step === 'password' ? (
            <form onSubmit={login} className="space-y-4">
              <h1 className="text-2xl font-bold">Sign in</h1>
              {error && <Alert tone="danger">{error}</Alert>}
              <TextField label="Work email" type="email" icon={Mail} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="username" />
              <PasswordField label="Password" icon={Lock} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" />
              <Button type="submit" size="lg" block loading={busy}>Continue</Button>
              {env.useMockApi && (
                <div className="rounded-xl bg-ink-50 p-3 text-xs text-ink-600">
                  <p className="mb-1 font-bold">Demo accounts (2FA code 123456)</p>
                  {[['superadmin@gyangrid.in', 'Admin@1234', 'Super Admin'], ['content@gyangrid.in', 'Content@1234', 'Content Manager'], ['support@gyangrid.in', 'Support@1234', 'Support']].map(([e, p, r]) => (
                    <button key={e} type="button" onClick={() => setForm({ email: e, password: p })} className="block w-full rounded-lg px-2 py-1 text-left hover:bg-white">{r}: {e}</button>
                  ))}
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600"><ShieldCheck className="h-6 w-6" /></span>
              <h1 className="text-2xl font-bold">Two-step verification</h1>
              <p className="text-sm text-ink-500">Enter the 6-digit code from your authenticator app.</p>
              {error && <Alert tone="danger">{error}</Alert>}
              <TextField label="Verification code" icon={KeyRound} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} hint={env.useMockApi ? challenge?.hint : undefined} inputClassName="tracking-[0.4em] text-lg font-bold" autoFocus />
              <Button type="submit" size="lg" block loading={busy} disabled={code.length !== 6}>Verify & sign in</Button>
              <button type="button" onClick={() => { setStep('password'); setCode(''); }} className="w-full text-center text-sm font-semibold text-ink-500 hover:text-ink-800">← Use a different account</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
