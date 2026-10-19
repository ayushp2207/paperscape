import { api } from '../shared/api.js';
import { el, qs } from '../shared/dom.js';
import { confirmDialog, errorState, skeleton, toast } from '../shared/ui.js';
import { emptyReviews, orbitIllustration } from './emptyReviews.js';
import { reviewCard } from './reviewCard.js';
import { EMPTY_COUNTS, initComposer } from './reviewComposer.js';
import { reviewEditor } from './reviewEditor.js';
import { loadVocabulary } from './vocabularyClient.js';

const state = { reviews: [], loaded: false, error: null, editingId: null };
const root = qs('#reviews-root');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Saves come back from the API, so the list is patched in place instead of refetched.
const composer = initComposer(qs('#composer'), qs('#composer-preview'), {
  loadVocabulary,
  onCreated(review, from) {
    state.reviews.unshift({ ...review, counts: EMPTY_COUNTS, lastActivityAt: review.updatedAt });
    render();
    flyIn(review._id, from);
  },
});

// The new card travels from the preview to its place in the list (FLIP animation).
function flyIn(id, from) {
  const card = root.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!card) return;
  card.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  if (reducedMotion.matches) return;
  const to = card.getBoundingClientRect();
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  card.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})`, opacity: 0.6 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 650, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  );
}

async function load() {
  state.loaded = false;
  render();
  try {
    state.reviews = await api.get('/reviews');
    state.error = null;
  } catch (err) {
    state.error = err.message;
  }
  state.loaded = true;
  render();
}

function startEdit(review) {
  state.editingId = review._id;
  render();
}

function stopEdit(saved) {
  if (saved) {
    state.reviews = state.reviews.map((review) =>
      review._id === saved._id ? { ...review, ...saved, lastActivityAt: saved.updatedAt } : review,
    );
  }
  const id = state.editingId;
  state.editingId = null;
  render();
  root.querySelector(`[data-id="${CSS.escape(id)}"] .card__title a`)?.focus();
}

async function remove(review) {
  const removes = [
    review.counts.total && plural(review.counts.total, 'saved paper'),
    review.threads.length && plural(review.threads.length, 'thread'),
  ].filter(Boolean);
  const confirmed = await confirmDialog({
    title: 'Delete this review?',
    message: removes.length
      ? `"${review.title}" will be deleted, along with its ${removes.join(' and ')}.`
      : `"${review.title}" will be deleted.`,
  });
  if (!confirmed) return;
  try {
    await api.del(`/reviews/${review._id}`);
    state.reviews = state.reviews.filter((r) => r._id !== review._id);
    toast('Review deleted', 'success');
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function card(review) {
  if (review._id === state.editingId) {
    const editor = reviewEditor(review, {
      loadVocabulary,
      onSaved: stopEdit,
      onCancel: () => stopEdit(),
    });
    editor.dataset.id = review._id;
    return editor;
  }
  return reviewCard(review, { onEdit: () => startEdit(review), onDelete: () => remove(review) });
}

function render() {
  if (!state.loaded) {
    root.replaceChildren(skeleton(3, 'card'));
    return;
  }
  if (state.error) {
    root.replaceChildren(errorState(state.error, load));
    return;
  }
  if (state.reviews.length === 0) {
    root.replaceChildren(emptyReviews());
    return;
  }
  root.replaceChildren(
    listHeader(),
    el('div', { class: 'grid review-grid' }, state.reviews.map(card), newQuestionCard()),
  );
}

// Totals across every review, from the counts the list already has (no extra request).
function listHeader() {
  const sum = (pick) => state.reviews.reduce((total, review) => total + pick(review), 0);
  const stats = [
    [state.reviews.length, 'review'],
    [sum((review) => review.counts.total), 'paper saved', 'papers saved'],
    [sum((review) => review.counts.read), 'paper read', 'papers read'],
    [sum((review) => review.threads.length), 'thread'],
  ];
  return el(
    'header',
    { class: 'review-list__header' },
    el('h2', { class: 'review-list__title' }, 'Your reviews'),
    el(
      'ul',
      { class: 'review-stats', 'aria-label': 'Totals' },
      stats.map(([value, one, many = `${one}s`]) =>
        el(
          'li',
          { class: 'review-stats__item' },
          el('strong', {}, String(value)),
          value === 1 ? one : many,
        ),
      ),
    ),
  );
}

// The last grid cell invites the next question, so a short list never looks empty.
function newQuestionCard() {
  return el(
    'button',
    {
      class: 'card review-card-ghost',
      type: 'button',
      on: { click: () => composer.focus() },
    },
    orbitIllustration('+'),
    el('span', { class: 'review-card-ghost__title' }, 'New question'),
    el('span', { class: 'muted' }, 'Start another review'),
  );
}

load();
