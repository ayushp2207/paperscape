import { el, svgEl } from '../shared/dom.js';

// Example questions that match topics in the paper library, so trying one shows real
// title, keyword and area suggestions.
const EXAMPLES = [
  'Does data augmentation improve robustness of vision transformers?',
  'Can graph neural networks detect fraud in transaction networks?',
  'Can LLMs do chain-of-thought reasoning in low-resource languages?',
];

const STEPS = [
  ['Ask', 'Write the one question your review should answer.'],
  ['Save papers', 'Search the library and keep the papers that matter.'],
  ['Read', 'Mark what you have read, with notes and findings.'],
  ['Connect', 'Group papers into threads and see who cites whom.'],
];

// Papers waiting to be found: one ring per reading stage, each turning at its own pace.
const RINGS = [
  { radius: 46, dots: [30, 210], status: 'read' },
  { radius: 72, dots: [100, 260], status: 'reading' },
  { radius: 98, dots: [10, 150, 300], status: 'to-read' },
];

function orbitIllustration() {
  const center = 110;
  return svgEl(
    'svg',
    { class: 'empty-orbit', viewBox: '0 0 220 220', 'aria-hidden': 'true' },
    svgEl('circle', { class: 'empty-orbit__glow', cx: center, cy: center, r: 34 }),
    RINGS.map(({ radius, dots, status }, i) =>
      svgEl(
        'g',
        { class: `empty-orbit__ring empty-orbit__ring--${i + 1}` },
        svgEl('circle', { class: 'empty-orbit__path', cx: center, cy: center, r: radius }),
        dots.map((degrees) => {
          const angle = (degrees * Math.PI) / 180;
          return svgEl('circle', {
            class: `empty-orbit__dot empty-orbit__dot--${status}`,
            cx: center + radius * Math.cos(angle),
            cy: center + radius * Math.sin(angle),
            r: 5,
          });
        }),
      ),
    ),
    svgEl('text', { class: 'empty-orbit__mark', x: center, y: center + 9 }, '?'),
  );
}

// The Reviews page before the first review: what a review is, how it works, and example
// questions that fill the composer in one click.
export function emptyReviews({ onTry }) {
  return el(
    'section',
    { class: 'empty-reviews', 'aria-labelledby': 'empty-reviews-title' },
    orbitIllustration(),
    el(
      'div',
      { class: 'empty-reviews__body' },
      el('h2', { id: 'empty-reviews-title' }, 'Your first question goes in the middle'),
      el(
        'p',
        { class: 'muted' },
        'Every paper you save orbits it. Papers move inward as you read them, and lines appear between the ones that cite each other.',
      ),
      el(
        'ol',
        { class: 'empty-reviews__steps' },
        STEPS.map(([title, text], i) =>
          el(
            'li',
            {},
            el(
              'span',
              { class: 'empty-reviews__step-number', 'aria-hidden': 'true' },
              String(i + 1),
            ),
            el('span', {}, el('strong', {}, title), ' ', text),
          ),
        ),
      ),
      el(
        'div',
        { class: 'empty-reviews__try' },
        el('p', { class: 'choice-row__hint' }, 'Try one:'),
        el(
          'ul',
          { class: 'empty-reviews__examples' },
          EXAMPLES.map((question) =>
            el(
              'li',
              {},
              el(
                'button',
                {
                  class: 'chip chip--suggestion',
                  type: 'button',
                  on: { click: () => onTry(question) },
                },
                question,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
