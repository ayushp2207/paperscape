// Plan warnings. Pure functions: plans in (with embedded target/backup), warnings out.
// Each warning: { type, message, planIds }. TBD (null) dates never trigger anything.
import { formatDate } from '../shared/format.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const CLASH_WINDOW_DAYS = 7;
export const MIN_TRAVEL_DAYS = 42;

// Accepted, rejected and withdrawn plans have nothing left to plan around.
const ACTIVE_STATUSES = ['drafting', 'submitted'];
const isActive = (plan) => ACTIVE_STATUSES.includes(plan.status);
const name = (conf) => `${conf.acronym} ${conf.year}`;
const day = (date) => formatDate(date, { aoe: true, withYear: false });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Upcoming target deadlines and unfinished milestones of one plan.
function planEvents(plan, now) {
  const events = [];
  for (const [key, label] of [
    ['abstract', 'abstract deadline'],
    ['paper', 'paper deadline'],
  ]) {
    const date = plan.target?.deadlines?.[key];
    if (date) events.push({ plan, date: new Date(date), label: `${name(plan.target)} ${label}` });
  }
  for (const milestone of plan.milestones ?? []) {
    if (!milestone.done) {
      events.push({ plan, date: new Date(milestone.dueDate), label: `"${milestone.label}"` });
    }
  }
  return events.filter((event) => event.date >= now);
}

// Two deadlines from different plans within the window. Reports the closest pair per plan pair.
export function findClashes(plans, now = new Date(), windowDays = CLASH_WINDOW_DAYS) {
  const events = plans
    .filter(isActive)
    .flatMap((plan) => planEvents(plan, now))
    .sort((a, b) => a.date - b.date);
  const closest = new Map();
  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      const gap = (events[j].date - events[i].date) / DAY_MS;
      if (gap > windowDays) break; // sorted: nothing further can be closer
      if (events[i].plan._id === events[j].plan._id) continue;
      const key = [events[i].plan._id, events[j].plan._id].sort().join('|');
      if (!closest.has(key) || gap < closest.get(key).gap) {
        closest.set(key, { a: events[i], b: events[j], gap });
      }
    }
  }
  return [...closest.values()].map(({ a, b, gap }) => {
    const days = Math.round(gap);
    return {
      type: 'clash',
      message:
        `${a.label} (${day(a.date)}, "${a.plan.paperTitle}") and ${b.label} ` +
        `(${day(b.date)}, "${b.plan.paperTitle}") are ${days === 0 ? 'on the same day' : `${plural(days, 'day')} apart`}`,
      planIds: [a.plan._id, b.plan._id],
    };
  });
}

// Less than the minimum time between acceptance notification and the conference starting.
export function findTravelSqueeze(plans, now = new Date(), minDays = MIN_TRAVEL_DAYS) {
  const warnings = [];
  for (const plan of plans.filter(isActive)) {
    for (const [role, conf] of [
      ['target', plan.target],
      ['backup', plan.backup],
    ]) {
      const notification = conf?.deadlines?.notification;
      if (!notification || !conf.startDate || new Date(conf.startDate) < now) continue;
      const gap = (new Date(conf.startDate) - new Date(notification)) / DAY_MS;
      if (gap >= minDays) continue;
      const days = Math.max(0, Math.round(gap));
      warnings.push({
        type: 'travel',
        message:
          `${name(conf)} (${role}): only ${plural(days, 'day')} between notification ` +
          `(${day(notification)}) and the conference (${day(conf.startDate)}). ` +
          `Start visa and travel plans early.`,
        planIds: [plan._id],
      });
    }
  }
  return warnings;
}

// The backup's paper deadline passes before the target's decision arrives.
export function findBackupGap(plans, now = new Date()) {
  return plans
    .filter(isActive)
    .filter((plan) => {
      const backupDeadline = plan.backup?.deadlines?.paper;
      const targetNotification = plan.target?.deadlines?.notification;
      return (
        backupDeadline &&
        targetNotification &&
        new Date(backupDeadline) >= now &&
        new Date(backupDeadline) < new Date(targetNotification)
      );
    })
    .map((plan) => ({
      type: 'backup',
      message:
        `Backup ${name(plan.backup)} closes (${day(plan.backup.deadlines.paper)}) before ` +
        `${name(plan.target)} decides (${day(plan.target.deadlines.notification)}), ` +
        `so you can't wait for the result before submitting there.`,
      planIds: [plan._id],
    }));
}

export function findWarnings(plans, now = new Date()) {
  return [
    ...findClashes(plans, now),
    ...findTravelSqueeze(plans, now),
    ...findBackupGap(plans, now),
  ];
}
