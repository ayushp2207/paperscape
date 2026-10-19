import { ApiError } from '../shared/api.js';
import { AREAS } from '../shared/areas.js';
import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { clearFieldErrors, showFieldErrors, toast } from '../shared/ui.js';
import { analyseQuestion } from './questionText.js';
import { LIMITS } from './vocab.js';

// Runs a save for a review form: disables the button while saving, maps server field errors
// onto the inputs, and returns the saved review (or null if it failed).
export async function saveReview(form, request) {
  const submit = form.querySelector('[type="submit"]');
  clearFieldErrors(form);
  submit.disabled = true;
  try {
    return await request();
  } catch (err) {
    if (err instanceof ApiError && err.details) showFieldErrors(form, err.details);
    else toast(err.message, 'error');
    return null;
  } finally {
    submit.disabled = false;
  }
}

// A row of one-click choices, e.g. other title ideas or keyword suggestions.
function choiceRow(container, hint, choices, { label, iconName, onPick }) {
  container.replaceChildren(
    ...(choices.length
      ? [
          el('span', { class: 'choice-row__hint' }, hint),
          ...choices.map((choice) =>
            el(
              'button',
              {
                class: 'chip chip--suggestion',
                type: 'button',
                'aria-label': label(choice),
                on: { click: () => onPick(choice) },
              },
              iconName && icon(iconName, { size: 14 }),
              choice,
            ),
          ),
        ]
      : []),
  );
}

// Keywords as removable chips. Enter or comma adds, Backspace on an empty input removes the
// last one, and suggestion buttons add a phrase in one click.
class KeywordInput {
  #keywords = [];
  #onChange;

  constructor(id, onChange) {
    this.#onChange = onChange;
    this.list = el('ul', { class: 'token-field__list', 'aria-label': 'Added keywords' });
    this.input = el('input', {
      class: 'token-field__input',
      id,
      name: 'keywords',
      maxlength: String(LIMITS.keyword),
      autocomplete: 'off',
      placeholder: 'Type a keyword, press Enter',
      on: { keydown: (event) => this.#onKey(event), blur: () => this.#commitTyped() },
    });
    this.suggestions = el('div', { class: 'choice-row' });
    this.element = el(
      'div',
      { class: 'field' },
      el('label', { for: id }, 'Keywords ', el('span', { class: 'muted' }, '(optional)')),
      el('div', { class: 'token-field' }, this.list, this.input),
      this.suggestions,
    );
  }

  get value() {
    return [...this.#keywords];
  }

  set value(keywords) {
    this.#keywords = [...keywords];
    this.input.value = '';
    this.#render();
  }

  suggest(ideas) {
    const room = this.#keywords.length < LIMITS.keywords;
    choiceRow(this.suggestions, 'Suggested:', room ? ideas : [], {
      label: (idea) => `Add keyword ${idea}`,
      iconName: 'plus',
      onPick: (idea) => this.#add(idea),
    });
  }

  #add(text) {
    const keyword = text.trim().slice(0, LIMITS.keyword);
    const exists = this.#keywords.some((k) => k.toLowerCase() === keyword.toLowerCase());
    if (!keyword || exists || this.#keywords.length >= LIMITS.keywords) return;
    this.#keywords.push(keyword);
    this.#render();
    this.#onChange();
  }

  #remove(index) {
    this.#keywords.splice(index, 1);
    this.#render();
    this.#onChange();
    this.input.focus();
  }

  #commitTyped() {
    if (this.input.value.trim()) this.#add(this.input.value);
    this.input.value = '';
  }

  #onKey(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.#commitTyped();
    } else if (event.key === 'Backspace' && !this.input.value && this.#keywords.length) {
      this.#remove(this.#keywords.length - 1);
    }
  }

  #render() {
    this.list.replaceChildren(
      ...this.#keywords.map((keyword, i) =>
        el(
          'li',
          { class: 'token' },
          keyword,
          el(
            'button',
            {
              class: 'token__remove',
              type: 'button',
              'aria-label': `Remove keyword ${keyword}`,
              on: { click: () => this.#remove(i) },
            },
            icon('x', { size: 12 }),
          ),
        ),
      ),
    );
    this.input.hidden = this.#keywords.length >= LIMITS.keywords;
  }
}

// Question, title, area, keywords and optional context for one review. Used by the composer on
// the reviews page and by a card's inline editor. Title and area follow what the question is
// about until the user sets their own. Once the user types in the title it stays theirs, even
// when empty: an empty title shows the suggestion as a placeholder and saves as the suggestion.
export class ReviewFields {
  #onChange;
  #vocabulary;
  #titleIsAuto = true;
  #areaIsAuto = true;
  #analysis = analyseQuestion('');

  constructor({ idPrefix, vocabulary = [], onChange = () => {} }) {
    this.#onChange = onChange;
    this.#vocabulary = vocabulary;
    const id = (name) => `${idPrefix}-${name}`;
    const changed = () => this.#changed();
    const autoTag = () => el('span', { class: 'badge badge--accent' }, 'Auto');

    this.question = el('textarea', {
      class: 'textarea review-fields__question',
      id: id('question'),
      name: 'question',
      rows: '3',
      maxlength: String(LIMITS.question),
      required: true,
      placeholder: 'How do sparse attention methods trade accuracy for memory?',
      on: { input: changed, keydown: (event) => this.#submitOnEnter(event) },
    });
    this.title = el('input', {
      class: 'input',
      id: id('title'),
      name: 'title',
      maxlength: String(LIMITS.title),
      placeholder: 'Filled in from your topic',
      on: {
        input: () => {
          this.#titleIsAuto = false;
          changed();
        },
      },
    });
    this.titleTag = autoTag();
    this.titleChoices = el('div', { class: 'choice-row' });
    this.area = el(
      'select',
      {
        class: 'select',
        id: id('area'),
        name: 'area',
        on: {
          change: () => {
            this.#areaIsAuto = false;
            changed();
          },
        },
      },
      el('option', { value: '' }, 'Not sure yet'),
      AREAS.map((area) => el('option', { value: area.id }, area.label)),
    );
    this.areaTag = autoTag();
    this.description = el('textarea', {
      class: 'textarea',
      id: id('description'),
      name: 'description',
      rows: '2',
      maxlength: String(LIMITS.description),
      placeholder: 'Scope, constraints, what you already know…',
      on: { input: changed },
    });
    this.keywords = new KeywordInput(id('keywords'), changed);
    this.context = el(
      'details',
      { class: 'review-fields__context' },
      el('summary', {}, 'Add context ', el('span', { class: 'muted' }, '(optional)')),
      el(
        'div',
        { class: 'field' },
        el('label', { class: 'visually-hidden', for: id('description') }, 'Context'),
        this.description,
      ),
    );

    this.element = el(
      'div',
      { class: 'review-fields' },
      el(
        'div',
        { class: 'field' },
        el('label', { for: id('question') }, 'Research question'),
        this.question,
        el('p', { class: 'field__hint' }, 'The full question your papers should help answer.'),
      ),
      el(
        'div',
        { class: 'review-fields__row' },
        el(
          'div',
          { class: 'field' },
          el('label', { class: 'review-fields__label', for: id('title') }, 'Title ', this.titleTag),
          this.title,
          this.titleChoices,
        ),
        el(
          'div',
          { class: 'field' },
          el(
            'label',
            { class: 'review-fields__label', for: id('area') },
            'Research area ',
            this.areaTag,
          ),
          this.area,
        ),
      ),
      this.keywords.element,
      this.context,
    );
    this.#changed();
  }

  // Topic phrases from the paper library. Until they arrive, suggestions use the question alone.
  set vocabulary(vocabulary) {
    this.#vocabulary = vocabulary;
    this.#changed();
  }

  get value() {
    return {
      title: this.title.value.trim() || this.#analysis.titles[0] || 'Untitled review',
      question: this.question.value.trim(),
      area: this.area.value || null,
      description: this.description.value.trim(),
      keywords: this.keywords.value,
    };
  }

  fill(review) {
    this.question.value = review.question;
    this.title.value = review.title;
    this.area.value = review.area ?? '';
    this.description.value = review.description ?? '';
    this.context.open = Boolean(review.description);
    this.keywords.value = review.keywords;
    // Saved values that still match what the question suggests keep following it.
    this.#analyse();
    this.#titleIsAuto = !review.title || review.title === this.#analysis.titles[0];
    this.#areaIsAuto = !review.area || review.area === this.#analysis.area;
    this.#changed();
  }

  reset() {
    this.fill({ question: '', title: '', area: null, description: '', keywords: [] });
  }

  focus() {
    this.question.focus();
  }

  #analyse() {
    this.#analysis = analyseQuestion(this.question.value, {
      keywords: this.keywords.value,
      vocabulary: this.#vocabulary,
    });
  }

  #changed() {
    this.#analyse();
    const { titles, suggestions, area } = this.#analysis;
    if (this.#titleIsAuto) this.title.value = titles[0] ?? '';
    this.title.placeholder = titles[0] ?? 'Filled in from your topic';
    if (this.#areaIsAuto) this.area.value = area ?? '';
    this.titleTag.hidden = !this.#titleIsAuto;
    this.areaTag.hidden = !this.#areaIsAuto || !area;

    const current = this.title.value.trim().toLowerCase();
    choiceRow(
      this.titleChoices,
      'Or:',
      titles.filter((title) => title.toLowerCase() !== current),
      {
        label: (title) => `Use title ${title}`,
        onPick: (title) => {
          this.title.value = title;
          this.#titleIsAuto = false;
          this.#changed();
        },
      },
    );
    this.keywords.suggest(suggestions);
    this.#onChange(this.value);
  }

  // Enter saves straight from the question; Shift+Enter is a new line.
  #submitOnEnter(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.element.closest('form')?.requestSubmit();
    }
  }
}
