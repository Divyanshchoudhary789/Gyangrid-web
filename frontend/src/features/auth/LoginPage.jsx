import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, Sparkles } from 'lucide-react';
import { Button, TextField, PasswordField, Alert } from '@/components/ui';
import { authApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { isEmail } from '@/lib/validators';
import { useDocumentTitle } from '@/hooks/useCommon';
import { track } from '@/lib/analytics';
import { AuthLayout, Divider } from './AuthLayout';
import { GoogleSignIn } from './GoogleSignIn';
import { startSession, homePathFor } from './session';

export default function LoginPage() {
  useDocumentTitle('Sign in');
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const e = {};
    if (!isEmail(form.email)) e.email = 'Enter the email you signed up with.';
    if (!form.password) e.password = 'Enter your password.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await authApi.login({ email: form.email.trim(), password: form.password });
      startSession(res);
      track('login', { method: 'password' });
      const from = location.state?.from;
      navigate(res.user.onboarded && from ? from : homePathFor(res.user), { replace: true });
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back 👋"
      subtitle="Sign in to continue your streak."
      footer={<>New to Gyaangrid? <Link to="/signup" className="font-semibold text-brand-600 hover:underline">Create an account</Link></>}
    >
      {import.meta.env.VITE_USE_MOCK_API === 'true' && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold text-brand-900">Try the demo student</p>
            <p className="mt-0.5 text-brand-800/80">demo@gyaangrid.in · Demo@1234</p>
          </div>
          <Button size="sm" variant="white" onClick={() => setForm({ email: 'demo@gyaangrid.in', password: 'Demo@1234' })}>Fill in</Button>
        </div>
      )}
      <GoogleSignIn />
      <Divider label="or sign in with email" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <TextField label="Email" type="email" icon={Mail} autoComplete="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <PasswordField
          label="Password" icon={Lock} autoComplete="current-password" value={form.password} error={errors.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          labelAction={<Link to="/forgot-password" className="mb-1.5 text-sm font-semibold text-brand-600 hover:underline">Forgot?</Link>}
        />
        <Button type="submit" size="lg" block loading={busy}>Sign in</Button>
      </form>
    </AuthLayout>
  );
}
