import { motion } from 'framer-motion';
import { Flame, NotebookPen, Sparkles } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { MathText } from '@/components/math/MathText';

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-violet-700 to-indigo-800 p-10 text-white lg:flex lg:flex-col">
        <div className="bg-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />
        <Logo light className="relative" />
        <div className="relative mt-auto max-w-md">
          <h2 className="text-4xl font-bold leading-tight text-white">Every wrong answer is a step forward.</h2>
          <p className="mt-4 text-lg text-white/75">Daily challenges, an AI tutor that teaches step by step, and a Mistake Bank that makes sure you never repeat the same slip.</p>
          <div className="mt-10 space-y-3">
            {[
              { icon: Sparkles, text: <MathText text="AI tutor: “Divide both sides by 3, so $x = 4$.”" /> },
              { icon: NotebookPen, text: 'Mistake saved — it comes back in 3 days' },
              { icon: Flame, text: '6-day streak! Keep it going 🔥' },
            ].map((x, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.15 }} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <x.icon className="h-5 w-5 shrink-0 text-gold-300" aria-hidden />
                <span className="text-sm font-medium text-white/90">{x.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="relative mt-10 text-sm text-white/50">Mathematics · Classes 6–10 · NCERT / CBSE</p>
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Logo className="lg:hidden" />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-ink-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-ink-500">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export function Divider({ label = 'or' }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
      <span className="h-px flex-1 bg-ink-200" />{label}<span className="h-px flex-1 bg-ink-200" />
    </div>
  );
}
