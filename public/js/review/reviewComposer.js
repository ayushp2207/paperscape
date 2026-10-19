import { api } from '../shared/api.js';
import { toast } from '../shared/ui.js';
import { reviewCard } from './reviewCard.js';
import { ReviewFields, saveReview } from './reviewFields.js';

export const EMPTY_COUNTS = { 'to-read': 0, reading: 0, read: 0, total: 0 };

// The "new review" composer: fields on one side, a live preview card on the other.
// onCreated(review, previewRect) gets the preview's position so the new card can fly from it.
export function initComposer(form, previewRoot, { loadVocabulary, onCreated }) {
  const renderPreview = (value) => {
    previewRoot.replaceChildren(
      reviewCard(
        { _id: 'preview', ...value, counts: EMPTY_COUNTS, threads: [] },
        { preview: true },
      ),
    );
  };
  const fields = new ReviewFields({ idPrefix: 'new', onChange: renderPreview });
  renderPreview(fields.value);

  form.prepend(fields.element);
  form.addEventListener(
    'focusin',
    () => loadVocabulary().then((vocabulary) => (fields.vocabulary = vocabulary)),
    { once: true },
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const saved = await saveReview(form, () => api.post('/reviews', fields.value));
    if (!saved) return;
    const from = previewRoot.firstElementChild.getBoundingClientRect();
    fields.reset();
    toast('Review created', 'success');
    onCreated(saved, from);
  });

  return { focus: () => fields.focus() };
}
