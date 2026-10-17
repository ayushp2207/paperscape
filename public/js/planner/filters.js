import { AREAS } from '../shared/areas.js';
import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';

const SEARCH_DEBOUNCE_MS = 250;
const MONTHS_AHEAD = 12;

function monthOptions(now = new Date()) {
  const label = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const options = [el('option', { value: '' }, 'Any month')];
  for (let i = 0; i < MONTHS_AHEAD; i += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const value = date.toISOString().slice(0, 7);
    options.push(el('option', { value }, label.format(date)));
  }
  return options;
}

// Wires the filter form; calls onChange(filters) whenever a filter changes.
export function initFilters(form, { onChange }) {
  const filters = { q: '', month: '', past: false, areas: new Set() };
  const search = form.elements.q;
  const month = form.elements.month;
  const past = form.elements.past;
  const areaList = form.querySelector('#filter-areas');

  search.before(icon('search', { size: 16 }));
  month.replaceChildren(...monthOptions());

  const chips = AREAS.map((area) =>
    el(
      'button',
      {
        class: 'chip',
        type: 'button',
        'aria-pressed': 'false',
        dataset: { area: area.id },
        style: { color: `var(--area-${area.id})` },
        on: {
          click: (event) => {
            const chip = event.currentTarget;
            const active = chip.getAttribute('aria-pressed') !== 'true';
            chip.setAttribute('aria-pressed', String(active));
            if (active) filters.areas.add(area.id);
            else filters.areas.delete(area.id);
            onChange(filters);
          },
        },
      },
      el('span', { class: 'chip__dot' }),
      el('span', { class: 'chip__label' }, area.label),
    ),
  );
  areaList.replaceChildren(...chips);

  let searchTimer;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filters.q = search.value.trim();
      onChange(filters);
    }, SEARCH_DEBOUNCE_MS);
  });
  month.addEventListener('change', () => {
    filters.month = month.value;
    onChange(filters);
  });
  past.addEventListener('change', () => {
    filters.past = past.checked;
    onChange(filters);
  });
  form.addEventListener('submit', (event) => event.preventDefault());

  return {
    filters,
    isActive: () => Boolean(filters.q || filters.month || filters.past || filters.areas.size),
    reset() {
      form.reset();
      Object.assign(filters, { q: '', month: '', past: false });
      filters.areas.clear();
      chips.forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
      onChange(filters);
    },
  };
}

export function toQueryParams(filters) {
  return {
    q: filters.q,
    month: filters.month,
    past: filters.past ? 'true' : undefined,
    area: [...filters.areas],
  };
}
