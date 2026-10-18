import { areaById } from '../shared/areas.js';
import { el } from '../shared/dom.js';
import { formatDate, formatDateRange } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { countdownChip } from './countdown.js';
import { DEADLINES, isUserCreated } from './deadlines.js';

export function areaBadge(areaId) {
  const area = areaById(areaId);
  return el(
    'span',
    { class: 'badge badge--area', style: { '--area': `var(--area-${areaId})` } },
    area?.label ?? areaId,
  );
}

export function locationText(conference) {
  const { location } = conference;
  if (!location) return 'Location TBD';
  return [location.city, location.country].filter(Boolean).join(', ');
}

export function extendedBadge(conference, key) {
  const original = conference.extensions?.[key];
  if (!original) return null;
  return el(
    'span',
    {
      class: 'badge badge--warning',
      title: `Originally ${formatDate(original, { aoe: true })} AoE`,
    },
    'Extended',
  );
}

function deadlineRow({ key, label }, conference) {
  const date = conference.deadlines?.[key];
  return el(
    'li',
    { class: 'deadline-row' },
    el('span', { class: 'deadline-row__label' }, label, extendedBadge(conference, key)),
    date
      ? el('span', { class: 'deadline-row__date' }, formatDate(date, { aoe: true }))
      : el('span', { class: 'badge badge--outline' }, 'TBD'),
    date ? countdownChip(date) : null,
  );
}

// Renders the side panel (bottom sheet on mobile) for one conference.
export function renderDetail(
  panel,
  conference,
  { onClose, onEdit, onDelete, onDuplicate, onReport },
) {
  const own = isUserCreated(conference);
  const { location } = conference;

  panel.replaceChildren(
    el(
      'div',
      { class: 'conf-detail__header' },
      el(
        'div',
        {},
        el('p', { class: 'conf-detail__eyebrow' }, own ? 'Your conference' : 'Seeded conference'),
        el('h2', { class: 'conf-detail__title' }, `${conference.acronym} ${conference.year}`),
        el('p', { class: 'muted' }, conference.name),
      ),
      el(
        'button',
        {
          class: 'icon-btn',
          type: 'button',
          'aria-label': 'Close details',
          on: { click: onClose },
        },
        icon('x'),
      ),
    ),
    el('div', { class: 'chip-list' }, conference.areas.map(areaBadge)),
    el(
      'dl',
      { class: 'conf-detail__facts' },
      el('dt', {}, icon('calendar', { size: 16 }), 'When'),
      el(
        'dd',
        {},
        conference.startDate
          ? formatDateRange(conference.startDate, conference.endDate)
          : 'Dates TBD',
      ),
      el('dt', {}, icon('mapPin', { size: 16 }), 'Where'),
      el(
        'dd',
        {},
        location?.venue
          ? `${location.venue}, ${locationText(conference)}`
          : locationText(conference),
      ),
      conference.website && el('dt', {}, icon('globe', { size: 16 }), 'Website'),
      conference.website &&
        el(
          'dd',
          {},
          el(
            'a',
            { href: conference.website, target: '_blank', rel: 'noopener noreferrer' },
            new URL(conference.website).hostname,
            icon('external', { size: 14 }),
          ),
        ),
    ),
    el('h3', { class: 'conf-detail__subtitle' }, 'Deadlines (AoE)'),
    el(
      'ul',
      { class: 'deadline-list' },
      DEADLINES.map((deadline) => deadlineRow(deadline, conference)),
    ),
    el(
      'p',
      { class: 'conf-detail__note muted' },
      own ? 'Your own entry.' : 'Dates are kept up to date automatically.',
      conference.website &&
        el(
          'button',
          { class: 'link-btn', type: 'button', on: { click: onReport } },
          'Report a broken link',
        ),
    ),
    el(
      'div',
      { class: 'conf-detail__actions' },
      el(
        'a',
        { class: 'btn btn--primary', href: `plans.html?target=${conference._id}` },
        icon('target'),
        'Plan for this venue',
      ),
      own
        ? [
            el(
              'button',
              { class: 'btn btn--ghost', type: 'button', on: { click: onEdit } },
              icon('edit'),
              'Edit',
            ),
            el(
              'button',
              { class: 'btn btn--danger-ghost', type: 'button', on: { click: onDelete } },
              icon('trash'),
              'Delete',
            ),
          ]
        : el(
            'button',
            {
              class: 'btn btn--ghost',
              type: 'button',
              title: 'Seeded conferences are read-only. Make your own editable copy.',
              on: { click: onDuplicate },
            },
            icon('plus'),
            'Duplicate to edit',
          ),
    ),
  );
}
