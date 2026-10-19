import { ApiError, api } from '../shared/api.js';
import { AREAS, areaById } from '../shared/areas.js';
import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import {
  clearFieldErrors,
  closeDialog,
  errorState,
  openDialog,
  showFieldErrors,
  skeleton,
} from '../shared/ui.js';

const DEBOUNCE_MS = 300;
export const PAGE_SIZES = [5, 10, 50];
export const DEFAULT_PAGE_SIZE = 10;
// Page buttons either side of the current one before the rest collapse into "…".
const PAGE_WINDOW = 1;
const MAX_AUTHORS = 3;
const YEARS = { min: 2000, max: 2030 };

const authorLine = (authors) =>
  authors.length > MAX_AUTHORS
    ? `${authors
        .slice(0, MAX_AUTHORS)
        .map((a) => a.name)
        .join(', ')} et al.`
    : authors.map((a) => a.name).join(', ');

const plural = (count, word) => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

// The "Find papers" tab. The search is a sentence ("Find papers about … in … from … to …")
// whose blanks are real form fields. Typing waits DEBOUNCE_MS before searching, only the latest
// response is shown, and each page is fetched only when asked for; pages already fetched are
// reused without another request.
export class PaperSearch {
  #query;
  #isSaved;
  #onAdd;
  #onQueryChange;
  #cache = new Map();
  #timer = null;
  #latest = 0;
  #started = false;
  #view = { status: 'idle', result: null, error: null };
  #dialog = null;
  #detailsPaper = null;

  constructor(root, { query, isSaved, onAdd, onQueryChange }) {
    this.#query = { page: 1, limit: DEFAULT_PAGE_SIZE, ...query };
    this.#isSaved = isSaved;
    this.#onAdd = onAdd;
    this.#onQueryChange = onQueryChange;

    this.form = this.#buildForm();
    this.status = el('p', { class: 'search-status', 'aria-live': 'polite' });
    this.pageSize = el(
      'select',
      {
        class: 'select select--sm',
        id: 'search-limit',
        on: {
          change: () => {
            this.#query = { ...this.#query, limit: Number(this.pageSize.value), page: 1 };
            this.#run();
          },
        },
      },
      PAGE_SIZES.map((size) =>
        el('option', { value: String(size), selected: size === this.#query.limit }, String(size)),
      ),
    );
    this.results = el('div', { class: 'search-results' });
    root.replaceChildren(
      this.form,
      el(
        'div',
        { class: 'search-toolbar' },
        this.status,
        el(
          'label',
          { class: 'list-toolbar__sort', for: 'search-limit' },
          el('span', { class: 'muted' }, 'Show'),
          this.pageSize,
          el('span', { class: 'muted' }, 'per page'),
        ),
      ),
      this.results,
    );
  }

  get query() {
    return { ...this.#query };
  }

  // Searches the first time the tab is shown, not when the page loads.
  start() {
    if (this.#started) return;
    this.#started = true;
    this.#run();
  }

  // Re-draws "Add" / "In this review" after the reading list changes; no request.
  refresh() {
    if (this.#view.status === 'done') this.#renderResults();
  }

  #buildForm() {
    const { q = '', area = '', yearFrom = '', yearTo = '' } = this.#query;
    const yearInput = (name, value, label) =>
      el('input', {
        class: 'search-sentence__input search-sentence__input--year',
        id: `search-${name}`,
        name,
        type: 'number',
        inputmode: 'numeric',
        min: String(YEARS.min),
        max: String(YEARS.max),
        placeholder: label,
        value: value ? String(value) : '',
        on: { input: () => this.#changed({ debounce: true }) },
      });

    return el(
      'form',
      {
        class: 'search-sentence',
        role: 'search',
        'aria-label': 'Find papers',
        novalidate: true,
        on: {
          submit: (event) => {
            event.preventDefault();
            this.#changed({ debounce: false });
          },
        },
      },
      el('label', { class: 'search-sentence__word', for: 'search-q' }, 'Find papers about'),
      el('input', {
        class: 'search-sentence__input search-sentence__input--topic',
        id: 'search-q',
        name: 'q',
        type: 'search',
        maxlength: '200',
        autocomplete: 'off',
        placeholder: 'any topic',
        value: q,
        on: { input: () => this.#changed({ debounce: true }) },
      }),
      el('label', { class: 'search-sentence__word', for: 'search-area' }, 'in'),
      el(
        'select',
        {
          class: 'search-sentence__input',
          id: 'search-area',
          name: 'area',
          on: { change: () => this.#changed({ debounce: false }) },
        },
        el('option', { value: '' }, 'any area'),
        AREAS.map((option) =>
          el('option', { value: option.id, selected: option.id === area }, option.label),
        ),
      ),
      el('label', { class: 'search-sentence__word', for: 'search-yearFrom' }, 'from'),
      yearInput('yearFrom', yearFrom, String(YEARS.min)),
      el('label', { class: 'search-sentence__word', for: 'search-yearTo' }, 'to'),
      yearInput('yearTo', yearTo, 'now'),
      el(
        'button',
        { class: 'btn btn--primary btn--sm search-sentence__submit', type: 'submit' },
        icon('search', { size: 16 }),
        'Search',
      ),
    );
  }

  #readForm() {
    const field = (name) => this.form.elements[name].value.trim();
    const year = (name) => (field(name) ? Number(field(name)) : undefined);
    return {
      q: field('q'),
      area: field('area'),
      yearFrom: year('yearFrom'),
      yearTo: year('yearTo'),
      page: 1,
      limit: this.#query.limit,
    };
  }

  #changed({ debounce }) {
    clearTimeout(this.#timer);
    const next = this.#readForm();
    // A single character matches almost everything: wait for a real word.
    if (next.q.length === 1) return;
    const go = () => {
      this.#query = next;
      this.#run();
    };
    if (debounce) this.#timer = setTimeout(go, DEBOUNCE_MS);
    else go();
  }

  #goToPage(page) {
    this.#query = { ...this.#query, page };
    this.#run();
    this.form.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  async #run() {
    const query = this.#query;
    this.#onQueryChange(query);
    const key = JSON.stringify(query);
    const requestId = ++this.#latest;
    clearFieldErrors(this.form);

    if (!this.#cache.has(key)) {
      this.#view = { ...this.#view, status: 'loading' };
      this.#render();
    }
    try {
      const result = this.#cache.get(key) ?? (await api.get('/papers', query));
      this.#cache.set(key, result);
      if (requestId !== this.#latest) return; // a newer search has started
      this.#view = { status: 'done', result, error: null };
    } catch (err) {
      if (requestId !== this.#latest) return;
      if (err instanceof ApiError && err.details) showFieldErrors(this.form, err.details);
      this.#view = { status: 'error', result: null, error: err };
    }
    this.#render();
  }

  #render() {
    const { status, result, error } = this.#view;
    if (status === 'loading') {
      this.status.textContent = 'Searching…';
      this.results.replaceChildren(skeleton(3, 'card'));
    } else if (status === 'error') {
      this.status.textContent = error.details ? 'Check the highlighted field.' : '';
      this.results.replaceChildren(
        ...(error.details ? [] : [errorState(error.message, () => this.#run())]),
      );
    } else if (status === 'done') {
      this.status.textContent = result.total
        ? `${plural(result.total, 'paper')} · page ${result.page} of ${result.pages}`
        : '';
      this.#renderResults();
    }
  }

  #renderResults() {
    const { items, page, pages, total } = this.#view.result;
    if (total === 0) {
      this.results.replaceChildren(this.#noResults());
      return;
    }
    // replaceChildren() would print a `false` pager as text, so it is left out instead.
    const pager = pages > 1 ? [this.#pager(page, pages)] : [];
    this.results.replaceChildren(
      el(
        'ul',
        { class: 'paper-grid' },
        items.map((paper) => this.#paperCard(paper)),
      ),
      ...pager,
    );
  }

  #noResults() {
    return el(
      'div',
      { class: 'empty-state' },
      icon('search', { size: 32, className: 'empty-state__icon' }),
      el('h3', { class: 'empty-state__title' }, 'No papers match'),
      el('p', { class: 'muted' }, 'Try fewer words, another area or a wider year range.'),
      el(
        'button',
        {
          class: 'btn btn--ghost',
          type: 'button',
          on: {
            click: () => {
              this.form.reset();
              this.#changed({ debounce: false });
            },
          },
        },
        'Clear the search',
      ),
    );
  }

  // "Add to review", or a check once the paper is saved. Used on cards and in the details popup.
  #saveControl(paper) {
    if (this.#isSaved(paper._id)) {
      return el(
        'span',
        { class: 'paper-card__saved' },
        icon('check', { size: 16 }),
        'In this review',
      );
    }
    return el(
      'button',
      {
        class: 'btn btn--primary btn--sm',
        type: 'button',
        'aria-label': `Add ${paper.title} to this review`,
        on: { click: (event) => this.#add(paper, event.currentTarget) },
      },
      icon('plus', { size: 16 }),
      'Add to review',
    );
  }

  #meta(paper) {
    const area = paper.areas[0] && areaById(paper.areas[0]);
    return el(
      'p',
      { class: 'paper-card__meta' },
      el('span', { class: 'mono' }, String(paper.year)),
      el('span', {}, plural(paper.citedByCount, 'citation')),
      area &&
        el(
          'span',
          { class: 'badge badge--area', style: { '--area': `var(--area-${area.id})` } },
          area.label,
        ),
    );
  }

  // Every card has the same shape: title (3 lines), authors (1 line), a 3-line abstract preview,
  // then the actions pinned to the bottom. The full details open in a popup.
  #paperCard(paper) {
    const open = () => this.#openDetails(paper);
    return el(
      'li',
      { class: 'card paper-card' },
      this.#meta(paper),
      el(
        'h3',
        { class: 'paper-card__title' },
        el(
          'button',
          { class: 'paper-card__open', type: 'button', on: { click: open } },
          paper.title,
        ),
      ),
      el(
        'p',
        { class: 'paper-card__authors muted' },
        authorLine(paper.authors),
        paper.venue && ` · ${paper.venue}`,
      ),
      el('p', { class: 'paper-card__snippet' }, paper.abstract),
      el(
        'div',
        { class: 'paper-card__footer' },
        el(
          'div',
          { class: 'paper-card__links' },
          el(
            'button',
            {
              class: 'btn btn--ghost btn--sm',
              type: 'button',
              'aria-label': `Read more about ${paper.title}`,
              on: { click: open },
            },
            'Read more',
          ),
          el(
            'a',
            {
              class: 'icon-btn icon-btn--sm',
              href: paper.doi ?? paper.openalexUrl,
              target: '_blank',
              rel: 'noopener noreferrer',
              'aria-label': `Open ${paper.title} (new tab)`,
              title: 'Open paper',
            },
            icon('external', { size: 16 }),
          ),
        ),
        this.#saveControl(paper),
      ),
    );
  }

  // One <dialog> reused for every paper; Esc or a click outside closes it.
  #openDetails(paper) {
    this.#detailsPaper = paper;
    this.#dialog ??= document.body.appendChild(
      el('dialog', { class: 'dialog paper-dialog', 'aria-labelledby': 'paper-dialog-title' }),
    );
    this.#renderDetails();
    openDialog(this.#dialog);
  }

  #renderDetails() {
    const paper = this.#detailsPaper;
    const authors = paper.authors
      .map((a) => (a.institution ? `${a.name} (${a.institution})` : a.name))
      .join(', ');
    this.#dialog.replaceChildren(
      el(
        'div',
        { class: 'dialog__body' },
        el(
          'div',
          { class: 'dialog__header' },
          this.#meta(paper),
          el(
            'button',
            {
              class: 'icon-btn',
              type: 'button',
              'aria-label': 'Close',
              on: { click: () => closeDialog(this.#dialog) },
            },
            icon('x', { size: 18 }),
          ),
        ),
        el('h2', { class: 'dialog__title', id: 'paper-dialog-title' }, paper.title),
        el(
          'p',
          { class: 'muted paper-dialog__authors' },
          authors,
          paper.venue && ` · ${paper.venue}`,
        ),
        el('p', { class: 'paper-dialog__abstract' }, paper.abstract),
        el(
          'div',
          { class: 'dialog__actions' },
          el(
            'a',
            {
              class: 'btn btn--ghost btn--sm',
              href: paper.doi ?? paper.openalexUrl,
              target: '_blank',
              rel: 'noopener noreferrer',
            },
            'Open paper',
            icon('external', { size: 14 }),
          ),
          this.#saveControl(paper),
        ),
      ),
    );
  }

  async #add(paper, button) {
    button.disabled = true;
    button.lastChild.textContent = 'Adding…';
    await this.#onAdd(paper);
    this.#renderResults();
    if (this.#dialog?.open && this.#detailsPaper === paper) this.#renderDetails();
  }

  // ‹ 1 … 4 [5] 6 … 12 ›: first, last, and PAGE_WINDOW pages either side of the current one.
  #pager(page, pages) {
    const shown = [...new Set([1, pages])];
    for (let n = page - PAGE_WINDOW; n <= page + PAGE_WINDOW; n++) {
      if (n > 1 && n < pages) shown.push(n);
    }
    shown.sort((a, b) => a - b);

    const button = (label, target, attrs = {}) =>
      el(
        'button',
        {
          class: 'pager__button',
          type: 'button',
          ...attrs,
          on: { click: () => this.#goToPage(target) },
        },
        label,
      );
    const numbers = shown.flatMap((n, i) => [
      i > 0 &&
        n - shown[i - 1] > 1 &&
        el('li', { class: 'pager__gap', 'aria-hidden': 'true' }, '…'),
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
      { class: 'pager', 'aria-label': 'Search results pages' },
      button('‹', page - 1, { 'aria-label': 'Previous page', disabled: page <= 1 }),
      el('ol', { class: 'pager__pages' }, numbers),
      button('›', page + 1, { 'aria-label': 'Next page', disabled: page >= pages }),
    );
  }
}
