import { useEffect, useRef, useState } from 'react';
import { Mic, Square, RotateCcw, Keyboard, LoaderCircle } from 'lucide-react';
import { Button, Alert, TextArea } from '@/components/ui';
import { doubtApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { DOUBT_LIMITS } from '@/config/constants';
import { formatDuration } from '@/lib/date';

/**
 * Voice input: record with a live waveform (max 60 s), transcribe on the server, then the student
 * edits and confirms the transcript. Never submitted blind (F7 input table, acceptance).
 */
export function VoiceDoubtInput({ transcript, onTranscript, onSwitchToText }) {
  const [state, setState] = useState(transcript ? 'done' : 'idle'); // idle | recording | transcribing | done
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const rec = useRef({});

  const cleanup = () => {
    const r = rec.current;
    cancelAnimationFrame(r.raf);
    clearInterval(r.timer);
    r.stream?.getTracks().forEach((t) => t.stop());
    r.audioCtx?.close?.().catch(() => {});
    rec.current = {};
  };
  useEffect(() => cleanup, []);

  const draw = () => {
    const { analyser, data } = rec.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    analyser.getByteFrequencyData(data);
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const bars = 40;
    const step = Math.floor(data.length / bars);
    const bw = width / bars;
    for (let i = 0; i < bars; i += 1) {
      const v = data[i * step] / 255;
      const h = Math.max(4, v * height * 0.9);
      ctx.fillStyle = `rgba(244, 63, 94, ${0.35 + v * 0.65})`;
      ctx.beginPath();
      ctx.roundRect(i * bw + 2, (height - h) / 2, bw - 4, h, 3);
      ctx.fill();
    }
    rec.current.raf = requestAnimationFrame(draw);
  };

  const transcribeBlob = async (blob, durationSec) => {
    setState('transcribing');
    try {
      const up = await doubtApi.signedUrl({ contentType: blob.type || 'audio/webm', size: Math.max(1, blob.size) });
      // Production: PUT the blob to up.uploadUrl, then ask the server to transcribe the object.
      const res = await doubtApi.transcribe({ objectRef: up.objectRef, durationSec });
      if (!res.transcript?.trim()) {
        setError("We couldn't hear a question. Please record again or type it instead.");
        setState('idle');
        return;
      }
      onTranscript(res.transcript);
      setState('done');
    } catch (e) {
      setError(errorMessage(e));
      setState('idle');
    }
  };

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser. Please type your question.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const startedAt = performance.now();
      recorder.onstop = () => {
        const durationSec = Math.round((performance.now() - startedAt) / 1000);
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        cleanup();
        if (durationSec < 1) { setError('That was too short. Hold on a little longer while you speak.'); setState('idle'); return; }
        transcribeBlob(blob, durationSec);
      };
      rec.current = { stream, audioCtx, analyser, data: new Uint8Array(analyser.frequencyBinCount), recorder };
      recorder.start();
      setSeconds(0);
      setState('recording');
      rec.current.timer = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= DOUBT_LIMITS.maxVoiceSec) rec.current.recorder?.state === 'recording' && rec.current.recorder.stop();
          return s + 1;
        });
      }, 1000);
      rec.current.raf = requestAnimationFrame(draw);
    } catch (e) {
      cleanup();
      setError(e?.name === 'NotAllowedError' ? 'Microphone permission was blocked. Allow it in your browser settings, or type your question.' : 'We could not start the microphone. Please type your question instead.');
    }
  };

  const stop = () => { if (rec.current.recorder?.state === 'recording') rec.current.recorder.stop(); };

  return (
    <div>
      {state === 'done' ? (
        <div>
          <TextArea label="Check what we heard — fix anything before sending" value={transcript} onChange={(e) => onTranscript(e.target.value)} maxLength={DOUBT_LIMITS.maxTextChars} rows={4} />
          <Button size="sm" variant="ghost" leftIcon={RotateCcw} className="mt-2" onClick={() => { onTranscript(''); setState('idle'); }}>Record again</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-2xl bg-gradient-to-b from-rose-50 to-white px-4 py-8 text-center">
          <canvas ref={canvasRef} width={320} height={64} className={state === 'recording' ? 'mb-4 h-16 w-full max-w-xs' : 'hidden'} aria-hidden />
          {state === 'transcribing' ? (
            <p className="flex items-center gap-2 font-semibold text-ink-700"><LoaderCircle className="h-5 w-5 animate-spin text-rose-500" />Turning your voice into text…</p>
          ) : state === 'recording' ? (
            <>
              <p className="font-display text-3xl font-bold tabular-nums text-rose-600">{formatDuration(seconds)}</p>
              <p className="mt-1 text-xs text-ink-500">Max {DOUBT_LIMITS.maxVoiceSec}s · speak clearly</p>
              <button type="button" onClick={stop} className="mt-5 flex h-20 w-20 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg ring-8 ring-rose-100 transition hover:bg-rose-700" aria-label="Stop recording"><Square className="h-8 w-8 fill-white" /></button>
            </>
          ) : (
            <>
              <button type="button" onClick={start} className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg ring-8 ring-rose-100 transition hover:scale-105 hover:bg-rose-600" aria-label="Start recording"><Mic className="h-9 w-9" /></button>
              <p className="mt-4 font-semibold text-ink-800">Tap and read your question aloud</p>
              <p className="mt-1 text-sm text-ink-500">You&apos;ll see the text before it&apos;s sent.</p>
            </>
          )}
        </div>
      )}
      {error && (
        <Alert tone="warning" className="mt-3" action={onSwitchToText && <Button size="sm" variant="outline" leftIcon={Keyboard} onClick={onSwitchToText}>Type instead</Button>}>{error}</Alert>
      )}
    </div>
  );
}
