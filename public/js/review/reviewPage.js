import { ApiError, api } from '../shared/api.js';
import { el, qs, qsa } from '../shared/dom.js';
import { confirmDialog, errorState, showFieldErrors, toast } from '../shared/ui.js';
import { CitationsView, citationIndex } from './citations.js';
import { OrbitMap } from './orbitMap.js';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, PaperSearch } from './paperSearch.js';
import { countsOf } from './progress.js';
import { ReadingList } from './readingList.js';
import { reviewEditor } from './reviewEditor.js';
import { reviewHeader } from './reviewHeader.js';
import { reviewPageSkeleton } from './skeletons.js';
import { ThreadsView } from './threads.js';
import { loadVocabulary } from './vocabularyClient.js';

const TABS = ['list', 'find', 'threads', 'citations', 'map'];
const SEARCH_PARAMS = ['q', 'area', 'yearFrom', 'yearTo', 'page', 'limit', 'cites'];
// Defaults are left out of the URL to keep links short.
const DEFAULTS = { page: 1, limit: DEFAULT_PAGE_SIZE };

const params = new URLSearchParams(window.location.search);
const reviewId = params.get('id');

const state = {
  review: null,
  entries: [],
  citations: { nodes: [], edges: [] },
  index: new Map(),
  loaded: false,
  error: null,
  editing: false,
  tab: TABS.includes(params.get('tab')) ? params.get('tab') : 'list',
};

const headerRoot = qs('#review-root');
const body = qs('#review-body');
const tabs = qsa('[role="tab"]', body);
const panels = Object.fromEntries(TABS.map((tab) => [tab, qs(`#panel-${tab}`)]));
let readingList;
let paperSearch;
let threadsView;
let citationsView;
let orbitMap;

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
    // Hand-edited or old links: anything that isn't a sensible whole number is ignored.
    const number = (key, min, max) => {
      const value = Number(params.get(key));
      return params.get(key) && Number.isInteger(value) && value >= min && value <= max
        ? value
        : undefined;
    };
    const limit = number('limit', 1, Infinity);
    return {
      q: params.get('q') ?? '',
      area: params.get('area') ?? '',
      yearFrom: number('yearFrom', 2000, 2030),
      yearTo: number('yearTo', 2000, 2030),
      page: number('page', 1, Infinity) ?? 1,
      limit: PAGE_SIZES.includes(limit) ? limit : DEFAULT_PAGE_SIZE,
      cites: params.get('cites') ?? undefined,
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
  renderActive();
  syncUrl(paperSearch.query);
}

// Threads, Citations and the Map are drawn from page state when shown, and again when the
// data behind them changes while they are open.
function renderActive() {
  if (state.tab === 'threads') threadsView.render(state.review.threads, state.entries);
  if (state.tab === 'citations') citationsView.render(state.citations);
  if (state.tab === 'map') {
    orbitMap.render({
      review: state.review,
      entries: state.entries,
      threads: state.review.threads,
      index: state.index,
    });
  }
}

function renderCounts() {
  qs('#list-count').textContent = String(state.entries.length);
  qs('#threads-count').textContent = String(state.review.threads.length);
  qs('#citations-count').textContent = String(state.citations.edges.length);
}

// From the citations, threads or map: show the paper in the reading list.
function openEntry(entryId) {
  selectTab('list');
  readingList.reveal(entryId);
}

// "Find papers that cite this": the search tab, filtered to library papers citing that paper.
function findCiting(entryId) {
  const entry = state.entries.find((e) => e._id === entryId);
  if (!entry) return;
  paperSearch.findCiting(entry.paperId, entry.paper.title);
  selectTab('find');
}

function showThreadOnMap(threadId) {
  orbitMap.showThread(threadId);
  selectTab('map');
}

// A 404 while saving means the review, paper or thread was changed or deleted elsewhere (another
// tab or window): say so and reload instead of showing stale data. Returns true if handled.
function reloadIfGone(err) {
  if (!(err instanceof ApiError) || err.status !== 404) return false;
  toast('This changed in another tab or window. Reloading the latest version…', 'warning');
  load();
  return true;
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

function setCitations(graph) {
  state.citations = graph;
  state.index = citationIndex(graph);
}

// Adding or removing a paper can add or remove citation links: one request refreshes them.
async function entriesChanged() {
  renderHeader();
  renderCounts();
  paperSearch.refresh();
  try {
    setCitations(await api.get(`/reviews/${reviewId}/citations`));
    readingList.render(state.entries);
    renderCounts();
    renderActive();
  } catch {
    // The links stay as they were; the next change or reload refreshes them.
  }
}

async function addPaper(paper) {
  try {
    const entry = await api.post(`/reviews/${reviewId}/entries`, { paperId: paper._id });
    state.entries.unshift(entry);
    readingList.render(state.entries);
    entriesChanged();
    toast('Added to your reading list', 'success');
  } catch (err) {
    if (reloadIfGone(err)) return;
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
  if (state.tab === 'map') renderActive();
  try {
    Object.assign(entry, await api.put(`/entries/${entry._id}`, fields));
    return true;
  } catch (err) {
    Object.assign(entry, before);
    if (reloadIfGone(err)) return false;
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
    // The server also took the paper out of every thread.
    for (const thread of state.review.threads) {
      thread.entryIds = thread.entryIds.filter((id) => id !== entry._id);
    }
    readingList.render(state.entries);
    entriesChanged();
    toast('Paper removed', 'success');
  } catch (err) {
    if (!reloadIfGone(err)) toast(err.message, 'error');
  }
}

// ---------- Threads ----------

function threadError(err, form) {
  if (reloadIfGone(err)) return;
  if (form && err instanceof ApiError && err.details) showFieldErrors(form, err.details);
  else toast(err.details?.entryIds ?? err.message, 'error');
}

async function createThread(form, fields) {
  try {
    const thread = await api.post(`/reviews/${reviewId}/threads`, fields);
    state.review.threads.push(thread);
    renderCounts();
    renderActive();
    toast('Thread created', 'success');
    return true;
  } catch (err) {
    threadError(err, form);
    return false;
  }
}

// Optimistic, like entries: reorders and renames show at once and roll back on failure.
async function updateThread(thread, fields, form) {
  const before = { ...thread, entryIds: [...thread.entryIds] };
  Object.assign(thread, fields);
  renderActive();
  try {
    Object.assign(thread, await api.put(`/reviews/${reviewId}/threads/${thread.id}`, fields));
    return true;
  } catch (err) {
    Object.assign(thread, before);
    renderActive();
    threadError(err, form);
    return false;
  }
}

async function deleteThread(thread) {
  const confirmed = await confirmDialog({
    title: 'Delete this thread?',
    message: `"${thread.title}" will be deleted. The papers stay in your reading list.`,
  });
  if (!confirmed) return;
  try {
    await api.del(`/reviews/${reviewId}/threads/${thread.id}`);
    state.review.threads = state.review.threads.filter((t) => t.id !== thread.id);
    renderCounts();
    renderActive();
    toast('Thread deleted', 'success');
  } catch (err) {
    if (!reloadIfGone(err)) toast(err.message, 'error');
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

// Couldn't load (offline, server down): say so, offer a retry and a way back.
function loadFailed(message) {
  const box = errorState(message, load);
  box.append(el('a', { class: 'btn btn--ghost', href: 'reviews.html' }, 'Back to your reviews'));
  return box;
}

function render() {
  if (!state.loaded) {
    headerRoot.replaceChildren(reviewPageSkeleton());
    return;
  }
  if (state.error) {
    body.hidden = true;
    const missing = state.error instanceof ApiError && state.error.status === 404;
    headerRoot.replaceChildren(missing ? notFound() : loadFailed(state.error.message));
    return;
  }
  renderHeader();
  body.hidden = false;
  renderCounts();
  readingList.render(state.entries);
  selectTab(state.tab);
}

// One request loads the review, its saved papers and the citation links between them.
async function load() {
  state.loaded = false;
  render();
  try {
    if (!reviewId) throw new ApiError(404, 'Review not found');
    const { entries, citations, ...review } = await api.get(`/reviews/${reviewId}`, {
      include: 'entries,citations',
    });
    state.review = review;
    state.entries = entries;
    setCitations(citations);
    state.error = null;
    document.title = `${review.title} · Paperscape`;
    const findPapers = () => selectTab('find', { focus: true });
    readingList ??= new ReadingList(panels.list, {
      onUpdate: updateEntry,
      onRemove: removeEntry,
      onFindPapers: findPapers,
      linksOf: (entryId) => state.index.get(entryId),
    });

    const linksOf = (entryId) => state.index.get(entryId);
    threadsView ??= new ThreadsView(panels.threads, {
      onCreate: createThread,
      onUpdate: updateThread,
      onDelete: deleteThread,
      onOpenEntry: openEntry,
      onFindPapers: findPapers,
      onShowOnMap: showThreadOnMap,
      linksOf,
    });
    citationsView ??= new CitationsView(panels.citations, {
      onOpenEntry: openEntry,
      onFindCiting: findCiting,
    });
    orbitMap ??= new OrbitMap(panels.map, {
      onOpenEntry: openEntry,
      onFindPapers: findPapers,
      onFindCiting: findCiting,
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
