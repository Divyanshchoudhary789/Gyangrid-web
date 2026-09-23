import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Keyboard, Camera, Mic, Send, Sparkles, History, CheckCircle2, AlertCircle, Clock, Ban, RefreshCw, ShieldCheck } from 'lucide-react';
import { PageHeader, Card, Button, Tabs, TextArea, Alert, Badge, EmptyState, Skeleton } from '@/components/ui';
import { useQuery, invalidate } from '@/hooks/useQuery';
import { doubtApi } from '@/services/api/student';
import { ApiError, ERROR_CODES, errorMessage } from '@/services/errors';
import { useDocumentTitle, useOnline } from '@/hooks/useCommon';
import { processImage } from '@/lib/image';
import { sanitizeText } from '@/lib/validators';
import { timeAgo, formatDateTime } from '@/lib/date';
import { track } from '@/lib/analytics';
import { DOUBT_LIMITS } from '@/config/constants';
import { cn } from '@/lib/cn';
import { MathKeypad } from './MathKeypad';
import { ImageDoubtInput } from './ImageDoubtInput';
import { VoiceDoubtInput } from './VoiceDoubtInput';

const STAGES = ['Reading your question…', 'Checking it’s in your syllabus…', 'Working through the steps…', 'Writing a clear explanation…'];

/** Staged progress instead of a bare spinner (F7-10). */
export function StagedProgress({ stages = STAGES }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(stages.length - 1, x + 1)), 1100);
    return () => clearInterval(t);
  }, [stages.length]);
  return (
    <div className="flex flex-col items-center py-10 text-center" role="status" aria-live="polite">
      <div className="relative h-20 w-20">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-200 opacity-60" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lift"><Sparkles className="h-9 w-9" /></span>
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-6 font-display text-lg font-semibold text-ink-800">{stages[i]}</motion.p>
      </AnimatePresence>
      <div className="mt-4 flex gap-1.5">{stages.map((s, j) => <span key={s} className={cn('h-1.5 w-8 rounded-full transition', j <= i ? 'bg-brand-500' : 'bg-ink-200')} />)}</div>
    </div>
  );
}

const STATUS = {
  UNDERSTOOD: { tone: 'success', label: 'Understood', icon: CheckCircle2 },
  NEEDS_HELP: { tone: 'warning', label: 'Needs more help', icon: AlertCircle },
  AWAITING_FOLLOW_UP: { tone: 'brand', label: 'Your turn', icon: Clock },
  CLOSED: { tone: 'neutral', label: 'Answered', icon: CheckCircle2 },
};

export default function DoubtsPage() {
  useDocumentTitle('Ask a doubt');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const online = useOnline();
  const initialMode = ['text', 'image', 'voice'].includes(params.get('mode')) ? params.get('mode') : 'text';
  const [mode, setMode] = useState(initialMode);
  const [text, setText] = useState(() => {
    const q = params.get('q');
    const topic = params.get('topic');
    if (q) return `I don't understand this question: ${q}`.slice(0, DOUBT_LIMITS.maxTextChars);
    if (topic) return `About ${topic}: `;
    return '';
  });
  const [image, setImage] = useState(null);
  const [imageNote, setImageNote] = useState('');
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const textRef = useRef(null);
  const { data: history, loading: historyLoading } = useQuery('doubts', doubtApi.list);
  const quota = history?.quota;

  useEffect(() => { setMode(initialMode); }, [initialMode]);

  const insert = (sym) => {
    const el = textRef.current;
    const ch = sym === '−' ? '-' : sym;
    if (!el) { setText((t) => t + ch); return; }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + ch + text.slice(end)).slice(0, DOUBT_LIMITS.maxTextChars);
    setText(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + ch.length, start + ch.length); });
  };

  const canSend = online && !busy && (
    (mode === 'text' && sanitizeText(text).length >= 3)
    || (mode === 'image' && image)
    || (mode === 'voice' && sanitizeText(transcript).length >= 3)
  );

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      let body;
      if (mode === 'text') body = { inputType: 'TEXT', text: sanitizeText(text) };
      else if (mode === 'voice') body = { inputType: 'VOICE', transcript: sanitizeText(transcript) };
      else {
        const processed = await processImage(image.src, { rotation: image.rotation, crop: image.crop });
        if (processed.sizeKb > DOUBT_LIMITS.maxImageMb * 1024) throw new ApiError(ERROR_CODES.VALIDATION, 'This photo is too large even after compression.');
        const up = await doubtApi.signedUrl({ contentType: 'image/jpeg', size: processed.blob?.size || processed.sizeKb * 1024 });
        // Production: PUT processed.blob to up.uploadUrl (private bucket, short-lived signed URL).
        body = { inputType: 'IMAGE', imageRef: up.objectRef, text: sanitizeText(imageNote), imageMeta: { width: processed.width, height: processed.height }, imagePreview: processed.dataUrl };
      }
      const started = performance.now();
      const doubt = await doubtApi.create(body);
      track('doubt_submitted', { inputType: body.inputType, inSyllabus: doubt.scope === 'IN_SYLLABUS', latencyMs: Math.round(performance.now() - started) });
      if (doubt.scope === 'OUT_OF_SCOPE') track('doubt_refused_offsyllabus');
      invalidate('doubts');
      invalidate('home');
      navigate(`/doubts/${doubt.id}`, { state: { fresh: true } });
    } catch (e) {
      // Input is preserved so the student can retry (F7-10); no quota is used on failure (22.1)
      setError(e);
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Ask a doubt" subtitle="Your AI Maths tutor explains step by step — then checks that you’ve got it." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="sm:p-7">
          {busy ? <StagedProgress /> : (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <Tabs value={mode} onChange={(m) => { setMode(m); setError(null); }} ariaLabel="How do you want to ask?" tabs={[
                  { value: 'text', label: 'Type', icon: Keyboard },
                  { value: 'image', label: 'Photo', icon: Camera },
                  { value: 'voice', label: 'Speak', icon: Mic },
                ]} />
                {quota && <span className="text-xs font-semibold text-ink-500">{Math.max(0, quota.limit - quota.usedToday)} of {quota.limit} doubts left today</span>}
              </div>

              {mode === 'text' && (
                <div className="space-y-3">
                  <TextArea
                    ref={textRef} label="Type your question" value={text} onChange={(e) => setText(e.target.value)} maxLength={DOUBT_LIMITS.maxTextChars}
                    placeholder="e.g. Solve 3(x − 2) = 2x + 5, or explain why (a + b)² ≠ a² + b²" rows={5} textareaClassName="text-base"
                  />
                  <MathKeypad onInsert={insert} />
                </div>
              )}
              {mode === 'image' && (
                <div className="space-y-4">
                  <ImageDoubtInput value={image} onChange={setImage} />
                  {image && <TextArea label="Anything to add? (optional)" value={imageNote} onChange={(e) => setImageNote(e.target.value)} maxLength={300} rows={2} placeholder="e.g. I'm stuck at step 2" />}
                  {quota && <p className="text-xs text-ink-500">{Math.max(0, quota.imageLimit - quota.imagesUsed)} photo doubts left today.</p>}
                </div>
              )}
              {mode === 'voice' && <VoiceDoubtInput transcript={transcript} onTranscript={setTranscript} onSwitchToText={() => { setText(transcript); setMode('text'); }} />}

              {error && (
                <Alert
                  tone={error.code === ERROR_CODES.QUOTA_EXCEEDED ? 'warning' : 'danger'} className="mt-5"
                  title={error.code === ERROR_CODES.QUOTA_EXCEEDED ? 'Daily limit reached' : error.details?.unclearImage ? 'Photo not clear enough' : 'Something went wrong'}
                  action={error.code !== ERROR_CODES.QUOTA_EXCEEDED && !error.details?.unclearImage && <Button size="sm" variant="outline" leftIcon={RefreshCw} onClick={send}>Try again</Button>}
                >
                  {errorMessage(error)}
                  {error.details?.resetAt && <> Resets at {formatDateTime(error.details.resetAt)}. Practice, tests and your Mistake Bank are still available.</>}
                </Alert>
              )}

              <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-ink-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-1.5 text-xs text-ink-500"><ShieldCheck className="h-4 w-4 text-emerald-500" />Only Maths from your syllabus. Don&apos;t share personal details.</p>
                <Button size="lg" rightIcon={Send} disabled={!canSend} onClick={send}>{online ? 'Ask the tutor' : 'You are offline'}</Button>
              </div>
            </>
          )}
        </Card>

        <aside>
          <div className="mb-3 flex items-center gap-2"><History className="h-5 w-5 text-ink-400" /><h2 className="section-title">Doubt history</h2></div>
          {historyLoading && !history ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          ) : !history?.items.length ? (
            <EmptyState emoji="💬" title="No doubts yet" description="Your questions and answers will be saved here to revisit any time." />
          ) : (
            <ul className="space-y-2">
              {history.items.map((d) => {
                const refused = d.scope !== 'IN_SYLLABUS';
                const s = refused ? { tone: 'neutral', label: d.scope === 'HIGHER_CLASS' ? 'Higher class' : d.scope === 'SAFETY' ? 'Support' : 'Not Maths', icon: Ban } : STATUS[d.status];
                const Icon = d.inputType === 'IMAGE' ? Camera : d.inputType === 'VOICE' ? Mic : Keyboard;
                return (
                  <li key={d.id}>
                    <Link to={`/doubts/${d.id}`} className="card card-hover flex gap-3 p-3.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-500"><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-semibold text-ink-900">{d.preview}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>
                          <span className="text-xs text-ink-400">{timeAgo(d.createdAt)}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
