import { areaById } from '../shared/areas.js';
import { el } from '../shared/dom.js';
import { relativeTime } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { orbitBadge, phaseTrack } from './progress.js';

// The review page header: same language as the review cards (orbit, area, quote, phase),
// at page scale. Edit and Delete are handled by the page.
export function reviewHeader(review, counts, { onEdit, onDelete }) {
  const area = review.area && areaById(review.area);
  return el(
    'header',
    {
      class: ['review-header', area && 'has-area'],
      style: area ? { '--area': `var(--area-${area.id})` } : undefined,
    },
    el(
      'div',
      { class: 'review-header__top' },
      orbitBadge(counts),
      el(
        'div',
        { class: 'review-header__heading' },
        el(
          'p',
          { class: 'review-card__updated muted' },
          area && el('span', { class: 'badge badge--area' }, area.label),
          `Updated ${relativeTime(review.updatedAt)}`,
        ),
        el('h1', { class: 'review-header__title' }, review.title),
      ),
      el(
        'div',
        { class: 'review-header__actions' },
        el(
          'button',
          {
            class: 'btn btn--ghost btn--sm',
            type: 'button',
            on: { click: onEdit },
          },
          icon('edit', { size: 16 }),
          'Edit',
        ),
        el(
          'button',
          {
            class: 'icon-btn review-card__delete',
            type: 'button',
            'aria-label': `Delete ${review.title}`,
            title: 'Delete review',
            on: { click: onDelete },
          },
          icon('trash', { size: 16 }),
        ),
      ),
    ),
    el('blockquote', { class: 'review-card__question review-header__question' }, review.question),
    review.keywords.length > 0 &&
      el(
        'ul',
        { class: 'chip-list review-card__keywords', 'aria-label': 'Keywords' },
        review.keywords.map((keyword) => el('li', { class: 'badge badge--outline' }, keyword)),
      ),
    phaseTrack(counts),
  );
}
