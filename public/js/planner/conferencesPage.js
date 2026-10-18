import { api } from '../shared/api.js';
import { el, qs, qsa } from '../shared/dom.js';
import { formatDate, formatDateRange } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { confirmDialog, emptyState, errorState, skeleton, toast } from '../shared/ui.js';
import { areaBadge, locationText, renderDetail } from './conferenceDetail.js';
import { initConferenceForm } from './conferenceForm.js';
import { countdownChip, startCountdownTicker } from './countdown.js';
import { hasAnyDate, isPastConference, isUserCreated, nextDeadline } from './deadlines.js';
import { initFilters, toQueryParams } from './filters.js';
import { renderMap } from './map.js';

const VIEWS = ['map', 'timeline', 'list'];

const state = {
  conferences: [],
  view: 'map',
  selectedId: null,
  loaded: false,
  loading: true,
  error: null,
};

const viewPanel = qs('#view-panel');
const detailPanel = qs('#conference-detail');
const summary = qs('#conference-summary');

const form = initConferenceForm(qs('#conference-dialog'), {
  onSaved: (conference) => {
    state.selectedId = conference._id;
    load();
  },
});

const filters = initFilters(qs('#conference-filters'), { onChange: () => load() });

const selected = () => state.conferences.find((conf) => conf._id === state.selectedId) ?? null;

async function load() {
  state.loading = true;
  state.error = null;
  render();
  try {
    state.conferences = await api.get('/conferences', toQueryParams(filters.filters));
    if (!selected()) state.selectedId = null;
  } catch (err) {
    state.error = err.message;
  } finally {
    state.loading = false;
    state.loaded = true;
    render();
  }
}

function select(id) {
  state.selectedId = state.selectedId === id ? null : id;
  render();
}

async function remove(conference) {
  const confirmed = await confirmDialog({
    title: `Delete ${conference.acronym} ${conference.year}?`,
    message: 'This removes your conference entry. It cannot be undone.',
  });
  if (!confirmed) return;
  try {
    await api.del(`/conferences/${conference._id}`);
    toast('Conference deleted', 'success');
    state.selectedId = null;
    load();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function duplicateAndEdit(conference) {
  try {
    const copy = await api.post(`/conferences/${conference._id}/duplicate`);
    toast('Copied to your conferences. Edit it below.', 'success');
    state.selectedId = copy._id;
    await load();
    form.openEdit(copy);
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Next thing to happen: an upcoming deadline, else the conference itself, else why there is none.
function cardFooter(conference) {
  const next = nextDeadline(conference);
  if (next) {
    const label = next.key === 'notification' ? 'Notification' : `${next.label} deadline`;
    return [
      el('span', { class: 'muted' }, `${label} · ${formatDate(next.date, { aoe: true })}`),
      countdownChip(next.date),
    ];
  }
  const startsInFuture = conference.startDate && new Date(conference.startDate) > new Date();
  if (startsInFuture) {
    return [
      el(
        'span',
        { class: 'muted' },
        `Conference · ${formatDateRange(conference.startDate, conference.endDate)}`,
      ),
      countdownChip(conference.startDate),
    ];
  }
  const text = !hasAnyDate(conference)
    ? 'Deadlines TBD'
    : isPastConference(conference)
      ? `Took place ${formatDateRange(conference.startDate, conference.endDate)}`
      : 'Happening now';
  return el('span', { class: 'muted' }, text);
}

function conferenceCard(conference) {
  const isSelected = conference._id === state.selectedId;

  return el(
    'article',
    { class: ['card', 'card--interactive', 'conf-card', isSelected && 'is-selected'] },
    el(
      'div',
      { class: 'card__header' },
      el(
        'h3',
        { class: 'card__title' },
        el(
          'button',
          {
            class: 'conf-card__select',
            type: 'button',
            'aria-pressed': String(isSelected),
            on: { click: () => select(conference._id) },
          },
          `${conference.acronym} ${conference.year}`,
        ),
      ),
      isUserCreated(conference)
        ? el('span', { class: 'badge badge--accent' }, 'Yours')
        : !hasAnyDate(conference) && el('span', { class: 'badge badge--outline' }, 'Dates TBD'),
    ),
    el('p', { class: 'conf-card__name muted' }, conference.name),
    el(
      'p',
      { class: 'card__meta' },
      el('span', {}, icon('mapPin', { size: 14 }), locationText(conference)),
    ),
    el('div', { class: 'chip-list' }, conference.areas.map(areaBadge)),
    el('div', { class: 'conf-card__deadline' }, cardFooter(conference)),
  );
}

function renderList() {
  if (state.conferences.length === 0) {
    return filters.isActive()
      ? emptyState({
          iconName: 'search',
          title: 'No conferences match these filters',
          text: 'Conferences with TBD dates never match a month filter.',
          actionLabel: 'Clear filters',
          onAction: () => filters.reset(),
        })
      : emptyState({
          iconName: 'calendar',
          title: 'No conferences yet',
          text: 'Add the venues you are considering.',
          actionLabel: 'Add conference',
          onAction: () => form.openCreate(),
        });
  }
  return el('div', { class: 'conf-grid' }, state.conferences.map(conferenceCard));
}

// Placeholder until the timeline (A-7) lands.
function renderComingSoon() {
  return emptyState({
    iconName: 'calendar',
    title: 'Timeline coming soon',
    text: 'Use the Map or List view for now.',
  });
}

function showMap() {
  renderMap(viewPanel, state.conferences, { selectedId: state.selectedId, onSelect: select }).catch(
    (err) => viewPanel.replaceChildren(errorState(err.message, render)),
  );
}

function renderSummary() {
  if (state.loading || state.error) {
    summary.textContent = '';
    return;
  }
  const total = state.conferences.length;
  const tbd = state.conferences.filter((conf) => !hasAnyDate(conf)).length;
  summary.textContent = `${total} conference${total === 1 ? '' : 's'}${tbd ? ` · ${tbd} with dates TBD` : ''}`;
}

function renderDetailPanel() {
  const conference = selected();
  detailPanel.hidden = !conference;
  qs('.conf-layout').classList.toggle('has-detail', Boolean(conference));
  if (!conference) return;
  renderDetail(detailPanel, conference, {
    onClose: () => select(conference._id),
    onEdit: () => form.openEdit(conference),
    onDelete: () => remove(conference),
    onDuplicate: () => duplicateAndEdit(conference),
  });
}

function render() {
  qsa('[role="tab"]').forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab.dataset.view === state.view));
  });
  viewPanel.setAttribute('aria-labelledby', `tab-${state.view}`);

  // Skeleton only on first load; later reloads keep the current cards until data arrives.
  if (state.loading && !state.loaded) viewPanel.replaceChildren(skeleton(6, 'card'));
  else if (state.loading) return;
  else if (state.error) viewPanel.replaceChildren(errorState(state.error, load));
  else if (state.view === 'list' || state.conferences.length === 0) {
    viewPanel.replaceChildren(renderList());
  } else if (state.view === 'map') showMap();
  else viewPanel.replaceChildren(renderComingSoon());

  renderSummary();
  renderDetailPanel();
}

qsa('[role="tab"]').forEach((tab) => {
  tab.addEventListener('click', () => {
    if (!VIEWS.includes(tab.dataset.view)) return;
    state.view = tab.dataset.view;
    render();
  });
});

qs('#add-conference').addEventListener('click', () => form.openCreate());

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.selectedId && !document.querySelector('dialog[open]')) {
    select(state.selectedId);
  }
});

startCountdownTicker();
load();
