import { useRef, useState } from 'react';
import { Camera, ImagePlus, RotateCcw, RotateCw, Crop, X, Lightbulb } from 'lucide-react';
import { Button, Alert } from '@/components/ui';
import { validateImageFile, readFileAsDataUrl } from '@/lib/image';
import { cn } from '@/lib/cn';

/**
 * Photo input: camera or gallery, then rotate and drag-to-crop on the client.
 * Compression + downscaling to 1600 px happens on submit (F7 input table).
 */
export function ImageDoubtInput({ value, onChange }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const frameRef = useRef(null);
  const [error, setError] = useState(null);
  const [cropMode, setCropMode] = useState(false);
  const [drag, setDrag] = useState(null);

  const pick = async (file) => {
    setError(null);
    const err = validateImageFile(file);
    if (err) { setError(err); return; }
    try {
      const src = await readFileAsDataUrl(file);
      onChange({ src, rotation: 0, crop: null, name: file.name });
    } catch (e) {
      setError(e.message);
    }
  };

  const point = (e) => {
    const r = frameRef.current.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const onDown = (e) => { if (!cropMode) return; e.currentTarget.setPointerCapture(e.pointerId); const p = point(e); setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); };
  const onMove = (e) => { if (!drag) return; const p = point(e); setDrag((d) => ({ ...d, x1: p.x, y1: p.y })); };
  const onUp = () => {
    if (!drag) return;
    const x = Math.min(drag.x0, drag.x1);
    const y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0);
    const h = Math.abs(drag.y1 - drag.y0);
    setDrag(null);
    if (w > 0.08 && h > 0.08) { onChange({ ...value, crop: { x, y, w, h } }); setCropMode(false); }
  };

  if (!value) {
    return (
      <div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => cameraRef.current?.click()} className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 text-emerald-700 transition hover:bg-emerald-50">
            <Camera className="h-8 w-8" /><span className="font-bold">Take a photo</span><span className="text-xs text-emerald-700/70">Use your camera</span>
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50 text-ink-600 transition hover:bg-ink-100">
            <ImagePlus className="h-8 w-8" /><span className="font-bold">Upload from gallery</span><span className="text-xs text-ink-500">JPG, PNG or HEIC · up to 5 MB</span>
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
        <p className="mt-3 flex items-start gap-2 text-xs text-ink-500"><Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />Tip: good light, one question per photo, and the whole question inside the frame.</p>
      </div>
    );
  }

  const c = value.crop;
  const liveRect = drag && { left: `${Math.min(drag.x0, drag.x1) * 100}%`, top: `${Math.min(drag.y0, drag.y1) * 100}%`, width: `${Math.abs(drag.x1 - drag.x0) * 100}%`, height: `${Math.abs(drag.y1 - drag.y0) * 100}%` };

  return (
    <div>
      <div className="relative mx-auto flex max-h-[380px] items-center justify-center overflow-hidden rounded-2xl bg-ink-900 p-3">
        <div
          ref={frameRef}
          className={cn('relative touch-none select-none', cropMode && 'cursor-crosshair')}
          style={{ transform: `rotate(${value.rotation}deg)`, transition: 'transform .25s ease' }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        >
          <img src={value.src} alt="Your question" className="max-h-[340px] w-auto rounded-lg" draggable={false} />
          {c && !cropMode && (
            <div className="pointer-events-none absolute border-2 border-gold-300 shadow-[0_0_0_9999px_rgba(0,0,0,.55)]" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }} />
          )}
          {liveRect && <div className="pointer-events-none absolute border-2 border-dashed border-white bg-white/10" style={liveRect} />}
        </div>
        {cropMode && <p className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">Drag over the question to crop</p>}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" leftIcon={RotateCcw} onClick={() => onChange({ ...value, rotation: (value.rotation + 270) % 360, crop: null })}>Rotate</Button>
        <Button size="sm" variant="outline" leftIcon={RotateCw} onClick={() => onChange({ ...value, rotation: (value.rotation + 90) % 360, crop: null })}>Rotate</Button>
        <Button size="sm" variant={cropMode ? 'primary' : 'outline'} leftIcon={Crop} onClick={() => setCropMode((m) => !m)} disabled={value.rotation !== 0}>{c ? 'Re-crop' : 'Crop'}</Button>
        {c && <Button size="sm" variant="ghost" onClick={() => onChange({ ...value, crop: null })}>Reset crop</Button>}
        <Button size="sm" variant="ghost" leftIcon={X} onClick={() => onChange(null)}>Remove</Button>
      </div>
      {value.rotation !== 0 && <p className="mt-2 text-center text-xs text-ink-400">Rotate back to 0° to crop.</p>}
    </div>
  );
}
