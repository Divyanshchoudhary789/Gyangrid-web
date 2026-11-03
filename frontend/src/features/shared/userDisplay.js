/**
 * Display helpers that work for both data sources: the real API identifies a class by id and
 * exposes `grade`; the local mock identifies it by the grade number itself.
 */
export const gradeOf = (user) => user?.profile?.grade ?? (typeof user?.profile?.classId === 'number' ? user.profile.classId : null);

export const classLabel = (user) => {
  const g = gradeOf(user);
  return g ? `Class ${g}` : user?.profile?.className || 'Your class';
};

export const boardLabel = (user) => user?.profile?.boardName || 'NCERT / CBSE';
