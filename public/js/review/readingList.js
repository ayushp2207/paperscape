import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { entryCard } from './entryCard.js';
import { pageOf, pager } from './pager.js';
import { STATUSES } from './vocab.js';

const PAGE_SIZE = 10;

const SORTS = [
  { id: 'added', label: 'Recently added', compare: () => 0 },
  { id: 'relevance', label: 'Most relevant', compare: (a, b) => b.relevance - a.relevance },
  { id: 'year', label: 'Newest', compare: (a, b) => b.paper.year - a.paper.year },
  {
    id: 'cited',
    label: 'Most cited',
    compare: (a, b) => b.paper.citedByCount - a.paper.citedByCount,
  },
];

// The "Reading list" tab: status filter chips, a sort, and the numbered entries, PAGE_SIZE at a
// time (all entries arrive with the review, so paging keeps the page light, not the network).
// The page owns the entries; this class owns how they are filtered, sorted and drawn.
// Entries are only re-drawn when a change moves them (a filter or sort they no longer fit),
// so typing in one entry's notes is never interrupted by a save elsewhere.
export class ReadingList {
  #filter = 'all';
  #sort = 'added';
  #page = 1;
  #entries = [];
  #handlers;

  constructor(root, handlers) {
    this.#handlers = handlers;
    this.toolbar = el('div', { class: 'list-toolbar' });
    this.list = el('ol', { class: 'entry-list' });
    this.pages = el('div');
    root.replaceChildren(this.toolbar, this.list, this.pages);
  }

  render(entries) {
    this.#entries = entries;
    this.#renderToolbar();
    this.#renderList();
  }

  // Scrolls to one entry and briefly highlights it (opened from threads, citations or the map).
  reveal(entryId) {
    const entry = this.#entries.find((e) => e._id === entryId);
    if (entry && this.#filter !== 'all' && entry.status !== this.#filter) this.#filter = 'all';
    const position = this.#visible().findIndex((e) => e._id === entryId);
    if (position >= 0) this.#page = Math.floor(position / PAGE_SIZE) + 1;
    this.render(this.#entries);
    const node = this.list.querySelector(`#entry-${CSS.escape(entryId)}`);
    if (!node) return;
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    node.querySelector('.entry__title a')?.focus({ preventScroll: true });
    node.classList.remove('is-revealed');
    requestAnimationFrame(() => node.classList.add('is-revealed'));
  }

  // After a save: re-draw the list only if the change affects its filter or order.
  changed(fields) {
    this.#renderToolbar();
    const moves =
      ('status' in fields && this.#filter !== 'all') ||
      ('relevance' in fields && this.#sort === 'relevance');
    if (moves || 'findings' in fields) this.#renderList();
  }

  #visible() {
    const sort = SORTS.find((s) => s.id === this.#sort);
    return this.#entries
      .filter((entry) => this.#filter === 'all' || entry.status === this.#filter)
      .sort(sort.compare);
  }

  #renderToolbar() {
    const count = (id) =>
      id === 'all' ? this.#entries.length : this.#entries.filter((e) => e.status === id).length;
    const chip = (id, label) =>
      el(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(this.#filter === id),
          on: {
            click: () => {
              this.#filter = id;
              this.#page = 1;
              this.render(this.#entries);
            },
          },
        },
        label,
        el('span', { class: 'chip__count mono' }, String(count(id))),
      );

    this.toolbar.replaceChildren(
      el(
        'div',
        { class: 'chip-list', role: 'group', 'aria-label': 'Filter by reading status' },
        chip('all', 'All'),
        STATUSES.map((status) => chip(status.id, status.label)),
      ),
      el(
        'label',
        { class: 'list-toolbar__sort' },
        el('span', { class: 'muted' }, 'Sort'),
        el(
          'select',
          {
            class: 'select select--sm',
            on: {
              change: (event) => {
                this.#sort = event.target.value;
                this.#page = 1;
                this.#renderList();
              },
            },
          },
          SORTS.map((s) => el('option', { value: s.id, selected: s.id === this.#sort }, s.label)),
        ),
      ),
    );
    this.toolbar.hidden = this.#entries.length === 0;
  }

  #renderList() {
    this.pages.replaceChildren();
    if (this.#entries.length === 0) {
      this.list.replaceChildren(this.#emptyList());
      return;
    }
    const visible = this.#visible();
    if (visible.length === 0) {
      const label = STATUSES.find((s) => s.id === this.#filter).label;
      this.list.replaceChildren(
        el('li', { class: 'entry-list__none muted' }, `No papers marked “${label}”.`),
      );
      return;
    }
    // After a removal the last page can empty out; pageOf() clamps back to a real page.
    const { items, page, pages, offset } = pageOf(visible, this.#page, PAGE_SIZE);
    this.#page = page;
    const nav = pager({
      page,
      pages,
      label: 'Reading list pages',
      onPage: (n) => {
        this.#page = n;
        this.#renderList();
        this.toolbar.scrollIntoView({ block: 'start', behavior: 'smooth' });
      },
    });
    if (nav) this.pages.replaceChildren(nav);
    this.list.start = offset + 1;
    this.list.replaceChildren(
      ...items.map((entry, i) =>
        entryCard(entry, offset + i + 1, {
          links: this.#handlers.linksOf(entry._id),
          onUpdate: (fields) => this.#handlers.onUpdate(entry, fields),
          onRemove: () => this.#handlers.onRemove(entry),
        }),
      ),
    );
  }

  #emptyList() {
    return el(
      'li',
      { class: 'empty-state' },
      icon('book', { size: 32, className: 'empty-state__icon' }),
      el('h3', { class: 'empty-state__title' }, 'No papers yet'),
      el(
        'p',
        { class: 'muted' },
        'Search the library for papers that help answer your question, and add them here.',
      ),
      el(
        'button',
        { class: 'btn btn--primary', type: 'button', on: { click: this.#handlers.onFindPapers } },
        icon('search', { size: 16 }),
        'Find papers',
      ),
    );
  }
}
