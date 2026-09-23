import { Component, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { WifiOff, Coins, Zap, Flame } from 'lucide-react';
import { useOnline } from '@/hooks/useCommon';
import { useCelebrationStore } from '@/store/celebrationStore';
import { Button } from '@/components/ui';

/* ------------------------------------------------------------------ Error boundary */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Hook for crash reporting (NFR-10). Never send PII.
    console.error('[Gyaangrid] UI error', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 text-6xl" aria-hidden>🧮</div>
        <h1 className="text-2xl font-bold">Oops, a sum went wrong</h1>
        <p className="mt-2 max-w-md text-ink-500">Something unexpected happened on this screen. Your progress is safe on our servers.</p>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          <Button variant="outline" onClick={() => { window.location.href = '/'; }}>Go home</Button>
        </div>
      </div>
    );
  }
}

/* ------------------------------------------------------------------ Offline banner (NFR-03, F2-07) */
export function OfflineBanner() {
  const online = useOnline();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-2 bg-ink-900 px-4 py-2 text-sm font-medium text-white"
          role="status"
        >
          <WifiOff className="h-4 w-4" aria-hidden />
          You&apos;re offline — showing your last saved data. Actions will work again when you reconnect.
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ Reward celebration (F10-09: short, non-blocking) */
function fireConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#6d5dfc', '#fbbf24', '#10b981', '#f86a1f', '#38bdf8'];
  confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, colors, disableForReducedMotion: true });
  setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors }), 180);
  setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors }), 300);
}

function CelebrationToast({ item, onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (item.confetti !== false) fireConfetti();
    const t = setTimeout(() => doneRef.current(), item.duration || 3800);
    return () => clearTimeout(t);
  }, [item]);
  return (
    <motion.div
      layout
      initial={{ y: 60, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="pointer-events-auto flex w-[min(92vw,380px)] items-center gap-3 rounded-2xl border border-white/60 bg-white/95 p-3.5 shadow-2xl backdrop-blur"
      role="status"
      onClick={onDone}
    >
      <div className="flex h-12 w-12 shrink-0 animate-wiggle items-center justify-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-500 text-2xl shadow-inner">
        {item.emoji || '🎉'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-bold text-ink-900">{item.title || 'Nice work!'}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {item.xp > 0 && <span className="chip bg-brand-100 text-brand-700"><Zap className="h-3.5 w-3.5" aria-hidden />+{item.xp} XP</span>}
          {item.coins > 0 && <span className="chip bg-gold-100 text-gold-700"><Coins className="h-3.5 w-3.5" aria-hidden />+{item.coins} Gold Coins</span>}
          {item.streak > 0 && <span className="chip bg-flame-100 text-flame-600"><Flame className="h-3.5 w-3.5" aria-hidden />{item.streak}-day streak</span>}
        </div>
      </div>
    </motion.div>
  );
}

export function CelebrationLayer() {
  const { queue, dismiss } = useCelebrationStore();
  const current = queue[0];
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center lg:bottom-8" aria-live="polite">
      <AnimatePresence mode="wait">
        {current && <CelebrationToast key={current.id} item={current} onDone={() => dismiss(current.id)} />}
      </AnimatePresence>
    </div>
  );
}
