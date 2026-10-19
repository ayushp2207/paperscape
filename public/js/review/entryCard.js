import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { LIMITS, RELATIONS, STATUSES } from './vocab.js';

const MAX_AUTHORS = 3;
const RATINGS = Array.from(
  { length: (LIMITS.relevanceMax - LIMITS.relevanceMin) / LIMITS.relevanceStep + 1 },
  (_, i) => LIMITS.relevanceMin + i * LIMITS.relevanceStep,
);
const STARS = LIMITS.relevanceMax;

const authorLine = (authors) =>
  authors.length > MAX_AUTHORS
    ? `${authors
        .slice(0, MAX_AUTHORS)
        .map((a) => a.name)
        .join(', ')} et al.`
    : authors.map((a) => a.name).join(', ');

// A group of radio buttons drawn as a segmented control. Saves on change.
function radioGroup({ legend, name, options, value, className, onChange }) {
  return el(
    'fieldset',
    { class: className },
    el('legend', { class: 'visually-hidden' }, legend),
    options.map((option) =>
      el(
        'label',
        { class: `${className}__option` },
        el('input', {
          type: 'radio',
          name,
          value: String(option.value),
          checked: option.value === value,
          on: { change: () => onChange(option.value) },
        }),
        el('span', { class: `${className}__label` }, option.label),
      ),
    ),
  );
}

// Relevance as five stars that fill in half steps. Each half star is a radio button laid over
// the drawn stars, so clicks, arrow keys and screen readers all work like any radio group.
// Hovering previews the rating before it is chosen.
function starRating({ id, value, onChange }) {
  let current = value;
  const score = el('span', { class: 'stars__score mono' }, `${current}/${STARS}`);
  const show = (rating) => track.style.setProperty('--rating', String(rating));
  const track = el(
    'div',
    { class: 'stars__track', style: { '--rating': String(current) } },
    el('span', { class: 'stars__glyphs', 'aria-hidden': 'true' }, '★'.repeat(STARS)),
    el(
      'div',
      { class: 'stars__hits', on: { mouseleave: () => show(current) } },
      RATINGS.map((rating) =>
        el(
          'label',
          {
            class: 'stars__half',
            title: `${rating} of ${STARS}`,
            on: { mouseenter: () => show(rating) },
          },
          el('input', {
            type: 'radio',
            name: `relevance-${id}`,
            value: String(rating),
            checked: rating === current,
            on: {
              change: () => {
                current = rating;
                show(rating);
                score.textContent = `${rating}/${STARS}`;
                onChange(rating);
              },
            },
          }),
          el('span', { class: 'visually-hidden' }, `${rating} of ${STARS} stars`),
        ),
      ),
    ),
  );
  return el(
    'div',
    { class: 'stars', role: 'radiogroup', 'aria-labelledby': `relevance-label-${id}` },
    el('span', { class: 'entry__control-label', id: `relevance-label-${id}` }, 'Relevance'),
    track,
    score,
  );
}

function findingsEditor(entry, onSave) {
  const input = el('input', {
    class: 'input',
    id: `finding-${entry._id}`,
    name: 'findings',
    maxlength: String(LIMITS.finding),
    placeholder: 'What does this paper tell you?',
  });
  const save = (findings) => onSave({ findings });

  // Collapsed to a small button until used, so a list of entries isn't a wall of empty inputs.
  const form = el(
    'form',
    {
      class: 'findings__add',
      novalidate: true,
      hidden: true,
      on: {
        submit: (event) => {
          event.preventDefault();
          if (input.value.trim()) save([...entry.findings, input.value.trim()]);
        },
        keydown: (event) => {
          if (event.key === 'Escape') collapse();
        },
      },
    },
    el('label', { class: 'visually-hidden', for: input.id }, 'Add a finding'),
    input,
    el('button', { class: 'btn btn--ghost btn--sm', type: 'submit' }, 'Add'),
  );
  const open = el(
    'button',
    {
      class: 'link-btn',
      type: 'button',
      on: {
        click: () => {
          open.hidden = true;
          form.hidden = false;
          input.focus();
        },
      },
    },
    icon('plus', { size: 14 }),
    'Add finding',
  );
  const collapse = () => {
    form.hidden = true;
    open.hidden = false;
    open.focus();
  };
  const addFinding = el('div', {}, open, form);

  return el(
    'div',
    { class: 'findings' },
    entry.findings.length > 0 &&
      el(
        'ul',
        { class: 'findings__list', 'aria-label': 'Findings' },
        entry.findings.map((finding, i) =>
          el(
            'li',
            {},
            el('span', {}, finding),
            el(
              'button',
              {
                class: 'icon-btn icon-btn--sm',
                type: 'button',
                'aria-label': `Remove finding: ${finding}`,
                on: { click: () => save(entry.findings.filter((_, j) => j !== i)) },
              },
              icon('x', { size: 14 }),
            ),
          ),
        ),
      ),
    entry.findings.length < LIMITS.findings && addFinding,
  );
}

// Notes live in the margin, like notes on a printed paper. They save when the field loses
// focus, and only if the text changed.
function marginNotes(entry, onSave) {
  const status = el('p', { class: 'entry__saved', 'aria-live': 'polite' });
  const notes = el('textarea', {
    class: 'entry__notes',
    id: `notes-${entry._id}`,
    name: 'notes',
    rows: '3',
    maxlength: String(LIMITS.notes),
    placeholder: 'Add a note…',
    on: {
      blur: async () => {
        if (notes.value.trim() === entry.notes) return;
        status.textContent = 'Saving…';
        status.textContent = (await onSave({ notes: notes.value })) ? 'Saved ✓' : '';
      },
    },
  });
  // A textarea's starting text is its content, not a value attribute.
  notes.textContent = entry.notes;
  return el(
    'div',
    { class: 'entry__margin' },
    el('label', { class: 'entry__margin-label', for: notes.id }, 'Notes'),
    notes,
    status,
  );
}

// One saved paper in the reading list: numbered, with reading controls and margin notes.
// onUpdate(fields) saves and resolves true/false; onRemove() asks and removes.
export function entryCard(entry, number, { onUpdate, onRemove }) {
  const { paper } = entry;
  return el(
    'li',
    { class: ['entry', `entry--${entry.status}`], id: `entry-${entry._id}` },
    el('span', { class: 'entry__number mono', 'aria-hidden': 'true' }, String(number)),
    el(
      'article',
      { class: 'entry__main', 'aria-labelledby': `entry-title-${entry._id}` },
      el(
        'p',
        { class: 'paper-card__meta' },
        el('span', { class: 'mono' }, String(paper.year)),
        el('span', {}, `${paper.citedByCount.toLocaleString()} citations`),
        paper.venue && el('span', {}, paper.venue),
      ),
      el(
        'h3',
        { class: 'entry__title', id: `entry-title-${entry._id}` },
        el(
          'a',
          { href: paper.doi ?? paper.openalexUrl, target: '_blank', rel: 'noopener noreferrer' },
          paper.title,
        ),
      ),
      el('p', { class: 'muted entry__authors' }, authorLine(paper.authors)),
      el(
        'div',
        { class: 'entry__controls' },
        radioGroup({
          legend: 'Reading status',
          name: `status-${entry._id}`,
          className: 'segmented',
          value: entry.status,
          options: STATUSES.map((s) => ({ value: s.id, label: s.label })),
          onChange: (status) => onUpdate({ status }),
        }),
        starRating({
          id: entry._id,
          value: entry.relevance,
          onChange: (relevance) => onUpdate({ relevance }),
        }),
        el(
          'label',
          { class: 'entry__relation' },
          el('span', { class: 'entry__control-label' }, 'Role'),
          el(
            'select',
            {
              class: 'select select--sm',
              name: 'relation',
              on: { change: (event) => onUpdate({ relation: event.target.value }) },
            },
            RELATIONS.map((r) =>
              el('option', { value: r.id, selected: r.id === entry.relation }, r.label),
            ),
          ),
        ),
      ),
      el(
        'details',
        { class: 'paper-card__abstract' },
        el('summary', {}, 'Abstract'),
        el('p', {}, paper.abstract),
      ),
      findingsEditor(entry, onUpdate),
      el(
        'button',
        {
          class: 'link-btn entry__remove',
          type: 'button',
          on: { click: onRemove },
        },
        icon('trash', { size: 14 }),
        'Remove from review',
      ),
    ),
    marginNotes(entry, onUpdate),
  );
}
