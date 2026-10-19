import { el } from '../shared/dom.js';

// Page buttons either side of the current one before the rest collapse into "…".
const WINDOW = 1;

// Splits an already-loaded list into pages. Lists the page owns (a review's papers, the user's
// reviews) arrive in one request, so paging them is about keeping the page light, not the network.
export function pageOf(items, page, size) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pages,
    offset: (current - 1) * size,
  };
}

// ‹ 1 … 4 [5] 6 … 12 ›: first, last, and WINDOW pages around the current one. Nothing when
// there is only one page. onPage(n) is called with the page to show.
export function pager({ page, pages, onPage, label = 'Pages' }) {
  if (pages <= 1) return null;
  const shown = [...new Set([1, pages])];
  for (let n = page - WINDOW; n <= page + WINDOW; n++) {
    if (n > 1 && n < pages) shown.push(n);
  }
  shown.sort((a, b) => a - b);

  const button = (text, target, attrs = {}) =>
    el(
      'button',
      { class: 'pager__button', type: 'button', ...attrs, on: { click: () => onPage(target) } },
      text,
    );
  const numbers = shown.flatMap((n, i) => [
    i > 0 && n - shown[i - 1] > 1 && el('li', { class: 'pager__gap', 'aria-hidden': 'true' }, '…'),
    el(
      'li',
      {},
      button(String(n), n, {
        'aria-label': `Page ${n}`,
        'aria-current': n === page ? 'page' : undefined,
      }),
    ),
  ]);

  return el(
    'nav',
    { class: 'pager', 'aria-label': label },
    button('‹', page - 1, { 'aria-label': 'Previous page', disabled: page <= 1 }),
    el('ol', { class: 'pager__pages' }, numbers),
    button('›', page + 1, { 'aria-label': 'Next page', disabled: page >= pages }),
  );
}
