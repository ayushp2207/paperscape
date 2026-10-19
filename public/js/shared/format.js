// Dates in Paperscape:
// - Deadlines are "Anywhere on Earth" (UTC-12). A deadline day "2027-01-28" is stored as
//   2027-01-28T23:59 UTC-12, and displayed in the AoE time zone so the day never shifts.
// - Calendar days (conference start/end) are stored at 12:00 UTC and displayed in UTC.
const DAY_MS = 24 * 60 * 60 * 1000;
const AOE_ZONE = 'Etc/GMT+12'; // POSIX sign is inverted: this is UTC-12

export function aoeEndOfDay(dateString) {
  return new Date(`${dateString}T23:59:00-12:00`);
}

export function calendarDay(dateString) {
  return new Date(`${dateString}T12:00:00Z`);
}

// Value for <input type="date">. Pass { aoe: true } for deadlines.
export function toDateInputValue(date, { aoe = false } = {}) {
  if (!date) return '';
  const d = new Date(date);
  const shifted = aoe ? new Date(d.getTime() - 12 * 60 * 60 * 1000) : d;
  return shifted.toISOString().slice(0, 10);
}

export function formatDate(date, { aoe = false, withYear = true } = {}) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: withYear ? 'numeric' : undefined,
    timeZone: aoe ? AOE_ZONE : 'UTC',
  }).format(new Date(date));
}

export function formatDateRange(start, end) {
  if (!end || toDateInputValue(start) === toDateInputValue(end)) return formatDate(start);
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  return `${formatDate(s, { withYear: !sameYear })} – ${formatDate(e)}`;
}

export function countdown(date, now = new Date()) {
  const diff = new Date(date).getTime() - now.getTime();
  if (diff <= 0) return { passed: true, days: 0, hours: 0, minutes: 0, label: 'closed' };
  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const label = days >= 1 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
  return { passed: false, days, hours, minutes, label };
}

// 'passed' | 'urgent' (< 7 days) | 'soon' (≤ 30 days) | 'ok'
export function urgency(date, now = new Date()) {
  const days = (new Date(date).getTime() - now.getTime()) / DAY_MS;
  if (days <= 0) return 'passed';
  if (days < 7) return 'urgent';
  if (days <= 30) return 'soon';
  return 'ok';
}

const RELATIVE_UNITS = [
  ['year', 365 * DAY_MS],
  ['month', 30 * DAY_MS],
  ['week', 7 * DAY_MS],
  ['day', DAY_MS],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

export function relativeTime(date, now = new Date()) {
  const diff = new Date(date).getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}
