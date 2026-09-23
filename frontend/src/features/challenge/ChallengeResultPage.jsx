import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Zap, Coins, Flame, NotebookPen, Home, Target, ChevronDown, CheckCircle2, XCircle, Info } from 'lucide-react';
import { Button, Card, ProgressRing, PageSkeleton, ErrorState, Alert } from '@/components/ui';
import { MathText } from '@/components/math/MathText';
import { SolutionPanel } from '@/components/question/QuestionView';
import { challengeApi, practiceApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { useCelebrationStore } from '@/store/celebrationStore';
import { useDocumentTitle } from '@/hooks/useCommon';
import { cn } from '@/lib/cn';
import { DiagnosisList } from './Diagnosis';

export default function ChallengeResultPage() {
  useDocumentTitle('Challenge result');
  const location = useLocation();
  const navigate = useNavigate();
  const celebrate = useCelebrationStore((s) => s.celebrate);
  const [result, setResult] = useState(location.state?.result || null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const celebrated = useRef(false);

  useEffect(() => {
    if (result) return;
    challengeApi.result().then(setResult).catch(setError);
  }, [result]);

  useEffect(() => {
    if (result && location.state?.fresh && !result.alreadySubmitted && !celebrated.current) {
      celebrated.current = true;
      celebrate({
        title: result.scorePct === 100 ? 'Perfect score!' : result.streak?.extended ? 'Challenge complete!' : 'Well done!',
        xp: result.xpAwarded, coins: result.coinsAwarded, streak: result.streak?.current, emoji: result.scorePct >= 60 ? '🏆' : '🔥',
      });
      navigate('.', { replace: true, state: { result } });
    }
  }, [result, location.state, celebrate, navigate]);

  if (error) return <ErrorState error={error} onRetry={() => { setError(null); challengeApi.result().then(setResult).catch(setError); }} />;
  if (!result) return <PageSkeleton rows={2} />;

  const weakest = [...(result.diagnosis || [])].sort((a, b) => a.accuracy - b.accuracy)[0];
  const practiseWeak = async () => {
    try {
      const set = await practiceApi.start({ scope: 'TOPIC', targetId: weakest.topicId, size: 10, difficulty: 'MIXED' });
      navigate(`/practice/session/${set.id}`);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const tone = result.scorePct >= 80 ? '#10b981' : result.scorePct >= 60 ? '#6d5dfc' : result.scorePct >= 40 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card padded={false} className="overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 via-violet-600 to-indigo-700 px-6 py-8 text-center text-white sm:py-10">
          <p className="text-sm font-bold uppercase tracking-wider text-white/70">Daily Challenge · {result.date}</p>
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 14 }} className="mt-5 inline-block rounded-full bg-white p-2">
            <ProgressRing value={result.scorePct} size={132} stroke={11} tone={tone}>
              <div className="text-center"><p className="font-display text-4xl font-extrabold text-ink-900">{result.score}/{result.total}</p><p className="text-xs font-semibold text-ink-500">{result.scorePct}%</p></div>
            </ProgressRing>
          </motion.div>
          <h1 className="mt-5 text-2xl font-bold text-white sm:text-3xl">
            {result.scorePct === 100 ? 'Flawless! 🌟' : result.scorePct >= 60 ? 'Great job today!' : 'Good effort — you learnt something new!'}
          </h1>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <span className="chip bg-white/15 px-3 py-1.5 text-sm text-white"><Zap className="h-4 w-4 fill-white" />+{result.xpAwarded} XP</span>
            <span className={cn('chip px-3 py-1.5 text-sm', result.coinsAwarded ? 'bg-gold-300 text-ink-900' : 'bg-white/15 text-white/80')}><Coins className="h-4 w-4" />{result.coinsAwarded ? `+${result.coinsAwarded} Gold Coins` : 'No coins today'}</span>
            {result.streak?.current > 0 && <span className="chip bg-flame-500 px-3 py-1.5 text-sm text-white"><Flame className="h-4 w-4 fill-white" />{result.streak.current}-day streak</span>}
          </div>
          {result.coinReason && <p className="mt-3 text-sm text-white/75">{result.coinReason}</p>}
          {result.streak?.milestoneXp > 0 && <p className="mt-3 text-sm font-semibold text-gold-200">🎉 Streak milestone bonus: +{result.streak.milestoneXp} XP</p>}
        </div>
      </Card>

      {result.alreadySubmitted && location.state?.fresh && <Alert tone="info" title="Already submitted">You already completed today&apos;s challenge — here is your original result. Rewards are only given once.</Alert>}

      {result.diagnosis?.length > 0 && (
        <Card>
          <h2 className="section-title mb-1">Topic diagnosis</h2>
          <p className="muted mb-4">Based on your recent answers in each topic.</p>
          <DiagnosisList items={result.diagnosis} />
          {weakest && weakest.status !== 'STRONG' && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-brand-50 p-4 sm:flex-row sm:items-center">
              <Target className="h-6 w-6 shrink-0 text-brand-600" />
              <p className="flex-1 text-sm text-brand-900"><strong>Focus next on {weakest.name}.</strong> A 10-question practice set will lift your mastery.</p>
              <Button size="sm" onClick={practiseWeak}>Practise now</Button>
            </div>
          )}
        </Card>
      )}

      {result.mistakesSaved > 0 && (
        <Alert tone="warning" title={`${result.mistakesSaved} mistake${result.mistakesSaved > 1 ? 's' : ''} saved to your Mistake Bank`} action={<Button size="sm" variant="outline" to="/mistakes?status=ACTIVE">Open</Button>}>
          They will come back for review in 3 days. Fix them to earn XP.
        </Alert>
      )}

      {result.questions?.length > 0 ? (
        <Card>
          <h2 className="section-title mb-4">Answers & worked solutions</h2>
          <div className="space-y-2">
            {result.questions.map((q, i) => (
              <div key={q.questionId} className="overflow-hidden rounded-2xl border border-ink-100">
                <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-50" aria-expanded={open === i}>
                  {q.correct ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <XCircle className="h-5 w-5 shrink-0 text-rose-500" />}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800"><MathText text={q.questionText} /></span>
                  <ChevronDown className={cn('h-5 w-5 shrink-0 text-ink-400 transition', open === i && 'rotate-180')} />
                </button>
                {open === i && <div className="border-t border-ink-100 p-4"><SolutionPanel result={q} compact /></div>}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Alert tone="info" icon={Info}>Detailed solutions for older challenges are in your Mistake Bank.</Alert>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <Button variant="outline" leftIcon={Home} to="/home">Home</Button>
        <Button variant="secondary" leftIcon={NotebookPen} to="/mistakes">Mistake Bank</Button>
        <Button leftIcon={Target} to="/practice">Keep practising</Button>
      </div>
    </div>
  );
}
