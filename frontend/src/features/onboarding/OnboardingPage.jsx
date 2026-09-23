import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ShieldCheck, Lock, Trash2, Eye, Mail, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/brand/Logo';
import { Button, ChoiceCard, TextField, SelectField, Checkbox, Alert, ProgressBar, Avatar } from '@/components/ui';
import { authApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { useAuthStore } from '@/store/authStore';
import { useCelebrationStore } from '@/store/celebrationStore';
import { CLASSES, BOARDS, RELATIONSHIPS, AVATARS, CONSENT_TEXT_VERSION } from '@/config/constants';
import { isEmail, isIndianMobile, isValidName } from '@/lib/validators';
import { firstName } from '@/lib/format';
import { useDocumentTitle } from '@/hooks/useCommon';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { signOut } from '@/features/auth/session';

const STEPS = ['Class', 'Board', 'Parent', 'Consent', 'Avatar'];
const CLASS_EMOJI = { 6: '🌱', 7: '🚲', 8: '🚀', 9: '🧭', 10: '🏆' };

function firstIncompleteStep(profile) {
  if (!profile?.classId) return 0;
  if (!profile?.boardId) return 1;
  if (!profile?.parent) return 2;
  if (!profile?.consent) return 3;
  return 4;
}

export default function OnboardingPage() {
  useDocumentTitle('Set up your account');
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const celebrate = useCelebrationStore((s) => s.celebrate);
  const [step, setStep] = useState(() => firstIncompleteStep(user?.profile));
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [classId, setClassId] = useState(user?.profile?.classId || null);
  const [boardId, setBoardId] = useState(user?.profile?.boardId || 'NCERT_CBSE');
  const [parent, setParent] = useState({ name: user?.profile?.parent?.name || '', relationship: user?.profile?.parent?.relationship || '', contact: '' });
  const [parentErrors, setParentErrors] = useState({});
  const [consent, setConsent] = useState({ selfDeclared: false, accepted: false });
  const [avatarId, setAvatarId] = useState(user?.profile?.avatarId || null);

  const go = (next) => { setDir(next > step ? 1 : -1); setError(null); setStep(next); };

  const save = async (body, next) => {
    setBusy(true);
    setError(null);
    try {
      const u = await authApi.saveProfile(body);
      setUser(u);
      if (next != null) go(next);
      return u;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const validateParent = () => {
    const e = {};
    if (!isValidName(parent.name)) e.name = "Enter your parent or guardian's name.";
    if (!parent.relationship) e.relationship = 'Choose how they are related to you.';
    const c = parent.contact.trim();
    if (!c) e.contact = 'Add a mobile number or email.';
    else if (!isEmail(c) && !isIndianMobile(c)) e.contact = 'Enter a valid email or 10-digit mobile number.';
    setParentErrors(e);
    return !Object.keys(e).length;
  };

  const finish = async (chosen) => {
    const u = await save({ avatarId: chosen, complete: true });
    if (u?.onboarded) {
      track('signup_completed');
      celebrate({ title: `Welcome to GyanGrid, ${firstName(u.name)}!`, emoji: '🎉' });
      navigate('/home', { replace: true });
    }
  };

  const parentHasContact = Boolean(user?.profile?.parent) && !parent.contact;
  const canContinue = useMemo(() => [
    Boolean(classId),
    Boolean(boardId),
    true,
    consent.selfDeclared && consent.accepted,
    true,
  ][step], [step, classId, boardId, consent]);

  const next = async () => {
    if (step === 0) await save({ classId }, 1);
    else if (step === 1) await save({ boardId }, 2);
    else if (step === 2) {
      if (parentHasContact) { go(3); return; }
      if (validateParent()) await save({ parent: { ...parent, contact: parent.contact.trim() } }, 3);
    } else if (step === 3) {
      const u = await save({ consent: { accepted: true, selfDeclared: true, version: CONSENT_TEXT_VERSION } }, 4);
      if (u) {
        track('consent_granted', { method: 'STUDENT_SELF_DECLARATION' });
        toast.success('Thanks! Your parent will be notified.');
      }
    } else if (step === 4) await finish(avatarId || 'owl');
  };

  const variants = {
    enter: (d) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <button type="button" onClick={() => signOut(navigate, { silent: true })} className="text-sm font-semibold text-ink-500 hover:text-ink-800">Sign out</button>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between text-sm font-semibold">
            <span className="text-brand-700">Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
            <span className="text-ink-400">{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
          </div>
          <ProgressBar value={step + 1} max={STEPS.length} label="Onboarding progress" />
          <ol className="mt-3 hidden justify-between sm:flex" aria-hidden>
            {STEPS.map((s, i) => (
              <li key={s} className={cn('flex items-center gap-1.5 text-xs font-semibold', i <= step ? 'text-brand-700' : 'text-ink-300')}>
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px]', i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-100 text-brand-700' : 'bg-ink-100')}>{i < step ? <Check className="h-3 w-3" /> : i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>

        <div className="card relative overflow-hidden p-5 sm:p-8">
          {/* Enter-only animation keyed by step: never blocks the next step from mounting */}
          <motion.div key={step} custom={dir} variants={variants} initial="enter" animate="center" transition={{ duration: 0.22 }}>
              {step === 0 && (
                <section>
                  <h1 className="text-2xl font-bold sm:text-3xl">Hi {firstName(user?.name)}! Which class are you in?</h1>
                  <p className="mt-2 text-ink-500">We&apos;ll show you only the syllabus for your class. You can change this later in Settings.</p>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {CLASSES.map((c) => (
                      <ChoiceCard key={c} selected={classId === c} onClick={() => setClassId(c)} className="flex flex-col items-center py-5 text-center">
                        <span className="text-3xl" aria-hidden>{CLASS_EMOJI[c]}</span>
                        <span className="mt-2 font-display text-lg font-bold text-ink-900">Class {c}</span>
                      </ChoiceCard>
                    ))}
                  </div>
                </section>
              )}

              {step === 1 && (
                <section>
                  <h1 className="text-2xl font-bold sm:text-3xl">Which board do you study?</h1>
                  <p className="mt-2 text-ink-500">GyanGrid follows the NCERT textbooks chapter by chapter.</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {BOARDS.map((b) => (
                      <ChoiceCard key={b.id} selected={boardId === b.id} disabled={!b.active} onClick={() => setBoardId(b.id)}>
                        <p className="font-display text-lg font-bold text-ink-900">{b.name}</p>
                        <p className={cn('mt-1 text-sm', b.active ? 'text-emerald-600' : 'text-ink-400')}>{b.note}</p>
                      </ChoiceCard>
                    ))}
                  </div>
                </section>
              )}

              {step === 2 && (
                <section>
                  <h1 className="text-2xl font-bold sm:text-3xl">Tell us about your parent or guardian</h1>
                  <p className="mt-2 text-ink-500">They&apos;ll get a short weekly report about your progress. We never share their details.</p>
                  {parentHasContact && (
                    <Alert tone="success" className="mt-5" title="Parent details already saved">
                      {user.profile.parent.name} ({user.profile.parent.relationship}) · {user.profile.parent.contactMasked}. Enter a new contact below only if you want to change it.
                    </Alert>
                  )}
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <TextField label="Parent / guardian name" value={parent.name} error={parentErrors.name} onChange={(e) => setParent({ ...parent, name: e.target.value })} autoComplete="off" />
                    <SelectField label="Relationship" placeholder="Choose…" value={parent.relationship} error={parentErrors.relationship} onChange={(e) => setParent({ ...parent, relationship: e.target.value })} options={RELATIONSHIPS.map((r) => ({ value: r, label: r }))} />
                    <TextField
                      className="sm:col-span-2" label="Mobile number or email" icon={Mail} value={parent.contact} error={parentErrors.contact}
                      onChange={(e) => setParent({ ...parent, contact: e.target.value })} autoComplete="off" inputMode="email"
                      hint="Just one contact. It is stored encrypted and shown masked everywhere."
                    />
                  </div>
                </section>
              )}

              {step === 3 && (
                <section>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><ShieldCheck className="h-6 w-6" /></span>
                  <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Before we start: your parent&apos;s permission</h1>
                  <p className="mt-2 text-ink-500">Here is exactly what GyanGrid does with your information, in plain words.</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[
                      { icon: Eye, t: 'What we collect', d: 'Your name, class, board, one parent contact, and your answers, scores and mistakes.' },
                      { icon: ShieldCheck, t: 'Why we collect it', d: 'To show your syllabus, pick the right practice for you and send your parent a weekly summary.' },
                      { icon: Lock, t: 'What we never do', d: 'No ads, no selling data, no date of birth, school or location. Your doubt chats stay private.' },
                      { icon: Trash2, t: 'How to delete it', d: 'Go to Settings → Delete account at any time. Everything is erased within 30 days.' },
                    ].map((x) => (
                      <div key={x.t} className="rounded-2xl border border-ink-100 bg-ink-50/60 p-4">
                        <p className="flex items-center gap-2 font-bold text-ink-900"><x.icon className="h-4 w-4 text-brand-500" aria-hidden />{x.t}</p>
                        <p className="mt-1 text-sm text-ink-600">{x.d}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 space-y-4 rounded-2xl border-2 border-brand-100 bg-brand-50/50 p-4 sm:p-5">
                    <Checkbox
                      checked={consent.selfDeclared}
                      onChange={(v) => setConsent({ ...consent, selfDeclared: v })}
                      label={<span className="font-semibold text-ink-900">I confirm that my parent or guardian knows I am signing up for GyaanGrid and has given me permission to use it.</span>}
                    />
                    <Checkbox
                      checked={consent.accepted}
                      onChange={(v) => setConsent({ ...consent, accepted: v })}
                      label="I have read what GyanGrid collects and why, and I agree to the Privacy policy and Terms of use."
                    />
                  </div>
                  <p className="mt-3 text-xs text-ink-400">Consent version {CONSENT_TEXT_VERSION}. We record the time and the method of this consent. {user?.profile?.parent?.contactMasked ? `A notice will be sent to ${user.profile.parent.contactMasked}.` : ''}</p>
                </section>
              )}

              {step === 4 && (
                <section>
                  <h1 className="text-2xl font-bold sm:text-3xl">Pick your study buddy</h1>
                  <p className="mt-2 text-ink-500">This is how classmates see you on the leaderboard. You can skip this and change it later.</p>
                  <div className="mt-6 flex justify-center"><Avatar id={avatarId || 'owl'} size="xl" ring className="shadow-lift" /></div>
                  <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6">
                    {AVATARS.map((a) => (
                      <button
                        key={a.id} type="button" onClick={() => setAvatarId(a.id)} aria-label={`Choose ${a.id} avatar`} aria-pressed={avatarId === a.id}
                        className={cn('flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br text-3xl transition hover:scale-105 sm:text-4xl', a.bg, avatarId === a.id ? 'ring-4 ring-brand-500 ring-offset-2' : 'opacity-80 hover:opacity-100')}
                      >
                        {a.emoji}
                      </button>
                    ))}
                  </div>
                </section>
              )}
          </motion.div>

          {error && <Alert tone="danger" className="mt-6">{error}</Alert>}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-ink-100 pt-6">
            <Button variant="ghost" leftIcon={ArrowLeft} onClick={() => go(step - 1)} disabled={step === 0 || busy || step === 4} className={cn((step === 0 || step === 4) && 'invisible')}>Back</Button>
            <div className="flex gap-2">
              {step === 4 && <Button variant="outline" onClick={() => finish('owl')} disabled={busy}>Skip</Button>}
              <Button size="lg" rightIcon={ArrowRight} onClick={next} loading={busy} disabled={!canContinue}>
                {step === 3 ? 'I agree, continue' : step === 4 ? "Let's go!" : 'Continue'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
