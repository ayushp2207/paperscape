import { areaById } from '../shared/areas.js';
import { el } from '../shared/dom.js';
import { relativeTime } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { PHASES, orbitBadge, phaseIndex, phaseTrack } from './progress.js';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function countsLine({ read, reading, total, ...rest }) {
  if (total === 0) return 'No papers yet';
  return [
    read && `${read} read`,
    reading && `${reading} reading`,
    rest['to-read'] && `${rest['to-read']} to read`,
  ]
    .filter(Boolean)
    .join(' · ');
}

// The main button is the review's next step ("Find papers", "Build threads"…), opening the
// review on the tab where that step happens. Saved but unread papers mean "start reading".
const START_READING = { action: 'Start reading', tab: 'list' };

function actions(review, { onEdit, onDelete }, href) {
  const phase = phaseIndex(review.counts);
  const next = phase === 0 && review.counts.total > 0 ? START_READING : PHASES[phase];
  return el(
    'div',
    { class: 'card__actions' },
    el(
      'a',
      {
        class: 'btn btn--primary btn--sm',
        href: `${href}&tab=${next.tab}`,
        'aria-label': `${next.action} in ${review.title}`,
      },
      next.action,
      el('span', { 'aria-hidden': 'true' }, '→'),
    ),
    el(
      'button',
      {
        class: 'icon-btn',
        type: 'button',
        'aria-label': `Edit ${review.title}`,
        title: 'Edit',
        on: { click: onEdit },
      },
      icon('edit', { size: 16 }),
    ),
    el(
      'button',
      {
        class: 'icon-btn review-card__delete',
        type: 'button',
        'aria-label': `Delete ${review.title}`,
        title: 'Delete',
        on: { click: onDelete },
      },
      icon('trash', { size: 16 }),
    ),
  );
}

// One review as a card. `preview: true` renders the composer's live preview: same look,
// no links or actions.
export function reviewCard(review, { preview = false, onEdit, onDelete } = {}) {
  const href = `review.html?id=${encodeURIComponent(review._id)}`;
  const area = review.area && areaById(review.area);
  return el(
    'article',
    {
      class: ['card', 'review-card', preview && 'review-card--preview', area && 'has-area'],
      dataset: { id: review._id },
      style: area ? { '--area': `var(--area-${area.id})` } : undefined,
    },
    el(
      'div',
      { class: 'review-card__top' },
      orbitBadge(review.counts),
      el(
        'div',
        { class: 'review-card__heading' },
        el(
          'p',
          { class: 'review-card__updated muted' },
          area && el('span', { class: 'badge badge--area' }, area.label),
          preview ? 'Preview' : `Updated ${relativeTime(review.lastActivityAt)}`,
        ),
        el(
          'h3',
          { class: 'card__title' },
          preview ? review.title : el('a', { href }, review.title),
        ),
        el('p', { class: 'review-card__counts muted' }, countsLine(review.counts)),
      ),
    ),
    el(
      'blockquote',
      { class: ['review-card__question', !review.question && 'is-placeholder'] },
      review.question || 'Your research question appears here.',
    ),
    review.keywords.length > 0 &&
      el(
        'ul',
        { class: 'chip-list review-card__keywords', 'aria-label': 'Keywords' },
        review.keywords.map((keyword) => el('li', { class: 'badge badge--outline' }, keyword)),
      ),
    phaseTrack(review.counts),
    el(
      'div',
      { class: 'review-card__footer' },
      el(
        'p',
        { class: 'card__meta' },
        el('span', {}, icon('thread', { size: 16 }), plural(review.threads.length, 'thread')),
      ),
      !preview && actions(review, { onEdit, onDelete }, href),
    ),
  );
}
