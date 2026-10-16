import { qs } from '../shared/dom.js';
import { emptyState } from '../shared/ui.js';

// Scaffold placeholder: replaced in task H-6.
qs('#review-root').append(
  emptyState({
    iconName: 'book',
    title: 'Under construction',
    text: 'The review workspace lands here.',
  }),
);
