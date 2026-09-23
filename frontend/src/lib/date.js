/** All "day" logic follows the server day boundary: 00:00 Asia/Kolkata (F5-05). */
export const IST_TZ = 'Asia/Kolkata';

export function istDateKey(date = new Date()) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function addDays(dateKey, days) {
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + days);
  return istDateKey(d);
}

export function daysBetween(fromKey, toKey) {
  const a = new Date(`${fromKey}T12:00:00+05:30`).getTime();
  const b = new Date(`${toKey}T12:00:00+05:30`).getTime();
  return Math.round((b - a) / 86400000);
}

export function nextIstMidnight(now = new Date()) {
  return new Date(`${addDays(istDateKey(now), 1)}T00:00:00+05:30`);
}

/** Monday-based ISO week start (IST) for weekly leaderboards / parent report. */
export function weekStartKey(dateKey = istDateKey()) {
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(dateKey, -dow);
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(input) {
  const ts = typeof input === 'number' ? input : new Date(input).getTime();
  const diff = (ts - Date.now()) / 1000;
  const units = [
    ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return 'just now';
}

export function formatDate(input, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: IST_TZ, ...opts }).format(new Date(input));
}

export function formatDateTime(input) {
  return formatDate(input, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function shortDay(dateKey) {
  return formatDate(`${dateKey}T12:00:00+05:30`, { weekday: 'short' });
}

export function formatDuration(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function humanDuration(totalSec) {
  const m = Math.round(totalSec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: IST_TZ, hour: 'numeric', hour12: false }).format(now));
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
