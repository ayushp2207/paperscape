import { el, svgEl } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { paperUrl } from './linkReport.js';
import { LIMITS, RELATIONS, STATUSES } from './vocab.js';

const SIZE = 640;
const CENTER = SIZE / 2;
const INNER = 92; // orbit radius for 5 stars
const SPREAD = 200; // extra distance out to the lowest rating
const SUN = 62;
const QUESTION_LINE = 20;
const QUESTION_LINES = 4;
const LABEL_LENGTH = 30;
const LABEL_CHAR = 6.6; // approximate width of one 12px label character
const STARS = 70;
// One lap of the innermost orbit, in seconds. Outer orbits are slower (Kepler: ω ∝ r^-1.5).
const INNER_LAP = 80;
const BEND = 0.2; // how far citation lines bow toward the centre
const FILL = { read: 'var(--success)', reading: 'var(--accent)' };
const BANDS = [
  { stars: 5, label: '5★ core' },
  { stars: 3, label: '3★' },
  { stars: 1, label: '1★ edge' },
];

const labelOf = (list, id) => list.find((item) => item.id === id)?.label ?? id;
const truncate = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Closer to the centre = more relevant.
const orbitRadius = (relevance) =>
  INNER +
  ((LIMITS.relevanceMax - relevance) / (LIMITS.relevanceMax - LIMITS.relevanceMin)) * SPREAD;
const angularSpeed = (radius) => ((2 * Math.PI) / INNER_LAP) * (INNER / radius) ** 1.5;

// Dot size from how often the paper is cited anywhere; smaller dots when the map is crowded.
const dotSize = (citedByCount, crowded) =>
  (crowded ? 4 : 5) + Math.min(crowded ? 7 : 11, Math.sqrt(citedByCount) / 3);

// Papers that cite each other start next to each other, so their lines begin short: walk each
// citation cluster in turn, in the order the papers were saved.
function ringOrder(entries, index) {
  const order = [];
  const seen = new Set();
  for (const start of entries) {
    const queue = [start._id];
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      order.push(id);
      const links = index.get(id);
      if (links) queue.push(...links.cites, ...links.citedBy);
    }
  }
  return order;
}

function questionLines(question) {
  const lines = [''];
  for (const word of question.split(/\s+/)) {
    const line = lines.at(-1);
    if (line && `${line} ${word}`.length > QUESTION_LINE) lines.push(word);
    else lines[lines.length - 1] = line ? `${line} ${word}` : word;
  }
  if (lines.length > QUESTION_LINES) {
    lines.length = QUESTION_LINES;
    lines[QUESTION_LINES - 1] = `${lines[QUESTION_LINES - 1].slice(0, QUESTION_LINE - 1)}…`;
  }
  return lines;
}

// A fixed sprinkle of background stars (same every time, so the sky doesn't jump on redraw).
function starfield() {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return svgEl(
    'g',
    { class: 'orbit-stars', 'aria-hidden': 'true' },
    Array.from({ length: STARS }, () =>
      svgEl('circle', { cx: random() * SIZE, cy: random() * SIZE, r: 0.4 + random() * 1.1 }),
    ),
  );
}

// An arrowhead per link colour (plain, "cites" and "cited by"), and the sun's glow.
function defs() {
  const marker = (id, className) =>
    svgEl(
      'marker',
      {
        id,
        viewBox: '0 0 10 10',
        refX: 9,
        refY: 5,
        markerWidth: 7,
        markerHeight: 7,
        orient: 'auto-start-reverse',
      },
      svgEl('path', { class: className, d: 'M0 1 L9 5 L0 9 z' }),
    );
  return svgEl(
    'defs',
    {},
    marker('orbit-arrow', 'orbit-arrow'),
    marker('orbit-arrow-out', 'orbit-arrow orbit-arrow--out'),
    marker('orbit-arrow-in', 'orbit-arrow orbit-arrow--in'),
    svgEl(
      'radialGradient',
      { id: 'orbit-sun' },
      svgEl('stop', { offset: '0%', style: { stopColor: 'var(--accent)', stopOpacity: 0.55 } }),
      svgEl('stop', { offset: '100%', style: { stopColor: 'var(--accent)', stopOpacity: 0 } }),
    ),
  );
}

// The "Map" tab: the review's question as a sun with its papers in orbit. Distance is relevance,
// fill is reading status, size is citations, and arrows show who cites whom. Papers circle the
// question (inner ones faster); motion pauses while pointing at a paper, with focus inside the map,
// while a paper is selected, when the tab is
// hidden, with the Pause button, and is off by default for people who prefer reduced motion.
// Each paper is an SVG link, so Tab and Enter work; the reading list shows the same papers.
export class OrbitMap {
  #root;
  #handlers;
  #data = null;
  #selectedId = null;
  #threadId = '';
  #paused = reducedMotion.matches;
  #holding = false; // pointer on a paper, or keyboard focus inside the map
  #time = 0;
  #lastFrame = null;
  #frame = null;
  #scene = null;

  constructor(root, handlers) {
    this.#root = root;
    this.#handlers = handlers;
    document.addEventListener('visibilitychange', () => this.#loop());
  }

  render(data) {
    this.#data = data;
    const { entries, threads } = data;
    if (!threads.some((thread) => thread.id === this.#threadId)) this.#threadId = '';
    if (!entries.some((entry) => entry._id === this.#selectedId)) this.#selectedId = null;

    if (entries.length === 0) {
      this.#scene = null;
      this.#root.replaceChildren(this.#empty());
      return;
    }
    this.#root.replaceChildren(
      this.#toolbar(),
      el('div', { class: 'orbit-map' }, this.#svg(), this.#panel()),
    );
    this.#place();
    this.#loop();
  }

  showThread(threadId) {
    this.#threadId = threadId;
    if (this.#data) this.render(this.#data);
  }

  get #running() {
    return (
      !this.#paused &&
      !this.#holding &&
      !this.#selectedId &&
      document.visibilityState === 'visible' &&
      !this.#root.hidden &&
      Boolean(this.#scene?.svg.isConnected)
    );
  }

  // One animation frame per screen refresh while running; nothing at all while still.
  #loop() {
    if (!this.#running) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
      this.#lastFrame = null;
      return;
    }
    if (this.#frame) return;
    const tick = (now) => {
      this.#frame = null;
      if (!this.#running) return this.#loop();
      if (this.#lastFrame !== null) this.#time += (now - this.#lastFrame) / 1000;
      this.#lastFrame = now;
      this.#place();
      this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }

  #select(entryId) {
    this.#selectedId = entryId;
    this.render(this.#data);
    if (entryId) this.#root.querySelector(`[data-entry="${CSS.escape(entryId)}"]`)?.focus();
  }

  #empty() {
    return el(
      'div',
      { class: 'empty-state' },
      icon('globe', { size: 32, className: 'empty-state__icon' }),
      el('h3', { class: 'empty-state__title' }, 'Nothing in orbit yet'),
      el(
        'p',
        { class: 'muted' },
        'Papers you save will circle your question here, closer the more relevant they are.',
      ),
      el(
        'button',
        { class: 'btn btn--primary', type: 'button', on: { click: this.#handlers.onFindPapers } },
        icon('search', { size: 16 }),
        'Find papers',
      ),
    );
  }

  #toolbar() {
    const { threads } = this.#data;
    const legendItem = (className, text) =>
      el('li', {}, el('span', { class: `orbit-legend__swatch ${className}` }), text);
    return el(
      'div',
      { class: 'orbit-toolbar' },
      el(
        'div',
        { class: 'orbit-toolbar__controls' },
        el(
          'button',
          {
            class: 'btn btn--ghost btn--sm',
            type: 'button',
            'aria-pressed': String(!this.#paused),
            on: {
              click: () => {
                this.#paused = !this.#paused;
                this.render(this.#data);
              },
            },
          },
          this.#paused ? '▶ Play orbit' : '❚❚ Pause orbit',
        ),
        threads.length > 0 &&
          el(
            'label',
            { class: 'list-toolbar__sort' },
            el('span', { class: 'muted' }, 'Thread'),
            el(
              'select',
              {
                class: 'select select--sm',
                on: { change: (event) => this.showThread(event.target.value) },
              },
              el('option', { value: '' }, 'None'),
              threads.map((thread) =>
                el(
                  'option',
                  { value: thread.id, selected: thread.id === this.#threadId },
                  thread.title,
                ),
              ),
            ),
          ),
      ),
      el(
        'ul',
        { class: 'orbit-legend', 'aria-label': 'Legend' },
        legendItem('is-read', 'Read'),
        legendItem('is-reading', 'Reading'),
        legendItem('is-to-read', 'To read'),
        legendItem('is-citation', 'A → B: A cites B'),
        this.#threadId && legendItem('is-thread', 'Thread'),
      ),
    );
  }

  // Builds the SVG once per render; #place() moves its pieces on every frame.
  #svg() {
    const { review, entries, index, threads } = this.#data;
    const byId = new Map(entries.map((entry) => [entry._id, entry]));
    const order = ringOrder(entries, index);
    const crowded = entries.length > 40;
    const thread = threads.find((t) => t.id === this.#threadId);
    const threadIds = thread ? thread.entryIds.filter((id) => byId.has(id)) : [];
    const selected = this.#selectedId;
    const selectedLinks = selected ? index.get(selected) : null;

    const bodies = new Map(
      order.map((id, i) => {
        const entry = byId.get(id);
        const radius = orbitRadius(entry.relevance);
        return [
          id,
          {
            entry,
            radius,
            size: dotSize(entry.paper.citedByCount, crowded),
            // Half a step off the top, so the band labels there stay clear at the start.
            start: ((i + 0.5) / order.length) * 2 * Math.PI - Math.PI / 2,
            speed: angularSpeed(radius),
          },
        ];
      }),
    );

    const bands = svgEl(
      'g',
      { class: 'orbit-bands', 'aria-hidden': 'true' },
      [...BANDS].reverse().map(({ stars, label }) => [
        svgEl('circle', {
          class: `orbit-band orbit-band--${stars}`,
          cx: CENTER,
          cy: CENTER,
          r: orbitRadius(stars) + 14,
        }),
        svgEl(
          'text',
          { class: 'orbit-band__label', x: CENTER, y: CENTER - orbitRadius(stars) - 18 },
          label,
        ),
      ]),
    );

    const edges = [...index].flatMap(([from, links]) =>
      links.cites
        .filter((to) => bodies.has(from) && bodies.has(to))
        .map((to) => {
          const kind = from === selected ? 'out' : to === selected ? 'in' : null;
          const path = svgEl('path', {
            class: ['orbit-edge', kind && `is-${kind}`, selected && !kind && 'is-faded'],
            'marker-end': `url(#orbit-arrow${kind ? `-${kind}` : ''})`,
          });
          return { from, to, path };
        }),
    );

    const threadLine = threadIds.length > 1 ? svgEl('polyline', { class: 'orbit-thread' }) : null;

    const sun = svgEl(
      'g',
      { class: 'orbit-sun', 'aria-hidden': 'true' },
      svgEl('circle', { class: 'orbit-sun__glow', cx: CENTER, cy: CENTER, r: SUN * 1.9 }),
      svgEl('circle', { class: 'orbit-sun__core', cx: CENTER, cy: CENTER, r: SUN }),
      questionLines(review.question).map((line, i, lines) =>
        svgEl('text', { x: CENTER, y: CENTER + (i - (lines.length - 1) / 2) * 15 + 4 }, line),
      ),
    );

    const nodes = order.map((id) => {
      const body = bodies.get(id);
      const { entry, size } = body;
      const step = threadIds.indexOf(id);
      const linked = Boolean(
        selectedLinks && (selectedLinks.cites.includes(id) || selectedLinks.citedBy.includes(id)),
      );
      const label =
        id === selected || linked
          ? svgEl(
              'text',
              { class: 'orbit-node__label', y: 4 },
              truncate(entry.paper.title, LABEL_LENGTH),
            )
          : null;
      const group = svgEl(
        'a',
        {
          class: [
            'orbit-node',
            `orbit-node--${entry.status}`,
            id === selected && 'is-selected',
            linked && 'is-linked',
            selected && !linked && id !== selected && 'is-faded',
          ],
          href: `#entry-${id}`,
          'data-entry': id,
          'aria-label': `${entry.paper.title}. ${labelOf(STATUSES, entry.status)}, relevance ${entry.relevance} of ${LIMITS.relevanceMax}`,
          on: {
            // Pointing at a paper holds the orbit still so it is easy to click.
            pointerenter: () => this.#hold(true),
            pointerleave: () => this.#hold(false),
            click: (event) => {
              event.preventDefault();
              this.#select(id === selected ? null : id);
            },
          },
        },
        svgEl('title', {}, entry.paper.title),
        id === selected && svgEl('circle', { class: 'orbit-node__halo', r: size + 6 }),
        svgEl('circle', {
          class: 'orbit-node__dot',
          r: size,
          style: FILL[entry.status] ? { fill: FILL[entry.status] } : undefined,
        }),
        step >= 0 && svgEl('text', { class: 'orbit-node__step', y: 4 }, String(step + 1)),
        label,
      );
      body.group = group;
      body.label = label;
      return group;
    });

    const svg = svgEl(
      'svg',
      {
        class: 'orbit-svg',
        viewBox: `0 0 ${SIZE} ${SIZE}`,
        role: 'group',
        'aria-label': `Map of ${entries.length} papers around your question. The reading list shows the same papers as a list.`,
        on: {
          focusin: () => this.#hold(true),
          focusout: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) this.#hold(false);
          },
        },
      },
      defs(),
      starfield(),
      bands,
      edges.map((edge) => edge.path),
      threadLine,
      sun,
      nodes,
    );
    this.#scene = { svg, bodies, edges, threadLine, threadIds };
    return svg;
  }

  #hold(holding) {
    this.#holding = holding;
    this.#loop();
  }

  // Positions every paper for the current time, then the links and thread that join them.
  #place() {
    if (!this.#scene) return;
    const { bodies, edges, threadLine, threadIds } = this.#scene;
    for (const body of bodies.values()) {
      const angle = body.start + body.speed * this.#time;
      body.x = CENTER + body.radius * Math.cos(angle);
      body.y = CENTER + body.radius * Math.sin(angle);
      body.group.setAttribute('transform', `translate(${body.x.toFixed(1)} ${body.y.toFixed(1)})`);
      if (body.label) {
        // Labels sit on the outer side of their dot, unless that would run off the map.
        const width = body.label.textContent.length * LABEL_CHAR;
        const fitsLeft = body.x - body.size - 8 - width >= 4;
        const fitsRight = body.x + body.size + 8 + width <= SIZE - 4;
        const right = body.x >= CENTER ? fitsRight || !fitsLeft : !fitsLeft && fitsRight;
        body.label.setAttribute('x', String(right ? body.size + 8 : -body.size - 8));
        body.label.setAttribute('text-anchor', right ? 'start' : 'end');
      }
    }
    for (const { from, to, path } of edges) {
      const a = bodies.get(from);
      const b = bodies.get(to);
      const cx = (a.x + b.x) / 2 + (CENTER - (a.x + b.x) / 2) * BEND;
      const cy = (a.y + b.y) / 2 + (CENTER - (a.y + b.y) / 2) * BEND;
      // Stop the line at the edge of the cited paper's dot, so the arrowhead stays visible.
      const dx = b.x - cx;
      const dy = b.y - cy;
      const gap = (b.size + 3) / Math.hypot(dx, dy);
      const end = `${(b.x - dx * gap).toFixed(1)} ${(b.y - dy * gap).toFixed(1)}`;
      path.setAttribute(
        'd',
        `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${end}`,
      );
    }
    threadLine?.setAttribute(
      'points',
      threadIds
        .map((id) => `${bodies.get(id).x.toFixed(1)},${bodies.get(id).y.toFixed(1)}`)
        .join(' '),
    );
  }

  #panel() {
    const { entries, index } = this.#data;
    const entry = entries.find((e) => e._id === this.#selectedId);
    if (!entry) {
      return el(
        'aside',
        { class: 'orbit-panel', 'aria-live': 'polite' },
        el('p', { class: 'orbit-panel__hint' }, 'Pick a paper on the map.'),
        el(
          'ul',
          { class: 'orbit-panel__keys muted' },
          el('li', {}, 'Closer to the centre: more relevant to your question (5★ core, 1★ edge).'),
          el('li', {}, 'Green: read. Purple: reading. Hollow: to read. Bigger: more cited.'),
          el('li', {}, 'An arrow from A to B means A cites B.'),
          el('li', {}, 'Papers orbit slowly; hover, or pause, to hold them still.'),
        ),
      );
    }
    const byId = new Map(entries.map((e) => [e._id, e]));
    const links = index.get(entry._id) ?? { cites: [], citedBy: [] };
    const linkList = (heading, className, ids) =>
      el(
        'div',
        { class: ['orbit-panel__links', className] },
        el('h4', {}, heading),
        ids.length
          ? el(
              'ul',
              {},
              ids
                .filter((id) => byId.has(id))
                .map((id) =>
                  el(
                    'li',
                    {},
                    el(
                      'button',
                      {
                        class: 'citation-link',
                        type: 'button',
                        on: { click: () => this.#select(id) },
                      },
                      byId.get(id).paper.title,
                    ),
                  ),
                ),
            )
          : el('p', { class: 'muted' }, 'None in this review'),
      );
    const ring = BANDS.find((band) => entry.relevance >= band.stars)?.label ?? '1★ edge';

    return el(
      'aside',
      { class: 'orbit-panel', 'aria-live': 'polite' },
      el(
        'p',
        { class: 'paper-card__meta' },
        el('span', { class: 'mono' }, String(entry.paper.year)),
        el('span', {}, `${entry.paper.citedByCount.toLocaleString()} citations`),
      ),
      el('h3', { class: 'orbit-panel__title' }, entry.paper.title),
      el(
        'dl',
        { class: 'orbit-panel__facts' },
        el('dt', {}, 'Status'),
        el('dd', {}, labelOf(STATUSES, entry.status)),
        el('dt', {}, 'Relevance'),
        el('dd', {}, `★ ${entry.relevance} / ${LIMITS.relevanceMax} · ${ring} ring`),
        el('dt', {}, 'Role'),
        el('dd', {}, labelOf(RELATIONS, entry.relation)),
      ),
      entry.notes && el('p', { class: 'orbit-panel__notes' }, entry.notes),
      linkList('This paper cites →', 'is-out', links.cites),
      linkList('← Cited by', 'is-in', links.citedBy),
      el(
        'div',
        { class: 'orbit-panel__actions' },
        el(
          'button',
          {
            class: 'btn btn--primary btn--sm',
            type: 'button',
            on: { click: () => this.#handlers.onOpenEntry(entry._id) },
          },
          'Edit in reading list',
        ),
        el(
          'button',
          {
            class: 'link-btn',
            type: 'button',
            on: { click: () => this.#handlers.onFindCiting(entry._id) },
          },
          icon('search', { size: 14 }),
          'Find citing papers',
        ),
        el(
          'a',
          {
            class: 'icon-btn icon-btn--sm',
            href: paperUrl(entry.paper),
            target: '_blank',
            rel: 'noopener noreferrer',
            'aria-label': `Open ${entry.paper.title} (new tab)`,
            title: 'Open paper',
          },
          icon('external', { size: 14 }),
        ),
      ),
    );
  }
}
