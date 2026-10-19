import { api } from '../shared/api.js';
import { el } from '../shared/dom.js';
import { toast } from '../shared/ui.js';
import { ReviewFields, saveReview } from './reviewFields.js';

// A card that has turned into its own edit form. Esc or Cancel puts the card back.
export function reviewEditor(review, { loadVocabulary, onSaved, onCancel }) {
  const fields = new ReviewFields({ idPrefix: `edit-${review._id}` });
  fields.fill(review);
  loadVocabulary().then((vocabulary) => (fields.vocabulary = vocabulary));

  const form = el(
    'form',
    {
      class: 'card review-card review-card--editing form',
      'aria-label': `Edit ${review.title}`,
      novalidate: true,
      on: {
        keydown: (event) => {
          if (event.key === 'Escape') onCancel();
        },
      },
    },
    fields.element,
    el(
      'div',
      { class: 'review-card__footer' },
      el('span', { class: 'muted review-card__hint' }, 'Esc to cancel'),
      el(
        'div',
        { class: 'card__actions' },
        el(
          'button',
          { class: 'btn btn--ghost btn--sm', type: 'button', on: { click: onCancel } },
          'Cancel',
        ),
        el('button', { class: 'btn btn--primary btn--sm', type: 'submit' }, 'Save'),
      ),
    ),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const saved = await saveReview(form, () => api.put(`/reviews/${review._id}`, fields.value));
    if (!saved) return;
    toast('Review updated', 'success');
    onSaved(saved);
  });

  queueMicrotask(() => fields.focus());
  return form;
}
