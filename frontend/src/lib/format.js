export const formatNumber = (n) => new Intl.NumberFormat('en-IN').format(n ?? 0);
export const pct = (n) => `${Math.round(n ?? 0)}%`;

export function maskContact(contact = '') {
  if (!contact) return '';
  if (contact.includes('@')) {
    const [user, domain] = contact.split('@');
    return `${user.slice(0, 2)}${'•'.repeat(Math.max(2, user.length - 2))}@${domain}`;
  }
  const digits = contact.replace(/\D/g, '').slice(-10);
  return `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

/** "Aarav Kumar" -> "Aarav K." (F2-09) */
export function leaderboardName(fullName = '') {
  const [first = 'Student', last = ''] = fullName.trim().split(/\s+/);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

export const firstName = (fullName = '') => fullName.trim().split(/\s+/)[0] || 'there';

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Level curve: level n needs n*100 XP (100, 200, 300 ...). */
export function levelFromXp(xp = 0) {
  let level = 1;
  let need = 100;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level += 1;
    need += 100;
  }
  return { level, intoLevel: rest, levelSize: need, progress: Math.round((rest / need) * 100) };
}

export function masteryBand(score) {
  if (score == null) return { key: 'NO_DATA', label: 'Not enough data', tone: 'neutral' };
  if (score >= 75) return { key: 'STRONG', label: 'Strong', tone: 'success' };
  if (score >= 50) return { key: 'PARTIAL', label: 'Partial', tone: 'warning' };
  return { key: 'NEEDS_WORK', label: 'Needs Work', tone: 'danger' };
}
