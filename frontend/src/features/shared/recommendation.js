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
  // A target may be a topic or the whole class (e.g. "start reading"); only topics get a deep link.
  const topicId = rec.targetId && rec.targetKind !== 'CLASS' ? rec.targetId : null;
  switch (rec.action) {
    case 'READ_MATERIAL':
      navigate(topicId ? `/learn/topic/${topicId}` : '/learn');
      break;
    case 'PRACTICE_TOPIC': {
      if (!topicId) { navigate('/practice'); break; }
      const set = await practiceApi.start({ scope: 'TOPIC', targetId: topicId, size: 10, difficulty: 'MIXED' });
      navigate(`/practice/session/${set.id}`);
      break;
    }
    case 'REVIEW_MISTAKES':
      navigate(topicId ? `/mistakes?topicId=${encodeURIComponent(topicId)}&status=ACTIVE` : '/mistakes?status=ACTIVE');
      break;
    case 'TAKE_TEST':
      navigate(topicId ? `/tests/${topicId}` : '/tests');
      break;
    default:
      navigate('/challenge');
  }
}
