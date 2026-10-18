import { countdownChip, startCountdownTicker } from './planner/countdown.js';
import { nextDeadline } from './planner/deadlines.js';
import { api } from './shared/api.js';
import { el, qs } from './shared/dom.js';
import { countdown, formatDate } from './shared/format.js';
import { icon } from './shared/icons.js';
import { skeleton } from './shared/ui.js';

const UPCOMING_COUNT = 5;
const statsRoot = qs('#home-stats');
const upcomingRoot = qs('#home-upcoming');

function statTile({ iconName, label, value, detail, href }) {
  return el(
    'a',
    { class: 'card card--interactive stat-tile', href },
    el('span', { class: 'stat-tile__label' }, icon(iconName, { size: 16 }), label),
    el('span', { class: 'stat-tile__value' }, value),
    el('span', { class: 'stat-tile__detail muted' }, detail),
  );
}

// Soonest upcoming deadline across active plans, falling back to any conference.
function nextDeadlineTile(plans, conferences) {
  const fromPlans = plans
    .filter((plan) => ['drafting', 'submitted'].includes(plan.status) && plan.target)
    .map((plan) => ({ conf: plan.target, next: nextDeadline(plan.target) }))
    .filter(({ next }) => next)
    .sort((a, b) => new Date(a.next.date) - new Date(b.next.date))[0];
  const fromConferences = conferences
    .map((conf) => ({ conf, next: nextDeadline(conf) }))
    .find(({ next }) => next);
  const pick = fromPlans ?? fromConferences;
  if (!pick) {
    return statTile({
      iconName: 'clock',
      label: 'Next deadline',
      value: '—',
      detail: 'No upcoming deadlines',
      href: 'conferences.html',
    });
  }
  const { conf, next } = pick;
  return statTile({
    iconName: 'clock',
    label: fromPlans ? 'Your next deadline' : 'Next conference deadline',
    value: countdown(next.date).label,
    detail: `${conf.acronym} ${conf.year} ${next.label.toLowerCase()} · ${formatDate(next.date, { aoe: true })}`,
    href: fromPlans ? 'plans.html' : 'conferences.html',
  });
}

function renderStats({ plans, conferences, reviews, papers }) {
  const active = plans.filter((plan) => ['drafting', 'submitted'].includes(plan.status));
  const milestonesLeft = active.reduce(
    (sum, plan) => sum + plan.milestones.filter((m) => !m.done).length,
    0,
  );
  // The papers endpoint returns { total } once the library is seeded.
  const paperTotal = typeof papers?.total === 'number' ? papers.total : null;

  statsRoot.replaceChildren(
    nextDeadlineTile(plans, conferences),
    statTile({
      iconName: 'target',
      label: 'Active plans',
      value: String(active.length),
      detail: active.length ? `${milestonesLeft} milestones to go` : 'Create your first plan',
      href: 'plans.html',
    }),
    statTile({
      iconName: 'book',
      label: 'Reviews',
      value: String(reviews.length),
      detail: reviews.length ? 'Literature reviews in progress' : 'Start a literature review',
      href: 'reviews.html',
    }),
    statTile({
      iconName: 'search',
      label: 'Papers to explore',
      value: paperTotal === null ? '—' : paperTotal.toLocaleString('en-US'),
      detail: 'Recent papers in the library',
      href: 'reviews.html',
    }),
  );
}

function renderUpcoming(conferences) {
  const upcoming = conferences
    .map((conf) => ({ conf, next: nextDeadline(conf) }))
    .filter(({ next }) => next)
    .slice(0, UPCOMING_COUNT);
  if (upcoming.length === 0) {
    upcomingRoot.replaceChildren(el('li', { class: 'muted' }, 'No upcoming deadlines right now.'));
    return;
  }
  upcomingRoot.replaceChildren(
    ...upcoming.map(({ conf, next }) =>
      el(
        'li',
        { class: 'upcoming-item' },
        el('span', { class: 'dot', style: { color: `var(--area-${conf.areas[0]})` } }),
        el(
          'span',
          { class: 'upcoming-item__text' },
          el('strong', {}, `${conf.acronym} ${conf.year}`),
          el(
            'span',
            { class: 'muted' },
            `${next.key === 'notification' ? 'Notification' : `${next.label} deadline`} · ${formatDate(next.date, { aoe: true })}`,
          ),
        ),
        countdownChip(next.date),
      ),
    ),
  );
}

async function load() {
  statsRoot.replaceChildren(skeleton(4, 'row'));
  // One failing section shouldn't blank the whole dashboard.
  const [plans, conferences, reviews, papers] = await Promise.allSettled([
    api.get('/plans'),
    api.get('/conferences'),
    api.get('/reviews'),
    api.get('/papers', { limit: 1 }),
  ]);
  const value = (result, fallback) => (result.status === 'fulfilled' ? result.value : fallback);
  const data = {
    plans: value(plans, []),
    conferences: value(conferences, []),
    reviews: value(reviews, []),
    papers: value(papers, null),
  };
  renderStats(data);
  renderUpcoming(data.conferences);
}

startCountdownTicker();
load();
