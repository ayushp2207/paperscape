import { qs } from '../shared/dom.js';
import { emptyState } from '../shared/ui.js';

// Scaffold placeholder: replaced in task H-5.
qs('#reviews-root').append(
  emptyState({
    iconName: 'book',
    title: 'Under construction',
    text: 'Your literature reviews land here.',
  }),
);
