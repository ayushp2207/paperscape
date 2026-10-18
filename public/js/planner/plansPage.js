import { api } from '../shared/api.js';
import { el, qs } from '../shared/dom.js';
import { formatDate, formatDateRange } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { confirmDialog, emptyState, errorState, skeleton, toast } from '../shared/ui.js';
import { countdownChip, startCountdownTicker } from './countdown.js';
import { nextDeadline } from './deadlines.js';
import { initPlanForm } from './planForm.js';

const STATUS = {
  drafting: { label: 'Drafting', badge: 'badge--accent' },
  submitted: { label: 'Submitted', badge: 'badge--warning' },
  accepted: { label: 'Accepted', badge: 'badge--success' },
  rejected: { label: 'Rejected', badge: 'badge--danger' },
  withdrawn: { label: 'Withdrawn', badge: '' },
};

const state = { plans: [], conferences: [], loaded: false, error: null };
const root = qs('#plans-root');

const form = initPlanForm(qs('#plan-dialog'), {
  getConferences: () => state.conferences,
  onSaved: () => load(),
});

// Soonest target deadline first, so cards don't jump around when a milestone is ticked.
function sortKey(plan) {
  const next = plan.target && nextDeadline(plan.target);
  return next ? new Date(next.date).getTime() : Infinity;
}

async function load() {
  try {
    const [plans, conferences] = await Promise.all([
      api.get('/plans'),
      api.get('/conferences', { past: 'true' }),
    ]);
    state.plans = plans.sort(
      (a, b) => sortKey(a) - sortKey(b) || a.paperTitle.localeCompare(b.paperTitle),
    );
    state.conferences = conferences;
    state.error = null;
  } catch (err) {
    state.error = err.message;
  }
  state.loaded = true;
  render();
}

async function toggleMilestone(plan, milestone, checkbox) {
  checkbox.disabled = true;
  try {
    const updated = await api.patch(`/plans/${plan._id}/milestones/${milestone.id}`, {
      done: checkbox.checked,
    });
    state.plans = state.plans.map((p) => (p._id === updated._id ? updated : p));
    render();
  } catch (err) {
    checkbox.checked = !checkbox.checked;
    checkbox.disabled = false;
    toast(err.message, 'error');
  }
}

async function remove(plan) {
  const confirmed = await confirmDialog({
    title: 'Delete this plan?',
    message: `"${plan.paperTitle}" and its milestones will be removed.`,
  });
  if (!confirmed) return;
  try {
    await api.del(`/plans/${plan._id}`);
    toast('Plan deleted', 'success');
    load();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function venueChip(role, conference) {
  return el(
    'span',
    { class: `venue-chip venue-chip--${role}` },
    icon(role === 'target' ? 'target' : 'link', { size: 14 }),
    el('span', { class: 'venue-chip__role' }, role === 'target' ? 'Target' : 'Backup'),
    conference ? `${conference.acronym} ${conference.year}` : 'Conference removed',
  );
}

function nextDeadlineBlock(conference) {
  if (!conference) return null;
  const next = nextDeadline(conference);
  if (next) {
    return el(
      'div',
      { class: 'plan-next' },
      el(
        'div',
        {},
        el('p', { class: 'plan-next__label' }, `${next.label} deadline`),
        el('p', { class: 'plan-next__date' }, `${formatDate(next.date, { aoe: true })} AoE`),
      ),
      countdownChip(next.date),
    );
  }
  const text = conference.startDate
    ? `No deadlines left · conference ${formatDateRange(conference.startDate, conference.endDate)}`
    : 'Deadlines TBD';
  return el('div', { class: 'plan-next plan-next--empty' }, el('p', { class: 'muted' }, text));
}

function milestoneItem(plan, milestone) {
  const due = new Date(milestone.dueDate);
  const overdue = !milestone.done && due < new Date();
  const checkbox = el('input', { type: 'checkbox', checked: milestone.done });
  checkbox.addEventListener('change', () => toggleMilestone(plan, milestone, checkbox));

  return el(
    'li',
    { class: ['milestone', milestone.done && 'is-done'] },
    el('label', { class: 'check milestone__check' }, checkbox, el('span', {}, milestone.label)),
    el('span', { class: 'milestone__due muted' }, formatDate(due, { aoe: true, withYear: false })),
    milestone.done
      ? null
      : overdue
        ? el('span', { class: 'badge badge--danger' }, 'Overdue')
        : countdownChip(due),
  );
}

function planCard(plan) {
  const status = STATUS[plan.status] ?? STATUS.drafting;
  const total = plan.milestones.length;
  const done = plan.milestones.filter((m) => m.done).length;

  return el(
    'article',
    { class: 'card plan-card' },
    el(
      'div',
      { class: 'card__header' },
      el('h3', { class: 'card__title' }, plan.paperTitle),
      el('span', { class: `badge ${status.badge}` }, status.label),
    ),
    el(
      'div',
      { class: 'chip-list' },
      venueChip('target', plan.target),
      plan.backupConferenceId && venueChip('backup', plan.backup),
    ),
    nextDeadlineBlock(plan.target),
    total > 0 &&
      el(
        'div',
        { class: 'plan-milestones' },
        el(
          'div',
          { class: 'plan-milestones__header' },
          el('span', { class: 'label' }, 'Milestones'),
          el('span', { class: 'muted' }, `${done}/${total} done`),
        ),
        el(
          'div',
          {
            class: 'progress',
            role: 'progressbar',
            'aria-valuemin': '0',
            'aria-valuemax': String(total),
            'aria-valuenow': String(done),
            'aria-label': 'Milestones done',
          },
          el('div', { class: 'progress__bar', style: { width: `${(done / total) * 100}%` } }),
        ),
        el(
          'ul',
          { class: 'milestone-list' },
          plan.milestones.map((m) => milestoneItem(plan, m)),
        ),
      ),
    plan.notes && el('p', { class: 'plan-card__notes muted' }, plan.notes),
    el(
      'div',
      { class: 'card__actions' },
      el(
        'button',
        {
          class: 'btn btn--ghost btn--sm',
          type: 'button',
          on: { click: () => form.openEdit(plan) },
        },
        icon('edit', { size: 16 }),
        'Edit',
      ),
      el(
        'button',
        {
          class: 'btn btn--danger-ghost btn--sm',
          type: 'button',
          on: { click: () => remove(plan) },
        },
        icon('trash', { size: 16 }),
        'Delete',
      ),
    ),
  );
}

function render() {
  if (!state.loaded) {
    root.replaceChildren(skeleton(3, 'card'));
    return;
  }
  if (state.error) {
    root.replaceChildren(errorState(state.error, load));
    return;
  }
  if (state.plans.length === 0) {
    root.replaceChildren(
      emptyState({
        iconName: 'target',
        title: 'No submission plans yet',
        text: 'Pick a target venue and a backup, add your milestones, and watch the countdowns.',
        actionLabel: 'Create your first plan',
        onAction: () => form.openCreate(),
      }),
    );
    return;
  }
  root.replaceChildren(el('div', { class: 'plan-grid' }, state.plans.map(planCard)));
}

qs('#add-plan').addEventListener('click', () => form.openCreate());

render();
startCountdownTicker();
await load();

// "Plan for this venue" on the conferences page links here with ?target=<id>.
const targetId = new URLSearchParams(window.location.search).get('target');
if (targetId) {
  history.replaceState(null, '', window.location.pathname);
  if (state.conferences.some((conf) => conf._id === targetId)) form.openCreate({ targetId });
}
