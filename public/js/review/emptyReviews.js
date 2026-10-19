import { el, svgEl } from '../shared/dom.js';

// Papers waiting to be found: one ring per reading stage, each turning at its own pace.
const RINGS = [
  { radius: 46, dots: [30, 210], status: 'read' },
  { radius: 72, dots: [100, 260], status: 'reading' },
  { radius: 98, dots: [10, 150, 300], status: 'to-read' },
];

// The orbit drawing with a mark at its centre: "?" (no question yet) or "+" (start one).
export function orbitIllustration(mark) {
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
    svgEl('text', { class: 'empty-orbit__mark', x: center, y: center + 9 }, mark),
  );
}

// The Reviews page before the first review: a quiet placeholder under the composer.
export function emptyReviews() {
  return el(
    'div',
    { class: 'empty-reviews' },
    orbitIllustration('?'),
    el('p', { class: 'muted' }, 'Your reviews will appear here.'),
  );
}
