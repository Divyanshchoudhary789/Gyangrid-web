import { BookOpen, Target, NotebookPen, Timer, Flame } from 'lucide-react';
import { practiceApi } from '@/services/api/student';
import { track } from '@/lib/analytics';

/** Closed action set from generateRecommendation() → a working deep link, always (F9-07). */
export const REC_META = {
  READ_MATERIAL: { icon: BookOpen, label: 'Read' },
  PRACTICE_TOPIC: { icon: Target, label: 'Practise' },
  REVIEW_MISTAKES: { icon: NotebookPen, label: 'Review' },
  TAKE_TEST: { icon: Timer, label: 'Test' },
  CONTINUE_CHALLENGE: { icon: Flame, label: 'Challenge' },
};

export async function openRecommendation(rec, navigate) {
  if (!rec) return;
  track('recommendation_tapped', { action: rec.action });
  switch (rec.action) {
    case 'READ_MATERIAL':
      navigate(`/learn/topic/${rec.targetId}`);
      break;
    case 'PRACTICE_TOPIC': {
      const set = await practiceApi.start({ scope: 'TOPIC', targetId: rec.targetId, size: 10, difficulty: 'MIXED' });
      navigate(`/practice/session/${set.id}`);
      break;
    }
    case 'REVIEW_MISTAKES':
      navigate(`/mistakes?topicId=${encodeURIComponent(rec.targetId)}&status=ACTIVE`);
      break;
    case 'TAKE_TEST':
      navigate(rec.targetId ? `/tests/${rec.targetId}` : '/tests');
      break;
    default:
      navigate('/challenge');
  }
}
