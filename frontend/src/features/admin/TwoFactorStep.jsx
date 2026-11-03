import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { Alert, Button, TextField } from '@/components/ui';
import { adminApi } from '@/services/api/admin';
import { errorMessage } from '@/services/errors';

const secretOf = (url) => {
  try { return new URL(url).searchParams.get('secret') || ''; } catch { return ''; }
};

/**
 * TOTP step of admin sign-in. The enrolment URL holds the secret, so the QR code is drawn on this
 * device (never by an external service) and nothing is stored; it lives only in component state.
 */
export function TwoFactorStep({ onVerified, onBack }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [setup, setSetup] = useState(null);
  const [qr, setQr] = useState(null);

  useEffect(() => {
    if (!setup) return undefined;
    let live = true;
    QRCode.toDataURL(setup, { width: 220, margin: 1 }).then((url) => { if (live) setQr(url); }).catch(() => {});
    return () => { live = false; };
  }, [setup]);

  const enrol = async () => {
    setBusy(true);
    setError(null);
    try {
      setSetup(await adminApi.setupTwoFactor());
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
      onVerified(await adminApi.verifyTwoFactor(code));
    } catch (err) {
      setError(errorMessage(err));
      setCode('');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={verify} className="space-y-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600"><ShieldCheck className="h-6 w-6" /></span>
      <h1 className="text-2xl font-bold">Two-step verification</h1>
      {setup ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-500">Scan this with Google Authenticator, Authy or a similar app, then enter the 6-digit code it shows.</p>
          {qr && <img src={qr} alt="QR code for your authenticator app" width={220} height={220} className="mx-auto rounded-xl border border-ink-100" />}
          <details className="rounded-xl bg-ink-50 p-3 text-xs text-ink-600">
            <summary className="cursor-pointer font-semibold">Can&apos;t scan? Enter the key by hand</summary>
            <code className="mt-2 block break-all font-mono">{secretOf(setup)}</code>
          </details>
          <Alert tone="warning">Keep this key private. Don&apos;t screenshot it or share it.</Alert>
        </div>
      ) : (
        <p className="text-sm text-ink-500">Enter the 6-digit code from your authenticator app. You&apos;ll stay verified for 12 hours.</p>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <TextField label="Verification code" icon={KeyRound} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} inputClassName="tracking-[0.4em] text-lg font-bold" autoFocus />
      <Button type="submit" size="lg" block loading={busy} disabled={code.length !== 6}>Verify &amp; sign in</Button>
      {!setup && <Button type="button" variant="ghost" block leftIcon={Smartphone} disabled={busy} onClick={enrol}>First time? Set up an authenticator app</Button>}
      <button type="button" onClick={onBack} className="w-full text-center text-sm font-semibold text-ink-500 hover:text-ink-800">← Use a different account</button>
    </form>
  );
}
