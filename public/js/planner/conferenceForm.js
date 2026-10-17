import { api, ApiError } from '../shared/api.js';
import { AREAS } from '../shared/areas.js';
import { el } from '../shared/dom.js';
import { toDateInputValue } from '../shared/format.js';
import { clearFieldErrors, closeDialog, openDialog, showFieldErrors, toast } from '../shared/ui.js';
import { DEADLINES } from './deadlines.js';

const LOCATION_FIELDS = ['city', 'country', 'venue', 'lat', 'lng'];

function readPayload(form) {
  const value = (name) => form.elements[name].value.trim();
  const number = (name) => (value(name) === '' ? undefined : Number(value(name)));

  const hasLocation = LOCATION_FIELDS.some((field) => value(`location.${field}`) !== '');
  return {
    acronym: value('acronym'),
    name: value('name'),
    year: number('year'),
    website: value('website') || null,
    areas: [...form.querySelectorAll('input[name="areas"]:checked')].map((input) => input.value),
    location: hasLocation
      ? {
          city: value('location.city'),
          country: value('location.country'),
          venue: value('location.venue') || null,
          lat: number('location.lat'),
          lng: number('location.lng'),
        }
      : null,
    startDate: value('startDate') || null,
    endDate: value('endDate') || null,
    deadlines: Object.fromEntries(
      DEADLINES.map(({ key }) => [key, value(`deadlines.${key}`) || null]),
    ),
  };
}

function fill(form, conference) {
  const set = (name, val) => {
    form.elements[name].value = val ?? '';
  };
  set('acronym', conference.acronym);
  set('year', conference.year);
  set('name', conference.name);
  set('website', conference.website);
  form.querySelectorAll('input[name="areas"]').forEach((input) => {
    input.checked = conference.areas.includes(input.value);
  });
  for (const field of LOCATION_FIELDS) set(`location.${field}`, conference.location?.[field]);
  set('startDate', toDateInputValue(conference.startDate));
  set('endDate', toDateInputValue(conference.endDate));
  for (const { key } of DEADLINES) {
    set(`deadlines.${key}`, toDateInputValue(conference.deadlines?.[key], { aoe: true }));
  }
}

// One dialog handles both create and edit. onSaved(conference) runs after a successful save.
export function initConferenceForm(dialog, { onSaved }) {
  const form = dialog.querySelector('form');
  const title = dialog.querySelector('#conference-dialog-title');
  const submit = dialog.querySelector('#conference-submit');
  let editingId = null;

  form
    .querySelector('#conf-areas')
    .replaceChildren(
      ...AREAS.map((area) =>
        el(
          'label',
          { class: 'check' },
          el('input', { type: 'checkbox', name: 'areas', value: area.id }),
          el('span', { class: 'dot', style: { color: `var(--area-${area.id})` } }),
          area.label,
        ),
      ),
    );

  dialog.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => closeDialog(dialog));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    const payload = readPayload(form);
    if (payload.areas.length === 0) {
      showFieldErrors(form, { areas: 'Pick at least one research area' });
      return;
    }

    submit.disabled = true;
    try {
      const saved = editingId
        ? await api.put(`/conferences/${editingId}`, payload)
        : await api.post('/conferences', payload);
      closeDialog(dialog);
      toast(editingId ? 'Conference updated' : 'Conference added', 'success');
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.details) showFieldErrors(form, err.details);
      else toast(err.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  function open(conference) {
    form.reset();
    clearFieldErrors(form);
    editingId = conference?._id ?? null;
    title.textContent = editingId
      ? `Edit ${conference.acronym} ${conference.year}`
      : 'Add conference';
    submit.textContent = editingId ? 'Save changes' : 'Add conference';
    if (conference) fill(form, conference);
    else form.elements.year.value = new Date().getFullYear() + 1;
    openDialog(dialog);
    form.elements.acronym.focus();
  }

  return { openCreate: () => open(null), openEdit: (conference) => open(conference) };
}
