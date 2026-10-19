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
  toast,
} from '../shared/ui.js';
import { backupLink, paperUrl, reportLinkButton } from './linkReport.js';
import { pager } from './pager.js';
import { paperCardsSkeleton } from './skeletons.js';

const DEBOUNCE_MS = 300;
export const PAGE_SIZES = [5, 10, 50];
export const DEFAULT_PAGE_SIZE = 10;
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
    this.citingChip = el('div', { class: 'search-citing' });
    root.replaceChildren(
      this.citingChip,
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

  // "Papers that cite X": clears the sentence and lists library papers whose references include X.
  findCiting(paperId, title) {
    this.#clearForm();
    this.#started = true;
    this.#query = { page: 1, limit: this.#query.limit, cites: paperId, citesTitle: title };
    this.#run();
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

  // Empties every blank. (form.reset() would bring back the review's starting keywords.)
  #clearForm() {
    for (const name of ['q', 'area', 'yearFrom', 'yearTo']) this.form.elements[name].value = '';
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
      cites: this.#query.cites,
      citesTitle: this.#query.citesTitle,
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
    const { citesTitle, ...query } = this.#query;
    this.#onQueryChange(query);
    this.#renderCitingChip(citesTitle);
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
      // A page past the end (old link, or results changed): show the last real page instead.
      if (result.total > 0 && query.page > result.pages) {
        this.#query = { ...this.#query, page: result.pages };
        this.#run();
        return;
      }
      this.#view = { status: 'done', result, error: null };
      // Opened from a link: the reply names the paper being cited.
      if (result.citing && !this.#query.citesTitle) {
        this.#query.citesTitle = result.citing.title;
        this.#renderCitingChip(result.citing.title);
      }
    } catch (err) {
      if (requestId !== this.#latest) return;
      // A "papers that cite" link to a paper that is gone (or a garbled id): drop the filter.
      if (query.cites && err instanceof ApiError && (err.status === 404 || err.details?.cites)) {
        toast(
          'That paper is no longer in the library, so the citation filter was removed.',
          'warning',
        );
        this.#query = { ...this.#query, cites: undefined, citesTitle: undefined };
        this.#run();
        return;
      }
      if (err instanceof ApiError && err.details) showFieldErrors(this.form, err.details);
      this.#view = { status: 'error', result: null, error: err };
    }
    this.#render();
  }

  #renderCitingChip(title) {
    this.citingChip.replaceChildren(
      ...(this.#query.cites
        ? [
            el('span', { class: 'muted' }, 'Papers that cite'),
            el('strong', { class: 'search-citing__title' }, title ?? 'this paper'),
            el(
              'button',
              {
                class: 'chip',
                type: 'button',
                'aria-label': 'Stop filtering by citations',
                on: {
                  click: () => {
                    this.#query = { ...this.#readForm(), cites: undefined, citesTitle: undefined };
                    this.#run();
                  },
                },
              },
              icon('x', { size: 14 }),
              'Clear',
            ),
          ]
        : []),
    );
  }

  #render() {
    const { status, result, error } = this.#view;
    if (status === 'loading') {
      this.status.textContent = 'Searching…';
      this.results.replaceChildren(paperCardsSkeleton(Math.min(this.#query.limit, 6)));
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
    const nav = pager({
      page,
      pages,
      label: 'Search results pages',
      onPage: (n) => this.#goToPage(n),
    });
    this.results.replaceChildren(
      el(
        'ul',
        { class: 'paper-grid' },
        items.map((paper) => this.#paperCard(paper)),
      ),
      // replaceChildren() would print a missing pager as text, so it is left out instead.
      ...(nav ? [nav] : []),
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
              // Clearing also drops a "papers that cite" filter, so the user is never stuck.
              this.#clearForm();
              this.#query = { ...this.#query, cites: undefined, citesTitle: undefined };
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
              href: paperUrl(paper),
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
        el('div', { class: 'paper-dialog__help' }, backupLink(paper), reportLinkButton(paper)),
        el(
          'div',
          { class: 'dialog__actions' },
          el(
            'a',
            {
              class: 'btn btn--ghost btn--sm',
              href: paperUrl(paper),
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
}
