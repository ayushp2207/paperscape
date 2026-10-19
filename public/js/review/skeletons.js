import { el } from '../shared/dom.js';

// Loading placeholders shaped like the content they stand in for (the "grey outline" pattern):
// the layout appears at once and fills in when the data arrives. Shapes use the shared
// .skeleton shimmer; screen readers hear one "Loading" instead of the shapes.

const SLOW_MS = 5000;

const line = (width, extra = '') =>
  el('span', { class: `skeleton sk-line ${extra}`, style: { width } });
const circle = (size) =>
  el('span', { class: 'skeleton sk-circle', style: { width: size, height: size } });

function group(className, children) {
  return el(
    'div',
    { class: ['sk', className], role: 'status', 'aria-label': 'Loading' },
    el('div', { class: 'sk__shapes', 'aria-hidden': 'true' }, children),
    slowNotice(),
  );
}

// Free hosting sleeps when idle; if loading drags on, say so instead of looking broken.
function slowNotice() {
  const notice = el(
    'p',
    { class: 'sk__slow muted', hidden: true },
    'Still loading… the server may be waking up, which can take up to a minute.',
  );
  setTimeout(() => {
    if (notice.isConnected) notice.hidden = false;
  }, SLOW_MS);
  return notice;
}

function reviewCardShape() {
  return el(
    'div',
    { class: 'card sk-card' },
    el(
      'div',
      { class: 'sk-row' },
      circle('88px'),
      el('div', { class: 'sk-stack' }, line('40%'), line('75%', 'sk-line--title'), line('55%')),
    ),
    line('100%'),
    line('85%'),
    el('div', { class: 'sk-row' }, line('28%', 'sk-line--pill'), line('22%', 'sk-line--pill')),
    line('100%', 'sk-line--thin'),
    el('div', { class: 'sk-row sk-row--end' }, line('30%', 'sk-line--button')),
  );
}

export function reviewCardsSkeleton(count = 3) {
  return group('sk--grid', Array.from({ length: count }, reviewCardShape));
}

function paperCardShape() {
  return el(
    'div',
    { class: 'card sk-card' },
    el('div', { class: 'sk-row' }, line('18%'), line('30%'), line('24%', 'sk-line--pill')),
    line('95%', 'sk-line--title'),
    line('70%', 'sk-line--title'),
    line('60%'),
    line('100%'),
    line('100%'),
    line('80%'),
    el(
      'div',
      { class: 'sk-row sk-row--between' },
      line('26%', 'sk-line--button'),
      line('36%', 'sk-line--button'),
    ),
  );
}

export function paperCardsSkeleton(count = 6) {
  return group('sk--grid', Array.from({ length: count }, paperCardShape));
}

function entryShape() {
  return el(
    'div',
    { class: 'sk-entry' },
    line('1.5rem', 'sk-line--number'),
    el(
      'div',
      { class: 'sk-stack' },
      line('40%'),
      line('85%', 'sk-line--title'),
      line('35%'),
      el('div', { class: 'sk-row' }, line('34%', 'sk-line--pill'), line('28%')),
    ),
    el('div', { class: 'sk-stack sk-entry__margin' }, line('30%'), line('90%'), line('70%')),
  );
}

// The whole review page: header card, tabs and the first few reading-list rows.
export function reviewPageSkeleton() {
  return group('sk--page', [
    el(
      'div',
      { class: 'sk-header' },
      el(
        'div',
        { class: 'sk-row' },
        circle('88px'),
        el('div', { class: 'sk-stack' }, line('30%'), line('60%', 'sk-line--heading')),
      ),
      line('95%', 'sk-line--title'),
      line('70%', 'sk-line--title'),
      line('100%', 'sk-line--thin'),
    ),
    el(
      'div',
      { class: 'sk-row sk-tabs' },
      line('120px', 'sk-line--button'),
      line('110px', 'sk-line--button'),
      line('90px', 'sk-line--button'),
    ),
    Array.from({ length: 3 }, entryShape),
  ]);
}
