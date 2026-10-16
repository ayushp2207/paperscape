import { qs } from '../shared/dom.js';
import { emptyState } from '../shared/ui.js';

// Scaffold placeholder: replaced in task A-3.
qs('#conferences-root').append(
  emptyState({
    iconName: 'globe',
    title: 'Under construction',
    text: 'The map, timeline and conference list land here.',
  }),
);
