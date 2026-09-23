/**
 * Remote config (config/app). Every tunable lives here, never hard-coded in client or API
 * (principle 2.1, F10-02, F12-07). Values are the PRD defaults pending D-11 / D-12 / D-13.
 */
export const DEFAULT_CONFIG = {
  version: 7,
  challenge: { size: 5, mix: { EASY: 2, MEDIUM: 2, HARD: 1 }, reminderTime: '17:00' },
  xp: {
    DAILY_CHALLENGE: 50,
    ALL_CORRECT_BONUS: 25,
    PRACTICE_QUESTION: 2,
    PRACTICE_DAILY_CAP: 60,
    MISTAKE_RESOLVED: 15,
    MISTAKE_DAILY_CAP: 90,
    TEST_COMPLETED: 60,
    DOUBT_UNDERSTOOD: 20,
    DOUBT_DAILY_CAP: 40,
    STREAK_MILESTONES: { 3: 30, 7: 75, 15: 150, 30: 300 },
  },
  coins: {
    DAILY_CHALLENGE: { amount: 10, minScorePct: 60 },
    DOUBT_SOLVED: { amount: 5 },
    BOTH_BONUS: { enabled: false, amount: 5 },
  },
  reviewCycleDays: 3,
  mastery: { accuracy: 0.55, recency: 0.25, mistakeResolution: 0.2, minAttempts: 5 },
  ai: { doubtsPerDay: 15, doubtsPerMonth: 300, imagesPerDay: 5, maxReexplain: 2 },
  flags: { referrals: false, aiQuestionFallback: false, parentReport: true, voiceDoubts: true },
  parentReport: { day: 'Sunday', time: '08:00', channel: 'EMAIL' },
};
