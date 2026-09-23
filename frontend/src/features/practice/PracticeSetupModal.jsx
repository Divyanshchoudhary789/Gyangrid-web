import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Play } from 'lucide-react';
import { Button, Modal, Alert } from '@/components/ui';
import { practiceApi } from '@/services/api/student';
import { errorMessage } from '@/services/errors';
import { cn } from '@/lib/cn';

const SIZES = [5, 10, 20];
const DIFFS = [
  { value: 'MIXED', label: 'Mixed', hint: 'Recommended' },
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];

/** Practice set-up (F5-13): scope is fixed by the caller; the student picks size and difficulty. */
export function PracticeSetupModal({ open, onClose, scope, targetId, title }) {
  const navigate = useNavigate();
  const [size, setSize] = useState(10);
  const [difficulty, setDifficulty] = useState('MIXED');
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const set = await practiceApi.start({ scope, targetId, size, difficulty });
      if (set.notice) toast.info(set.notice);
      navigate(`/practice/session/${set.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const pill = (active) => cn('rounded-xl border-2 px-4 py-3 text-sm font-bold transition', active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-100 text-ink-600 hover:border-brand-200');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Practise"
      description={title}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button leftIcon={Play} loading={busy} onClick={start}>Start {size} questions</Button></>}
    >
      <p className="label">How many questions?</p>
      <div className="grid grid-cols-3 gap-2">
        {SIZES.map((n) => <button key={n} type="button" className={pill(size === n)} onClick={() => setSize(n)} aria-pressed={size === n}>{n} questions</button>)}
      </div>
      <p className="label mt-5">Difficulty</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DIFFS.map((d) => (
          <button key={d.value} type="button" className={pill(difficulty === d.value)} onClick={() => setDifficulty(d.value)} aria-pressed={difficulty === d.value}>
            {d.label}{d.hint && <span className="block text-[10px] font-semibold opacity-70">{d.hint}</span>}
          </button>
        ))}
      </div>
      <Alert tone="info" className="mt-5">Practice shows the answer and full solution right after each question. Wrong answers go to your Mistake Bank.</Alert>
    </Modal>
  );
}
