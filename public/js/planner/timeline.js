import { el, svgEl } from '../shared/dom.js';
import { formatDate, formatDateRange } from '../shared/format.js';
import { DEADLINES } from './deadlines.js';

const LABEL_WIDTH = 132;
const AXIS_HEIGHT = 46;
const ROW_HEIGHT = 30;
const RIGHT_PAD = 16;
const MIN_CHART_WIDTH = 760;
const MARK = 5; // half-size of deadline markers (≥ 8px marks)

// Visible window: start of last month → 12 months ahead.
function timeWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 12, 1));
  return { start, end };
}

const MARK_TYPES = {
  abstract: { label: 'Abstract deadline', shape: 'diamond-outline' },
  paper: { label: 'Paper deadline', shape: 'diamond' },
  notification: { label: 'Notification', shape: 'circle' },
  cameraReady: { label: 'Camera-ready', shape: 'square' },
};

function marker(shape, x, y) {
  if (shape === 'circle')
    return svgEl('circle', { class: 'tl-mark tl-mark--circle', cx: x, cy: y, r: MARK - 1 });
  if (shape === 'square') {
    return svgEl('rect', {
      class: 'tl-mark tl-mark--square',
      x: x - MARK + 1,
      y: y - MARK + 1,
      width: 2 * MARK - 2,
      height: 2 * MARK - 2,
      rx: 1,
    });
  }
  const points = `${x},${y - MARK - 1} ${x + MARK + 1},${y} ${x},${y + MARK + 1} ${x - MARK - 1},${y}`;
  return svgEl('polygon', {
    class: ['tl-mark', shape === 'diamond-outline' ? 'tl-mark--outline' : 'tl-mark--diamond'],
    points,
  });
}

function legend() {
  const sample = (shape) =>
    svgEl(
      'svg',
      {
        class: 'tl-legend__swatch',
        width: 16,
        height: 16,
        viewBox: '0 0 16 16',
        'aria-hidden': 'true',
      },
      shape === 'bar'
        ? svgEl('rect', { class: 'tl-span', x: 1, y: 5, width: 14, height: 6, rx: 3 })
        : marker(shape, 8, 8),
    );
  return el(
    'ul',
    { class: 'tl-legend', 'aria-label': 'Timeline marks' },
    Object.values(MARK_TYPES).map(({ label, shape }) => el('li', {}, sample(shape), label)),
    el('li', {}, sample('bar'), 'Conference'),
  );
}

function tooltipRows(conf) {
  const rows = DEADLINES.map(({ key, label }) => [label, conf.deadlines?.[key]])
    .filter(([, date]) => date)
    .map(([label, date]) => [formatDate(date, { aoe: true }), label]);
  if (conf.startDate) rows.push([formatDateRange(conf.startDate, conf.endDate), 'Conference']);
  return rows;
}

const hasDates = (conf) =>
  Boolean(conf.startDate) || DEADLINES.some(({ key }) => conf.deadlines?.[key]);

// Any deadline inside the window, or a conference span overlapping it.
function overlapsWindow(conf, start, end) {
  const inside = (date) => date && new Date(date) >= start && new Date(date) < end;
  if (DEADLINES.some(({ key }) => inside(conf.deadlines?.[key]))) return true;
  if (!conf.startDate) return false;
  return new Date(conf.startDate) < end && new Date(conf.endDate ?? conf.startDate) >= start;
}

// Draws one row per conference with dates in the window; the rest are summarised underneath.
export function renderTimeline(container, conferences, { selectedId, onSelect }) {
  const { start, end } = timeWindow();
  const dated = conferences.filter((conf) => hasDates(conf) && overlapsWindow(conf, start, end));
  const undated = conferences.filter((conf) => !hasDates(conf));
  const outside = conferences.length - dated.length - undated.length;

  const scroller = el('div', { class: 'tl-scroll' });
  const stage = el('div', { class: 'tl-stage' }, scroller);
  const tooltip = el('div', { class: 'tl-tooltip', role: 'tooltip', hidden: true });
  stage.append(tooltip);

  container.replaceChildren(
    legend(),
    stage,
    undated.length > 0 &&
      el(
        'p',
        { class: 'muted tl-note' },
        `Dates TBD: ${undated.map((conf) => `${conf.acronym} ${conf.year}`).join(', ')}`,
      ),
    outside > 0 &&
      el(
        'p',
        { class: 'muted tl-note' },
        `${outside} conference${outside === 1 ? '' : 's'} outside ${formatDate(start)} – ${formatDate(end)} (see List view)`,
      ),
  );

  function draw() {
    const width = Math.max(MIN_CHART_WIDTH, scroller.clientWidth);
    const plotLeft = LABEL_WIDTH;
    const plotRight = width - RIGHT_PAD;
    const height = AXIS_HEIGHT + dated.length * ROW_HEIGHT + 8;
    const x = (date) =>
      plotLeft + ((new Date(date) - start) / (end - start)) * (plotRight - plotLeft);
    const inWindow = (date) => date && new Date(date) >= start && new Date(date) < end;

    const svg = svgEl('svg', {
      class: 'tl-svg',
      width,
      height,
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': `Timeline of ${dated.length} conferences from ${formatDate(start)} to ${formatDate(end)}`,
    });
    svg.append(
      svgEl(
        'defs',
        {},
        svgEl(
          'clipPath',
          { id: 'tl-clip' },
          svgEl('rect', { x: plotLeft, y: 0, width: plotRight - plotLeft, height }),
        ),
      ),
    );

    // Month gridlines + labels.
    const grid = svgEl('g', { class: 'tl-grid' });
    for (
      let m = new Date(start);
      m < end;
      m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))
    ) {
      const gx = x(m);
      const next = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1));
      const label =
        m.getUTCMonth() === 0 || gx === plotLeft
          ? `${m.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${m.getUTCFullYear()}`
          : m.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      grid.append(
        svgEl('line', { class: 'tl-gridline', x1: gx, x2: gx, y1: AXIS_HEIGHT - 6, y2: height }),
        svgEl('text', { class: 'tl-month', x: (gx + x(next)) / 2, y: 18 }, label),
      );
    }
    svg.append(grid);

    // Rows.
    const rows = svgEl('g', { class: 'tl-rows' });
    dated.forEach((conf, i) => {
      const top = AXIS_HEIGHT + i * ROW_HEIGHT;
      const cy = top + ROW_HEIGHT / 2;
      const selected = conf._id === selectedId;
      const marks = svgEl('g', {
        'clip-path': 'url(#tl-clip)',
        style: { color: `var(--area-${conf.areas[0]})` },
      });

      const paper = conf.deadlines?.paper ?? conf.deadlines?.abstract;
      if (paper && conf.startDate) {
        marks.append(
          svgEl('line', { class: 'tl-link', x1: x(paper), x2: x(conf.startDate), y1: cy, y2: cy }),
        );
      }
      if (conf.startDate) {
        const sx = x(conf.startDate);
        const ex = Math.max(x(conf.endDate ?? conf.startDate) + 2, sx + 6);
        marks.append(
          svgEl('rect', { class: 'tl-span', x: sx, y: cy - 5, width: ex - sx, height: 10, rx: 4 }),
        );
      }
      for (const { key } of DEADLINES) {
        const date = conf.deadlines?.[key];
        if (inWindow(date)) marks.append(marker(MARK_TYPES[key].shape, x(date), cy));
      }

      const row = svgEl(
        'g',
        {
          class: ['tl-row', selected && 'is-selected'],
          role: 'button',
          tabindex: '0',
          'aria-pressed': String(selected),
          'aria-label': `${conf.acronym} ${conf.year}: ${tooltipRows(conf)
            .map(([value, label]) => `${label} ${value}`)
            .join(', ')}`,
        },
        // Hit target is the whole row, not just the marks.
        svgEl('rect', { class: 'tl-row__hit', x: 0, y: top, width, height: ROW_HEIGHT }),
        svgEl('text', { class: 'tl-row__label', x: 12, y: cy + 4 }, `${conf.acronym} ${conf.year}`),
        marks,
      );
      row.addEventListener('click', () => onSelect(conf._id));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(conf._id);
        }
      });
      row.addEventListener('pointermove', (event) => showTooltip(conf, event.clientX, top));
      row.addEventListener('focus', () => showTooltip(conf, null, top));
      row.addEventListener('pointerleave', hideTooltip);
      row.addEventListener('blur', hideTooltip);
      rows.append(row);
    });
    svg.append(rows);

    // Today line on top of everything.
    const now = new Date();
    if (inWindow(now)) {
      const tx = x(now);
      svg.append(
        svgEl(
          'g',
          { class: 'tl-today' },
          svgEl('line', { x1: tx, x2: tx, y1: AXIS_HEIGHT - 6, y2: height }),
          svgEl('text', { x: tx, y: AXIS_HEIGHT - 9 }, 'Today'),
        ),
      );
    }

    scroller.replaceChildren(svg);
  }

  function showTooltip(conf, clientX, rowTop) {
    tooltip.replaceChildren(
      el('p', { class: 'tl-tooltip__title' }, `${conf.acronym} ${conf.year}`),
      ...tooltipRows(conf).map(([value, label]) =>
        el('p', {}, el('strong', {}, value), ' ', el('span', { class: 'muted' }, label)),
      ),
    );
    tooltip.hidden = false;
    const stageBox = stage.getBoundingClientRect();
    const left = clientX === null ? LABEL_WIDTH + 40 : clientX - stageBox.left;
    tooltip.style.left = `${Math.min(Math.max(left, 100), stageBox.width - 100)}px`;
    tooltip.style.top = `${rowTop - scroller.scrollTop}px`;
  }
  function hideTooltip() {
    tooltip.hidden = true;
  }

  draw();
  let frame;
  new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }).observe(scroller);
}
