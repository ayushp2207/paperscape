import { areaById } from '../shared/areas.js';
import { el, svgEl } from '../shared/dom.js';
import { countdown, formatDate } from '../shared/format.js';
import { nextDeadline } from './deadlines.js';

// Same equirectangular projection as scripts/build-world-map.js (1000×500 viewBox).
const WIDTH = 1000;
const HEIGHT = 500;
const project = (lat, lng) => [((lng + 180) / 360) * WIDTH, ((90 - lat) / 180) * HEIGHT];

const PIN_RADIUS_PX = 7;
const SPREAD_PX = 11;
const URGENT_DAYS = 14;

let worldSvgText;

async function loadWorld() {
  if (!worldSvgText) {
    const response = await fetch('assets/world.svg');
    if (!response.ok) throw new Error('Could not load the world map');
    worldSvgText = await response.text();
  }
  return worldSvgText;
}

const isUrgent = (conference) => {
  const next = nextDeadline(conference);
  return next && countdown(next.date).days < URGENT_DAYS;
};

// Conferences in the same city get spread on a small circle so every pin stays clickable.
function placePins(conferences, pxToUnits) {
  const groups = new Map();
  for (const conf of conferences) {
    const key = `${conf.location.lat.toFixed(1)},${conf.location.lng.toFixed(1)}`;
    groups.set(key, [...(groups.get(key) ?? []), conf]);
  }
  return [...groups.values()].flatMap((group) =>
    group.map((conf, i) => {
      const [x, y] = project(conf.location.lat, conf.location.lng);
      if (group.length === 1) return { conf, x, y };
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      const r = SPREAD_PX * pxToUnits;
      return { conf, x: x + r * Math.cos(angle), y: y + r * Math.sin(angle) };
    }),
  );
}

function tooltipContent(conf) {
  const next = nextDeadline(conf);
  return [
    el('strong', {}, `${conf.acronym} ${conf.year}`),
    el('span', {}, `${conf.location.city}, ${conf.location.country}`),
    el(
      'span',
      { class: 'muted' },
      next
        ? `${next.label}: ${formatDate(next.date, { aoe: true })} · ${countdown(next.date).label}`
        : conf.startDate
          ? `Conference ${formatDate(conf.startDate)}`
          : 'Dates TBD',
    ),
  ];
}

function legend(conferences) {
  const areaIds = [...new Set(conferences.map((conf) => conf.areas[0]))];
  return el(
    'ul',
    { class: 'map-legend', 'aria-label': 'Pin colours' },
    areaIds.map((id) =>
      el(
        'li',
        {},
        el('span', { class: 'dot', style: { color: `var(--area-${id})` } }),
        areaById(id)?.label ?? id,
      ),
    ),
    el(
      'li',
      {},
      el('span', { class: 'map-legend__urgent' }),
      `Deadline within ${URGENT_DAYS} days`,
    ),
  );
}

// Renders the map into `container`; pins are coloured by each conference's first area.
export async function renderMap(container, conferences, { selectedId, onSelect }) {
  const located = conferences.filter((conf) => conf.location);
  const tbd = conferences.length - located.length;

  const stage = el('div', { class: 'world-map' });
  stage.innerHTML = await loadWorld(); // trusted static asset
  const svg = stage.querySelector('svg');
  const tooltip = el('div', { class: 'map-tooltip', role: 'tooltip', hidden: true });
  stage.append(tooltip);

  container.replaceChildren(
    stage,
    el(
      'div',
      { class: 'map-footer' },
      legend(located),
      tbd > 0 &&
        el(
          'p',
          { class: 'muted map-footer__tbd' },
          `${tbd} conference${tbd === 1 ? '' : 's'} with location TBD (see List view)`,
        ),
    ),
  );

  const pinsLayer = svgEl('g', { class: 'map-pins' });
  svg.append(pinsLayer);

  function showTooltip(pin, conf) {
    tooltip.replaceChildren(...tooltipContent(conf));
    tooltip.hidden = false;
    const pinBox = pin.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    tooltip.style.left = `${pinBox.left + pinBox.width / 2 - stageBox.left}px`;
    tooltip.style.top = `${pinBox.top - stageBox.top}px`;
  }
  const hideTooltip = () => {
    tooltip.hidden = true;
  };

  // Pin sizes are in screen pixels, so recompute when the map is resized.
  function drawPins() {
    const viewBoxWidth = svg.viewBox.baseVal.width || WIDTH;
    const pxToUnits = viewBoxWidth / (svg.clientWidth || viewBoxWidth);
    const radius = PIN_RADIUS_PX * pxToUnits;

    // Selected pin drawn last so it sits on top.
    const pins = placePins(located, pxToUnits).sort(
      (a, b) => (a.conf._id === selectedId) - (b.conf._id === selectedId),
    );
    pinsLayer.replaceChildren(
      ...pins.map(({ conf, x, y }) => {
        const selected = conf._id === selectedId;
        const label = `${conf.acronym} ${conf.year}, ${conf.location.city}`;
        const pin = svgEl(
          'g',
          {
            class: ['map-pin', selected && 'is-selected', isUrgent(conf) && 'is-urgent'],
            role: 'button',
            tabindex: '0',
            'aria-label': label,
            'aria-pressed': String(selected),
            style: { color: `var(--area-${conf.areas[0]})` },
          },
          svgEl('circle', { class: 'map-pin__pulse', cx: x, cy: y, r: radius }),
          svgEl('circle', {
            class: 'map-pin__dot',
            cx: x,
            cy: y,
            r: selected ? radius * 1.5 : radius,
            'stroke-width': 2 * pxToUnits,
          }),
        );
        pin.addEventListener('click', () => onSelect(conf._id));
        pin.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(conf._id);
          }
        });
        pin.addEventListener('mouseenter', () => showTooltip(pin, conf));
        pin.addEventListener('focus', () => showTooltip(pin, conf));
        pin.addEventListener('mouseleave', hideTooltip);
        pin.addEventListener('blur', hideTooltip);
        return pin;
      }),
    );
  }

  drawPins();
  new ResizeObserver(() => drawPins()).observe(svg);
}
