import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, UserRound, Check } from 'lucide-react';
import { Button, TextField, PasswordField, Alert, Checkbox } from '@/components/ui';
import { authApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { isEmail, isValidName, passwordIssues, passwordStrength } from '@/lib/validators';
import { useDocumentTitle } from '@/hooks/useCommon';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { AuthLayout, Divider } from './AuthLayout';
import { GoogleSignIn } from './GoogleSignIn';
import { startSession } from './session';

const RULES = [
  { test: (p) => p.length >= 8, label: '8+ characters' },
  { test: (p) => /[A-Za-z]/.test(p), label: 'a letter' },
  { test: (p) => /\d/.test(p), label: 'a number' },
];

export default function SignupPage() {
  useDocumentTitle('Create account');
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(form.password);

  const validate = () => {
    const e = {};
    if (!isValidName(form.name)) e.name = 'Enter your name (letters only).';
    if (!isEmail(form.email)) e.email = 'Enter a valid email address.';
    if (passwordIssues(form.password).length) e.password = 'Your password needs at least 8 characters, a letter and a number.';
    if (!agree) e.agree = 'Please accept the terms to continue.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setBusy(true);
    track('signup_started', { method: 'password' });
    try {
      const res = await authApi.register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      startSession(res);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free for students. Takes about a minute."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link></>}
    >
      <GoogleSignIn label="Sign up with Google" />
      <Divider label="or use your email" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <TextField label="Your name" icon={UserRound} autoComplete="name" value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} hint="Only your first name and one letter of your surname are shown to others." />
        <TextField label="Email" type="email" icon={Mail} autoComplete="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div>
          <PasswordField label="Create a password" icon={Lock} autoComplete="new-password" value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {form.password && (
            <div className="mt-2.5">
              <div className="flex gap-1.5" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={cn('h-1.5 flex-1 rounded-full transition', i < strength ? ['bg-rose-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500'][strength - 1] : 'bg-ink-100')} />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {RULES.map((r) => (
                  <li key={r.label} className={cn('flex items-center gap-1 font-medium', r.test(form.password) ? 'text-emerald-600' : 'text-ink-400')}>
                    <Check className="h-3.5 w-3.5" aria-hidden /> {r.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <Checkbox
            checked={agree}
            onChange={setAgree}
            label={<>I agree to the <Link to="/terms" target="_blank" className="font-semibold text-brand-600 hover:underline">Terms of use</Link> and <Link to="/privacy" target="_blank" className="font-semibold text-brand-600 hover:underline">Privacy policy</Link>.</>}
          />
          {errors.agree && <p className="mt-1.5 text-sm font-medium text-rose-600" role="alert">{errors.agree}</p>}
        </div>
        <Button type="submit" size="lg" block loading={busy}>Create account</Button>
        <p className="text-center text-xs text-ink-400">Next, we&apos;ll ask for your class and your parent&apos;s permission.</p>
      </form>
    </AuthLayout>
  );
}
