import { qs } from '../shared/dom.js';
import { emptyState } from '../shared/ui.js';

// Scaffold placeholder: replaced in task A-5.
qs('#plans-root').append(
  emptyState({
    iconName: 'target',
    title: 'Under construction',
    text: 'Submission plans with countdowns land here.',
  }),
);
