import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { LIMITS, STATUSES } from './vocab.js';

const statusLabel = (id) => STATUSES.find((status) => status.id === id).label;
const MAX_SUGGESTIONS = 3;

// The "Threads" tab. A thread is an ordered path through the review's papers: the order you
// would tell the story in. The page owns the data; this class draws it and reports changes.
// Handlers: onCreate(form, fields) and onUpdate(thread, fields, form?) save and resolve to true
// on success (the form, when given, receives any field errors); onDelete(thread);
// onOpenEntry(entryId); onFindPapers(); onShowOnMap(threadId); linksOf(entryId) gives that
// paper's { cites, citedBy } within the review.
export class ThreadsView {
  #root;
  #handlers;
  #threads = [];
  #entries = [];
  #composerOpen = false;
  #renamingId = null;

  constructor(root, handlers) {
    this.#root = root;
    this.#handlers = handlers;
  }

  render(threads, entries) {
    this.#threads = threads;
    this.#entries = entries;
    if (entries.length < LIMITS.minThreadPapers) {
      this.#root.replaceChildren(this.#tooFewPapers());
      return;
    }
    const byId = new Map(entries.map((entry) => [entry._id, entry]));
    this.#root.replaceChildren(
      this.#composer(),
      threads.length
        ? el(
            'ol',
            { class: 'thread-list' },
            threads.map((thread) => this.#threadCard(thread, byId)),
          )
        : el(
            'p',
            { class: 'muted thread-list__none' },
            'No threads yet. Start one above to put papers in the order your argument needs.',
          ),
    );
  }

  #tooFewPapers() {
    return el(
      'div',
      { class: 'empty-state' },
      icon('thread', { size: 32, className: 'empty-state__icon' }),
      el('h3', { class: 'empty-state__title' }, 'Save a few papers first'),
      el(
        'p',
        { class: 'muted' },
        `A thread links at least ${LIMITS.minThreadPapers} saved papers into a path, like the order you would cite them in.`,
      ),
      el(
        'button',
        { class: 'btn btn--primary', type: 'button', on: { click: this.#handlers.onFindPapers } },
        icon('search', { size: 16 }),
        'Find papers',
      ),
    );
  }

  // New-thread form. Open by default only while there are no threads yet.
  #composer() {
    const open = this.#composerOpen || this.#threads.length === 0;
    if (!open) {
      return el(
        'button',
        {
          class: 'btn btn--primary btn--sm thread-new',
          type: 'button',
          on: {
            click: () => {
              this.#composerOpen = true;
              this.render(this.#threads, this.#entries);
              this.#root.querySelector('#thread-title')?.focus();
            },
          },
        },
        icon('plus', { size: 16 }),
        'New thread',
      );
    }

    const picked = [];
    const submit = el(
      'button',
      { class: 'btn btn--primary btn--sm', type: 'submit', disabled: true },
      'Create thread',
    );
    const title = el('input', {
      class: 'input',
      id: 'thread-title',
      name: 'title',
      maxlength: String(LIMITS.threadTitle),
      required: true,
      placeholder: 'e.g. From augmentation to robustness',
      on: { input: () => sync() },
    });
    const note = el('input', {
      class: 'input',
      id: 'thread-note',
      name: 'note',
      maxlength: String(LIMITS.threadNote),
      placeholder: 'What this path shows (optional)',
    });
    const order = new Map();
    const sync = () => {
      for (const [id, badge] of order) {
        const n = picked.indexOf(id);
        badge.textContent = n >= 0 ? String(n + 1) : '';
      }
      submit.disabled = !title.value.trim() || picked.length < LIMITS.minThreadPapers;
    };

    const options = this.#entries.map((entry) => {
      const badge = el('span', { class: 'thread-pick__order mono', 'aria-hidden': 'true' });
      order.set(entry._id, badge);
      return el(
        'li',
        {},
        el(
          'label',
          { class: 'thread-pick' },
          el('input', {
            type: 'checkbox',
            name: 'entryIds',
            value: entry._id,
            on: {
              change: (event) => {
                if (event.target.checked) picked.push(entry._id);
                else picked.splice(picked.indexOf(entry._id), 1);
                sync();
              },
            },
          }),
          badge,
          el('span', { class: 'thread-pick__title' }, entry.paper.title),
          el('span', { class: 'muted thread-pick__meta' }, `${entry.paper.year}`),
        ),
      );
    });

    const form = el(
      'form',
      {
        class: 'card thread-composer form',
        'aria-labelledby': 'thread-composer-title',
        novalidate: true,
        on: {
          submit: async (event) => {
            event.preventDefault();
            submit.disabled = true;
            const ok = await this.#handlers.onCreate(form, {
              title: title.value.trim(),
              note: note.value.trim(),
              entryIds: [...picked],
            });
            if (ok) this.#composerOpen = false;
            else sync();
          },
        },
      },
      el(
        'div',
        { class: 'thread-composer__head' },
        el('h3', { id: 'thread-composer-title' }, 'Start a thread'),
        el(
          'p',
          { class: 'muted' },
          'Tick papers in the order you want them; the numbers show the path.',
        ),
      ),
      el(
        'div',
        { class: 'form-row' },
        el('div', { class: 'field' }, el('label', { for: 'thread-title' }, 'Title'), title),
        el(
          'div',
          { class: 'field' },
          el(
            'label',
            { for: 'thread-note' },
            'Note ',
            el('span', { class: 'muted' }, '(optional)'),
          ),
          note,
        ),
      ),
      el(
        'fieldset',
        { class: 'field thread-composer__papers' },
        el('legend', {}, `Papers (at least ${LIMITS.minThreadPapers})`),
        el('ul', { class: 'thread-pick-list' }, options),
      ),
      el(
        'div',
        { class: 'thread-composer__actions' },
        this.#threads.length > 0 &&
          el(
            'button',
            {
              class: 'btn btn--ghost btn--sm',
              type: 'button',
              on: {
                click: () => {
                  this.#composerOpen = false;
                  this.render(this.#threads, this.#entries);
                },
              },
            },
            'Cancel',
          ),
        submit,
      ),
    );
    return form;
  }

  #threadCard(thread, byId) {
    const ids = thread.entryIds.filter((id) => byId.has(id));
    const move = (from, to) => {
      const next = [...ids];
      next.splice(to, 0, next.splice(from, 1)[0]);
      this.#handlers.onUpdate(thread, { entryIds: next });
    };
    const notInThread = this.#entries.filter((entry) => !ids.includes(entry._id));
    const read = ids.filter((id) => byId.get(id).status === 'read').length;
    const links = (id) => this.#handlers.linksOf(id) ?? { cites: [], citedBy: [] };

    // How a stop is backed by the next one: "cites #3" / "cited by #3" when they are linked.
    const evidence = (id, i) => {
      const next = ids[i + 1];
      if (!next) return null;
      if (links(id).cites.includes(next)) return `↓ cites #${i + 2}`;
      if (links(id).citedBy.includes(next)) return `↑ cited by #${i + 2}`;
      return null;
    };
    // Where the path could go next: saved papers linked to the last stop, not yet in the thread.
    const last = links(ids.at(-1));
    const suggestions = [...new Set([...last.citedBy, ...last.cites])]
      .filter((id) => byId.has(id) && !ids.includes(id))
      .slice(0, MAX_SUGGESTIONS);

    return el(
      'li',
      { class: 'card thread-card' },
      this.#renamingId === thread.id ? this.#renameForm(thread) : this.#threadHead(thread),
      el(
        'div',
        { class: 'thread-card__progress' },
        el(
          'div',
          {
            class: 'progress',
            role: 'progressbar',
            'aria-label': 'Papers read in this thread',
            'aria-valuemin': '0',
            'aria-valuemax': String(ids.length),
            'aria-valuenow': String(read),
          },
          el('div', {
            class: 'progress__bar',
            style: { width: `${(read / ids.length) * 100}%`, background: 'var(--success)' },
          }),
        ),
        el('span', { class: 'muted' }, `${read} of ${ids.length} read`),
      ),
      el(
        'ol',
        { class: 'thread-steps', 'aria-label': `Papers in ${thread.title}, in order` },
        ids.map((id, i) => {
          const entry = byId.get(id);
          return el(
            'li',
            { class: ['thread-step', `thread-step--${entry.status}`] },
            el('span', { class: 'thread-step__number mono', 'aria-hidden': 'true' }, String(i + 1)),
            el(
              'div',
              { class: 'thread-step__body' },
              el(
                'button',
                {
                  class: 'thread-step__title',
                  type: 'button',
                  on: { click: () => this.#handlers.onOpenEntry(id) },
                },
                entry.paper.title,
              ),
              el(
                'span',
                { class: 'muted thread-step__meta' },
                `${entry.paper.year} · ${statusLabel(entry.status)}`,
                evidence(id, i) && el('span', { class: 'thread-step__evidence' }, evidence(id, i)),
              ),
            ),
            el(
              'div',
              { class: 'thread-step__controls' },
              this.#stepButton('↑', `Move ${entry.paper.title} up`, i === 0, () => move(i, i - 1)),
              this.#stepButton('↓', `Move ${entry.paper.title} down`, i === ids.length - 1, () =>
                move(i, i + 1),
              ),
              this.#stepButton(
                '✕',
                ids.length <= LIMITS.minThreadPapers
                  ? `A thread needs at least ${LIMITS.minThreadPapers} papers`
                  : `Remove ${entry.paper.title} from this thread`,
                ids.length <= LIMITS.minThreadPapers,
                () => this.#handlers.onUpdate(thread, { entryIds: ids.filter((x) => x !== id) }),
              ),
            ),
          );
        }),
      ),
      suggestions.length > 0 &&
        el(
          'div',
          { class: 'choice-row thread-suggest' },
          el('span', { class: 'choice-row__hint' }, 'Linked to the last stop:'),
          suggestions.map((id) =>
            el(
              'button',
              {
                class: 'chip chip--suggestion',
                type: 'button',
                'aria-label': `Add ${byId.get(id).paper.title} to the end of this thread`,
                on: { click: () => this.#handlers.onUpdate(thread, { entryIds: [...ids, id] }) },
              },
              icon('plus', { size: 14 }),
              byId.get(id).paper.title,
            ),
          ),
        ),
      notInThread.length > 0 &&
        el(
          'label',
          { class: 'thread-add' },
          el('span', { class: 'muted' }, 'Add a paper'),
          el(
            'select',
            {
              class: 'select select--sm',
              on: {
                change: (event) => {
                  if (event.target.value) {
                    this.#handlers.onUpdate(thread, { entryIds: [...ids, event.target.value] });
                  }
                },
              },
            },
            el('option', { value: '' }, 'Choose a saved paper…'),
            notInThread.map((entry) => el('option', { value: entry._id }, entry.paper.title)),
          ),
        ),
    );
  }

  #stepButton(label, ariaLabel, disabled, onClick) {
    return el(
      'button',
      {
        class: 'icon-btn icon-btn--sm',
        type: 'button',
        'aria-label': ariaLabel,
        title: ariaLabel,
        disabled,
        on: { click: onClick },
      },
      label,
    );
  }

  #threadHead(thread) {
    return el(
      'div',
      { class: 'thread-card__head' },
      el(
        'div',
        {},
        el('h3', { class: 'thread-card__title' }, icon('thread', { size: 18 }), thread.title),
        thread.note && el('p', { class: 'muted thread-card__note' }, thread.note),
      ),
      el(
        'div',
        { class: 'thread-card__actions' },
        el(
          'button',
          {
            class: 'btn btn--ghost btn--sm',
            type: 'button',
            on: { click: () => this.#handlers.onShowOnMap(thread.id) },
          },
          icon('globe', { size: 16 }),
          'Show on map',
        ),
        el(
          'button',
          {
            class: 'icon-btn icon-btn--sm',
            type: 'button',
            'aria-label': `Rename ${thread.title}`,
            title: 'Rename',
            on: {
              click: () => {
                this.#renamingId = thread.id;
                this.render(this.#threads, this.#entries);
                this.#root.querySelector(`#rename-${thread.id}`)?.focus();
              },
            },
          },
          icon('edit', { size: 16 }),
        ),
        el(
          'button',
          {
            class: 'icon-btn icon-btn--sm review-card__delete',
            type: 'button',
            'aria-label': `Delete ${thread.title}`,
            title: 'Delete thread',
            on: { click: () => this.#handlers.onDelete(thread) },
          },
          icon('trash', { size: 16 }),
        ),
      ),
    );
  }

  #renameForm(thread) {
    const stop = () => {
      this.#renamingId = null;
      this.render(this.#threads, this.#entries);
    };
    const input = el('input', {
      class: 'input',
      id: `rename-${thread.id}`,
      name: 'title',
      value: thread.title,
      maxlength: String(LIMITS.threadTitle),
      required: true,
    });
    const form = el(
      'form',
      {
        class: 'thread-rename',
        novalidate: true,
        on: {
          keydown: (event) => {
            if (event.key === 'Escape') stop();
          },
          submit: async (event) => {
            event.preventDefault();
            if (input.value.trim() === thread.title) return stop();
            this.#renamingId = null;
            await this.#handlers.onUpdate(thread, { title: input.value.trim() }, form);
          },
        },
      },
      el('label', { class: 'visually-hidden', for: input.id }, 'Thread title'),
      input,
      el('button', { class: 'btn btn--primary btn--sm', type: 'submit' }, 'Save'),
      el(
        'button',
        { class: 'btn btn--ghost btn--sm', type: 'button', on: { click: stop } },
        'Cancel',
      ),
    );
    return form;
  }
}
