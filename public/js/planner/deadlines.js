// Conference deadline helpers shared by the planner pages. Missing (TBD) dates are null.
export const DEADLINES = [
  { key: 'abstract', label: 'Abstract' },
  { key: 'paper', label: 'Paper' },
  { key: 'notification', label: 'Notification' },
  { key: 'cameraReady', label: 'Camera-ready' },
];

// Nearest deadline still in the future, or null.
export function nextDeadline(conference, now = new Date()) {
  return (
    DEADLINES.map(({ key, label }) => ({ key, label, date: conference.deadlines?.[key] }))
      .filter(({ date }) => date && new Date(date) > now)
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null
  );
}

export function hasAnyDate(conference) {
  return Boolean(conference.startDate || DEADLINES.some(({ key }) => conference.deadlines?.[key]));
}

export const isUserCreated = (conference) => !conference.isSeed;
