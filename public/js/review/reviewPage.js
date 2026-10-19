import { ApiError, api } from '../shared/api.js';
import { el, qs, qsa } from '../shared/dom.js';
import { confirmDialog, errorState, skeleton, toast } from '../shared/ui.js';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, PaperSearch } from './paperSearch.js';
import { countsOf } from './progress.js';
import { ReadingList } from './readingList.js';
import { reviewEditor } from './reviewEditor.js';
import { reviewHeader } from './reviewHeader.js';
import { loadVocabulary } from './vocabularyClient.js';

const TABS = ['list', 'find'];
const SEARCH_PARAMS = ['q', 'area', 'yearFrom', 'yearTo', 'page', 'limit'];
// Defaults are left out of the URL to keep links short.
const DEFAULTS = { page: 1, limit: DEFAULT_PAGE_SIZE };

const params = new URLSearchParams(window.location.search);
const reviewId = params.get('id');

const state = {
  review: null,
  entries: [],
  loaded: false,
  error: null,
  editing: false,
  tab: TABS.includes(params.get('tab')) ? params.get('tab') : 'list',
};

const headerRoot = qs('#review-root');
const body = qs('#review-body');
const tabs = qsa('[role="tab"]', body);
const panels = { list: qs('#panel-list'), find: qs('#panel-find') };
let readingList;
let paperSearch;

// ---------- URL: the open tab and the search live in the address, so links and Back work ----------

function syncUrl(query) {
  const next = new URLSearchParams({ id: reviewId, tab: state.tab });
  if (state.tab === 'find' && query) {
    for (const key of SEARCH_PARAMS) {
      const value = query[key];
      if (value !== undefined && value !== '' && value !== DEFAULTS[key]) {
        next.set(key, String(value));
      }
    }
  }
  history.replaceState(null, '', `?${next}`);
}

// The search in the URL if there is one, else the review's own keywords and area.
function initialQuery(review) {
  if (SEARCH_PARAMS.some((key) => params.has(key))) {
    const number = (key) => (params.get(key) ? Number(params.get(key)) : undefined);
    return {
      q: params.get('q') ?? '',
      area: params.get('area') ?? '',
      yearFrom: number('yearFrom'),
      yearTo: number('yearTo'),
      page: number('page') ?? 1,
      limit: PAGE_SIZES.includes(number('limit')) ? number('limit') : DEFAULT_PAGE_SIZE,
    };
  }
  return { q: review.keywords.join(' ') || review.title, area: review.area ?? '' };
}

// ---------- Tabs (arrow keys move between them, as in any tab list) ----------

function selectTab(tab, { focus = false } = {}) {
  state.tab = tab;
  for (const button of tabs) {
    const selected = button.dataset.tab === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  }
  for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== tab;
  if (tab === 'find') paperSearch.start();
  syncUrl(paperSearch.query);
}

for (const button of tabs) {
  button.addEventListener('click', () => selectTab(button.dataset.tab));
  button.addEventListener('keydown', (event) => {
    const i = TABS.indexOf(button.dataset.tab);
    const target = {
      ArrowRight: TABS[(i + 1) % TABS.length],
      ArrowLeft: TABS[(i - 1 + TABS.length) % TABS.length],
      Home: TABS[0],
      End: TABS.at(-1),
    }[event.key];
    if (target) {
      event.preventDefault();
      selectTab(target, { focus: true });
    }
  });
}

// ---------- Entries: every change is one request, then the page updates locally ----------

const savedPaperIds = () => new Set(state.entries.map((entry) => entry.paperId));

function entriesChanged() {
  renderHeader();
  qs('#list-count').textContent = String(state.entries.length);
  paperSearch.refresh();
}

async function addPaper(paper) {
  try {
    const entry = await api.post(`/reviews/${reviewId}/entries`, { paperId: paper._id });
    state.entries.unshift(entry);
    readingList.render(state.entries);
    entriesChanged();
    toast('Added to your reading list', 'success');
  } catch (err) {
    toast(
      err instanceof ApiError && err.status === 409 ? 'Already in this review' : err.message,
      err.status === 409 ? 'info' : 'error',
    );
  }
}

// Optimistic: the change shows at once and is rolled back if the save fails.
async function updateEntry(entry, fields) {
  const before = { ...entry };
  Object.assign(entry, fields);
  readingList.changed(fields);
  renderHeader();
  try {
    Object.assign(entry, await api.put(`/entries/${entry._id}`, fields));
    return true;
  } catch (err) {
    Object.assign(entry, before);
    readingList.render(state.entries);
    renderHeader();
    toast(err.message, 'error');
    return false;
  }
}

async function removeEntry(entry) {
  const confirmed = await confirmDialog({
    title: 'Remove this paper?',
    message: `"${entry.paper.title}" and your notes on it will be removed from this review.`,
    confirmText: 'Remove',
  });
  if (!confirmed) return;
  try {
    await api.del(`/entries/${entry._id}`);
    state.entries = state.entries.filter((e) => e._id !== entry._id);
    readingList.render(state.entries);
    entriesChanged();
    toast('Paper removed', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ---------- Review: edit in place, delete goes back to the list ----------

async function deleteReview() {
  const papers = state.entries.length;
  const confirmed = await confirmDialog({
    title: 'Delete this review?',
    message: papers
      ? `"${state.review.title}" will be deleted, along with its ${papers} saved paper${papers === 1 ? '' : 's'}.`
      : `"${state.review.title}" will be deleted.`,
  });
  if (!confirmed) return;
  try {
    await api.del(`/reviews/${reviewId}`);
    window.location.href = 'reviews.html';
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderHeader() {
  if (state.editing) {
    headerRoot.replaceChildren(
      reviewEditor(state.review, {
        loadVocabulary,
        onSaved: (saved) => {
          state.review = { ...state.review, ...saved };
          state.editing = false;
          document.title = `${state.review.title} · Paperscape`;
          renderHeader();
        },
        onCancel: () => {
          state.editing = false;
          renderHeader();
        },
      }),
    );
    return;
  }
  headerRoot.replaceChildren(
    reviewHeader(state.review, countsOf(state.entries), {
      onEdit: () => {
        state.editing = true;
        renderHeader();
      },
      onDelete: deleteReview,
    }),
  );
}

function notFound() {
  return el(
    'div',
    { class: 'empty-state', role: 'alert' },
    el('h1', { class: 'empty-state__title' }, 'Review not found'),
    el(
      'p',
      { class: 'muted' },
      'It may have been deleted, or it was created in another browser (reviews are private to the browser that made them).',
    ),
    el('a', { class: 'btn btn--primary', href: 'reviews.html' }, 'Back to your reviews'),
  );
}

function render() {
  if (!state.loaded) {
    headerRoot.replaceChildren(skeleton(1, 'card'));
    return;
  }
  if (state.error) {
    body.hidden = true;
    const missing = state.error instanceof ApiError && state.error.status === 404;
    headerRoot.replaceChildren(missing ? notFound() : errorState(state.error.message, load));
    return;
  }
  renderHeader();
  body.hidden = false;
  qs('#list-count').textContent = String(state.entries.length);
  readingList.render(state.entries);
  selectTab(state.tab);
}

// One request loads the review and all its saved papers.
async function load() {
  state.loaded = false;
  render();
  try {
    if (!reviewId) throw new ApiError(404, 'Review not found');
    const { entries, ...review } = await api.get(`/reviews/${reviewId}`, { include: 'entries' });
    state.review = review;
    state.entries = entries;
    state.error = null;
    document.title = `${review.title} · Paperscape`;
    readingList ??= new ReadingList(panels.list, {
      onUpdate: updateEntry,
      onRemove: removeEntry,
      onFindPapers: () => selectTab('find', { focus: true }),
    });
    paperSearch ??= new PaperSearch(panels.find, {
      query: initialQuery(review),
      isSaved: (paperId) => savedPaperIds().has(paperId),
      onAdd: addPaper,
      onQueryChange: syncUrl,
    });
  } catch (err) {
    state.error = err;
  }
  state.loaded = true;
  render();
}

load();
