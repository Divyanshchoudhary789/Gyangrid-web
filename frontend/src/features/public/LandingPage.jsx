import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Target, MessageCircleQuestion, NotebookPen, Timer, ChartLine, Gift, Camera, Mic, Keyboard, ShieldCheck, Mail, Ban, Lock, ArrowRight, Flame, Coins, Zap, CheckCircle2, ChevronDown, BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { useDocumentTitle } from '@/hooks/useCommon';
import { PublicHeader, PublicFooter } from './PublicShell';
import { cn } from '@/lib/cn';

const LOOP = [
  { label: 'Learn', icon: BookOpen, color: 'bg-sky-100 text-sky-700' },
  { label: 'Practise', icon: Target, color: 'bg-brand-100 text-brand-700' },
  { label: 'Test', icon: Timer, color: 'bg-violet-100 text-violet-700' },
  { label: 'Ask doubts', icon: MessageCircleQuestion, color: 'bg-emerald-100 text-emerald-700' },
  { label: 'Find mistakes', icon: NotebookPen, color: 'bg-rose-100 text-rose-700' },
  { label: 'Improve', icon: ChartLine, color: 'bg-amber-100 text-amber-700' },
  { label: 'Earn rewards', icon: Gift, color: 'bg-gold-100 text-gold-700' },
];

const FEATURES = [
  { icon: Target, title: 'Daily Challenge', text: '5 questions picked for you every day — from your weak topics first. Finish before dinner, build a streak.', tone: 'from-brand-500 to-violet-500' },
  { icon: MessageCircleQuestion, title: 'AI Doubt Solver', text: 'Stuck? Type it, snap a photo or just say it. Get step-by-step help and a quick check that you really understood.', tone: 'from-emerald-500 to-teal-500' },
  { icon: NotebookPen, title: 'Mistake Bank', text: 'Every wrong answer is saved with the full solution and the concept. It comes back in 3 days until you nail it.', tone: 'from-rose-500 to-pink-500' },
  { icon: Timer, title: 'Tests & Test Series', text: 'Timed chapter tests and full mock tests with auto-save, instant results and chapter-wise analysis.', tone: 'from-violet-500 to-fuchsia-500' },
  { icon: ChartLine, title: 'Progress & Mastery', text: 'See which topics are Strong, Partial or Need Work — and exactly what to do next.', tone: 'from-sky-500 to-blue-500' },
  { icon: Gift, title: 'XP, Streaks & Gold Coins', text: 'Earn XP for real learning, keep your streak alive and collect Gold Coins for same-day wins.', tone: 'from-amber-400 to-orange-500' },
];

const FAQ = [
  ['Which classes and boards does GyanGrid cover?', 'Mathematics for Classes 6 to 10, following the NCERT / CBSE syllabus. More boards are on the way.'],
  ['Will the AI answer any question?', 'No — and that is on purpose. The tutor only helps with Mathematics from your class syllabus. It teaches step by step and always checks that you understood.'],
  ['Is my child’s data safe?', 'We collect the minimum: class, board and one parent contact. No date of birth, school or location. No ads, no tracking, and doubt conversations are never shared — not even in the parent report.'],
  ['What does the weekly parent report include?', 'Days active, challenges and tests completed, accuracy trend, strong and weak topics, mistakes fixed and rewards earned. It never includes chat content or answers.'],
  ['What are Gold Coins for?', 'Coins reward same-day learning habits — like finishing the Daily Challenge or solving a doubt. Redeeming coins is coming in a future update.'],
];

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-brand-200/60 via-violet-200/40 to-sky-200/50 blur-2xl" aria-hidden />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card overflow-hidden p-0">
        <div className="flex items-center justify-between bg-gradient-to-r from-brand-600 to-violet-600 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-2xl">🦊</span>
            <div><p className="font-display font-bold">Hi Aarav!</p><p className="text-xs text-white/80">Class 8 · NCERT</p></div>
          </div>
          <div className="flex gap-1.5 text-xs font-bold">
            <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-1"><Flame className="h-3.5 w-3.5 fill-flame-400 text-flame-400" />6</span>
            <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-1"><Coins className="h-3.5 w-3.5 text-gold-300" />110</span>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-ink-100 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Today&apos;s Challenge · 3/5</p>
            <MathText as="p" text="Solve for $x$: $5x - 3 = 2x + 9$" className="mt-2 font-semibold text-ink-900" />
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
              {['x = 2', 'x = 4', 'x = 6', 'x = 3'].map((o, i) => (
                <span key={o} className={cn('rounded-xl border-2 px-3 py-2', i === 1 ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-ink-100 text-ink-600')}>{o}</span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700"><Sparkles className="h-3.5 w-3.5" /> AI tutor</p>
            <ol className="mt-2 space-y-1.5 text-sm text-ink-700">
              <li><MathText text="1. Move $x$ terms left: $5x - 2x = 9 + 3$" /></li>
              <li><MathText text="2. Simplify: $3x = 12$" /></li>
              <li><MathText text="3. Divide by 3: $x = 4$ ✓" /></li>
            </ol>
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="absolute -right-3 -top-5 hidden animate-float rounded-2xl bg-white px-3 py-2 shadow-xl sm:block">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink-900"><Zap className="h-4 w-4 fill-brand-400 text-brand-500" /> +50 XP</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="absolute -bottom-5 -left-4 hidden rounded-2xl bg-white px-3 py-2 shadow-xl sm:block">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink-900"><NotebookPen className="h-4 w-4 text-rose-500" /> 2 mistakes saved for review</p>
      </motion.div>
    </div>
  );
}

export default function LandingPage() {
  useDocumentTitle(null);
  const [faq, setFaq] = useState(0);
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-2 lg:pt-20">
          <div>
            <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
              <Sparkles className="h-4 w-4" /> AI Maths tutor for Classes 6–10
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-5 text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-6xl">
              Maths that <span className="text-gradient">finally clicks</span>, one day at a time.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 max-w-xl text-lg text-ink-600">
              A daily challenge made for you, an AI tutor that explains step by step, and a Mistake Bank that turns every wrong answer into a lesson. Built on the NCERT / CBSE syllabus.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button to="/signup" size="xl" rightIcon={ArrowRight}>Start learning — it&apos;s free</Button>
              <Button to="/login" size="xl" variant="outline">I have an account</Button>
            </motion.div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-500">
              {['First reward in under 6 minutes', 'No ads, ever', 'Parent-approved'].map((t) => (
                <span key={t} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{t}</span>
              ))}
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Learning loop */}
      <section id="how" className="border-y border-ink-100 bg-ink-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-sm font-bold uppercase tracking-wider text-brand-600">One complete learning cycle, every day</p>
          <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-bold sm:text-4xl">Not a test app. Not a chatbot. A tutor.</h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {LOOP.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="flex items-center gap-2 sm:gap-3">
                <span className={cn('flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-bold shadow-sm sm:px-4', s.color)}>
                  <s.icon className="h-4 w-4" aria-hidden />{s.label}
                </span>
                {i < LOOP.length - 1 && <ArrowRight className="h-4 w-4 text-ink-300" aria-hidden />}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Everything a student needs to get better at Maths</h2>
            <p className="mt-3 text-lg text-ink-500">Designed with teachers for 11–16 year olds. Friendly, focused and never judgemental.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: (i % 3) * 0.08 }} className="card card-hover p-6">
                <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg', f.tone)}>
                  <f.icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-bold">{f.title}</h3>
                <p className="mt-2 text-ink-600">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Doubt solver */}
      <section className="bg-gradient-to-br from-ink-900 via-brand-950 to-ink-900 py-20 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-gold-300">Unstuck in under 10 seconds</p>
            <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Ask your doubt the way you like</h2>
            <p className="mt-4 text-lg text-white/70">The AI tutor finds the concept, spots where you may have gone wrong, solves it step by step — then asks you one quick question to make sure it clicked.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[{ icon: Keyboard, t: 'Type it', d: 'with a maths keypad' }, { icon: Camera, t: 'Snap it', d: 'printed or handwritten' }, { icon: Mic, t: 'Say it', d: 'check the text, then send' }].map((x) => (
                <div key={x.t} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <x.icon className="h-6 w-6 text-gold-300" aria-hidden />
                  <p className="mt-3 font-bold">{x.t}</p>
                  <p className="text-sm text-white/60">{x.d}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            {[
              ['The concept', 'Solving a linear equation in one variable', 'bg-sky-400/15 text-sky-200'],
              ['Where you may have gone wrong', 'You moved $3x$ to the right but did not change its sign.', 'bg-rose-400/15 text-rose-200'],
              ['Step-by-step', '$5x - 2x = 9 + 3 \\Rightarrow 3x = 12 \\Rightarrow x = 4$', 'bg-emerald-400/15 text-emerald-200'],
              ['Your turn', 'Solve: $7x - 5 = 3x + 11$', 'bg-gold-400/15 text-gold-200'],
            ].map(([h, t, cls]) => (
              <div key={h} className="mb-3 rounded-2xl bg-white/5 p-4 last:mb-0">
                <span className={cn('chip', cls)}>{h}</span>
                <MathText as="p" text={t} className="mt-2 text-white/90" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parents */}
      <section id="parents" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-brand-600">For parents</p>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Know how your child is doing — without reading their chats</h2>
              <p className="mt-4 text-lg text-ink-600">Every Sunday you get a short report: days active, accuracy trend, strong and weak topics, mistakes fixed and one simple suggestion.</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Mail, t: 'Weekly report', d: 'Aggregates only — never doubt conversations or answers.' },
                  { icon: ShieldCheck, t: 'Parental consent', d: 'We ask for your permission before your child can start.' },
                  { icon: Ban, t: 'No ads, no tracking', d: 'No advertising SDKs. Student data is never sold or shared.' },
                  { icon: Lock, t: 'Minimum data', d: 'No date of birth, school name or location. Delete any time.' },
                ].map((x) => (
                  <div key={x.t} className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><x.icon className="h-5 w-5" /></span>
                    <div><p className="font-bold text-ink-900">{x.t}</p><p className="text-sm text-ink-500">{x.d}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-6 sm:p-8">
              <p className="text-xs font-semibold text-ink-400">Subject: GyanGrid — Aarav&apos;s week in Maths</p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {[['5', 'active days'], ['71%', 'accuracy ↑6'], ['9', 'mistakes fixed']].map(([v, l]) => (
                  <div key={l} className="rounded-2xl bg-ink-50 p-3"><p className="font-display text-2xl font-bold text-ink-900">{v}</p><p className="text-xs text-ink-500">{l}</p></div>
                ))}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <p><span className="font-bold text-emerald-600">Doing well:</span> Linear Equations · Integers</p>
                <p><span className="font-bold text-amber-600">Needs attention:</span> Triangles · Mensuration</p>
                <p className="rounded-xl bg-brand-50 p-3 text-brand-900">💡 Ask Aarav to explain how to find the area of a triangle out loud — it is this week&apos;s weakest topic.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-ink-100 bg-ink-50 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold">Questions, answered</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map(([q, a], i) => (
              <div key={q} className="card overflow-hidden p-0">
                <button type="button" className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-ink-900" onClick={() => setFaq(faq === i ? -1 : i)} aria-expanded={faq === i}>
                  {q}
                  <ChevronDown className={cn('h-5 w-5 shrink-0 text-ink-400 transition', faq === i && 'rotate-180')} />
                </button>
                <div className={cn('grid transition-all', faq === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <p className="overflow-hidden px-5 text-ink-600"><span className="block pb-4">{a}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-600 via-violet-600 to-sky-500 px-6 py-14 text-center text-white shadow-lift sm:px-12">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Your first reward is 5 questions away</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-white/80">Sign up, pick your class, and take today&apos;s challenge. It takes less than 6 minutes.</p>
          <Button to="/signup" size="xl" variant="white" className="mt-8" rightIcon={ArrowRight}>Create my free account</Button>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
