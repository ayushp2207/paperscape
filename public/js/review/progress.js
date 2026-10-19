import { el, svgEl } from '../shared/dom.js';

const MAX_DOTS = 24;
const STATUS_FILL = { read: 'var(--success)', reading: 'var(--accent)' };

// Each phase names the next step and the review-page tab that step happens in.
export const PHASES = [
  {
    label: 'Gather',
    hint: 'Save papers that might answer your question',
    action: 'Find papers',
    tab: 'find',
  },
  {
    label: 'Read',
    hint: 'Work through your reading list',
    action: 'Continue reading',
    tab: 'list',
  },
  {
    label: 'Synthesise',
    hint: 'Most papers are read: connect them into threads',
    action: 'Build threads',
    tab: 'threads',
  },
  { label: 'Write', hint: 'Every paper is read', action: 'See citations', tab: 'citations' },
];

// Index into PHASES for where a review stands, from its status counts.
export function phaseIndex({ total, read, reading }) {
  if (total === 0 || (read === 0 && reading === 0)) return 0;
  if (read === total) return 3;
  return read / total >= 0.7 ? 2 : 1;
}

// Four pips, the current one lit: Gather → Read → Synthesise → Write.
export function phaseTrack(counts) {
  const current = phaseIndex(counts);
  return el(
    'div',
    { class: 'phase-track' },
    el(
      'ol',
      { class: 'phase-track__steps', 'aria-label': 'Review phase' },
      PHASES.map((phase, i) =>
        el(
          'li',
          {
            class: ['phase-track__step', i < current && 'is-done', i === current && 'is-current'],
            'aria-current': i === current ? 'step' : undefined,
          },
          el('span', { class: 'visually-hidden' }, phase.label),
        ),
      ),
    ),
    el(
      'p',
      { class: 'phase-track__label' },
      el('strong', {}, PHASES[current].label),
      ` · ${PHASES[current].hint}`,
    ),
  );
}

// The review's papers as dots orbiting its progress: read first, then reading, then to-read.
// Past MAX_DOTS each dot stands for several papers, so the ring keeps its proportions.
export function orbitBadge(counts) {
  const { total, read, reading } = counts;
  const percent = total ? Math.round((read / total) * 100) : 0;
  const dots = Math.min(total, MAX_DOTS);
  const scale = total ? dots / total : 0;
  const readDots = Math.round(read * scale);
  const readingDots = Math.round(reading * scale);

  const size = 88;
  const center = size / 2;
  const radius = 36;
  const ring = svgEl('circle', { class: 'orbit-badge__ring', cx: center, cy: center, r: radius });
  const planets = Array.from({ length: dots }, (_, i) => {
    const angle = (i / dots) * 2 * Math.PI - Math.PI / 2;
    const status = i < readDots ? 'read' : i < readDots + readingDots ? 'reading' : 'to-read';
    return svgEl('circle', {
      class: `orbit-badge__dot orbit-badge__dot--${status}`,
      cx: center + radius * Math.cos(angle),
      cy: center + radius * Math.sin(angle),
      r: dots > 16 ? 3 : 4,
      style: STATUS_FILL[status] ? { fill: STATUS_FILL[status] } : undefined,
    });
  });

  return el(
    'div',
    {
      class: 'orbit-badge',
      role: 'img',
      'aria-label': total
        ? `${read} of ${total} papers read, ${reading} in progress`
        : 'No papers saved yet',
    },
    svgEl(
      'svg',
      { viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' },
      svgEl('g', { class: 'orbit-badge__orbit' }, ring, planets),
    ),
    el(
      'span',
      { class: 'orbit-badge__center', 'aria-hidden': 'true' },
      el('strong', {}, total ? `${percent}%` : '0'),
      el('small', {}, total ? 'read' : 'papers'),
    ),
  );
}
