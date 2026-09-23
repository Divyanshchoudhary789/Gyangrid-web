import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MailCheck } from 'lucide-react';
import { Button, TextField, Alert } from '@/components/ui';
import { authApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { isEmail } from '@/lib/validators';
import { useDocumentTitle } from '@/hooks/useCommon';
import { AuthLayout } from './AuthLayout';

export default function ForgotPasswordPage() {
  useDocumentTitle('Reset password');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    setError(null);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={sent ? 'Check your inbox' : 'Forgot your password?'}
      subtitle={sent ? null : "No problem. We'll email you a link to set a new one."}
      footer={<Link to="/login" className="font-semibold text-brand-600 hover:underline">← Back to sign in</Link>}
    >
      {sent ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center">
          <MailCheck className="mx-auto h-12 w-12 text-emerald-500" aria-hidden />
          <p className="mt-3 font-semibold text-emerald-900">If an account exists for {email}, a reset link is on its way.</p>
          <p className="mt-1 text-sm text-emerald-800/80">The link works once and expires in 30 minutes. Check your spam folder too.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <TextField label="Email" type="email" icon={Mail} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" size="lg" block loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  );
}
