import { api, ApiError } from '../shared/api.js';
import { el } from '../shared/dom.js';
import { formatDate, toDateInputValue } from '../shared/format.js';
import { icon } from '../shared/icons.js';
import { clearFieldErrors, closeDialog, openDialog, showFieldErrors, toast } from '../shared/ui.js';
import { isPastConference, nextDeadline } from './deadlines.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Default checkpoints, counted back from the target's paper deadline.
const SUGGESTED_MILESTONES = [
  { label: 'Literature review done', daysBefore: 56 },
  { label: 'Experiments done', daysBefore: 28 },
  { label: 'Full draft ready', daysBefore: 14 },
  { label: 'Final polish', daysBefore: 3 },
];

function optionLabel(conference) {
  const name = `${conference.acronym} ${conference.year}`;
  const next = nextDeadline(conference);
  if (next) return `${name} · ${next.label} ${formatDate(next.date, { aoe: true })}`;
  if (conference.startDate) return `${name} · conference ${formatDate(conference.startDate)}`;
  return `${name} · dates TBD`;
}

// One dialog for create and edit. onSaved(plan) runs after a successful save.
export function initPlanForm(dialog, { getConferences, onSaved }) {
  const form = dialog.querySelector('form');
  const title = dialog.querySelector('#plan-dialog-title');
  const submit = dialog.querySelector('#plan-submit');
  const rows = dialog.querySelector('#milestone-rows');
  const target = form.elements.targetConferenceId;
  const backup = form.elements.backupConferenceId;
  let editingId = null;

  // Upcoming conferences, plus whatever the plan already points at (even if it has passed).
  function fillVenueSelects(selected = []) {
    const conferences = getConferences().filter(
      (conf) => !isPastConference(conf) || selected.includes(conf._id),
    );
    const options = () =>
      conferences.map((conf) => el('option', { value: conf._id }, optionLabel(conf)));
    target.replaceChildren(el('option', { value: '' }, 'Choose a conference…'), ...options());
    backup.replaceChildren(el('option', { value: '' }, 'No backup'), ...options());
  }

  // Field names carry the row index so server errors (milestones.2.label) land on the right input.
  function renumber() {
    [...rows.children].forEach((row, i) => {
      const [label, date] = row.querySelectorAll('input');
      label.name = `milestones.${i}.label`;
      label.id = `milestone-${i}-label`;
      date.name = `milestones.${i}.dueDate`;
      date.id = `milestone-${i}-date`;
      row.querySelector('.milestone-row__label-text').htmlFor = label.id;
      row.querySelector('.milestone-row__date-text').htmlFor = date.id;
    });
  }

  function addRow({ id, label = '', dueDate = '', done = false } = {}) {
    const row = el(
      'li',
      { class: 'milestone-row', dataset: { id: id ?? '', done: String(done) } },
      el(
        'div',
        { class: 'field' },
        el('label', { class: 'milestone-row__label-text visually-hidden' }, 'Milestone'),
        el('input', {
          class: 'input',
          value: label,
          maxlength: '100',
          required: true,
          placeholder: 'e.g. Experiments done',
        }),
      ),
      el(
        'div',
        { class: 'field' },
        el('label', { class: 'milestone-row__date-text visually-hidden' }, 'Due date'),
        el('input', { class: 'input', type: 'date', value: dueDate, required: true }),
      ),
      el(
        'button',
        {
          class: 'icon-btn',
          type: 'button',
          'aria-label': 'Remove milestone',
          on: {
            click: () => {
              row.remove();
              renumber();
            },
          },
        },
        icon('trash', { size: 16 }),
      ),
    );
    rows.append(row);
    renumber();
    return row;
  }

  function suggestMilestones() {
    const conference = getConferences().find((conf) => conf._id === target.value);
    if (!conference) {
      toast('Pick a target venue first', 'warning');
      return;
    }
    const deadline = conference.deadlines?.paper ?? conference.deadlines?.abstract;
    if (!deadline) {
      toast(`${conference.acronym} ${conference.year} has no paper deadline yet (TBD)`, 'warning');
      return;
    }
    const existing = new Set(
      [...rows.querySelectorAll('input:not([type="date"])')].map((i) => i.value),
    );
    const added = SUGGESTED_MILESTONES.filter(({ label, daysBefore }) => {
      const due = new Date(new Date(deadline).getTime() - daysBefore * DAY_MS);
      if (due < new Date() || existing.has(label)) return false;
      addRow({ label, dueDate: toDateInputValue(due, { aoe: true }) });
      return true;
    });
    if (added.length === 0) toast('No suggestions left: they would all be in the past', 'info');
  }

  function readPayload() {
    return {
      paperTitle: form.elements.paperTitle.value.trim(),
      targetConferenceId: target.value,
      backupConferenceId: backup.value || null,
      status: form.elements.status.value,
      notes: form.elements.notes.value.trim(),
      milestones: [...rows.children].map((row) => {
        const [label, date] = row.querySelectorAll('input');
        return {
          ...(row.dataset.id ? { id: row.dataset.id } : {}),
          label: label.value.trim(),
          dueDate: date.value,
          done: row.dataset.done === 'true',
        };
      }),
    };
  }

  dialog.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => closeDialog(dialog));
  });
  dialog.querySelector('#add-milestone').addEventListener('click', () => {
    addRow().querySelector('input').focus();
  });
  dialog.querySelector('#suggest-milestones').addEventListener('click', suggestMilestones);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    submit.disabled = true;
    try {
      const payload = readPayload();
      const saved = editingId
        ? await api.put(`/plans/${editingId}`, payload)
        : await api.post('/plans', payload);
      closeDialog(dialog);
      toast(editingId ? 'Plan updated' : 'Plan created', 'success');
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.details) showFieldErrors(form, err.details);
      else toast(err.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  function open(plan, { targetId } = {}) {
    form.reset();
    clearFieldErrors(form);
    rows.replaceChildren();
    editingId = plan?._id ?? null;
    title.textContent = editingId ? 'Edit plan' : 'New plan';
    submit.textContent = editingId ? 'Save changes' : 'Create plan';

    fillVenueSelects(
      [plan?.targetConferenceId, plan?.backupConferenceId, targetId].filter(Boolean),
    );
    if (plan) {
      form.elements.paperTitle.value = plan.paperTitle;
      target.value = plan.targetConferenceId;
      backup.value = plan.backupConferenceId ?? '';
      form.elements.status.value = plan.status;
      form.elements.notes.value = plan.notes ?? '';
      for (const milestone of plan.milestones) {
        addRow({ ...milestone, dueDate: toDateInputValue(milestone.dueDate, { aoe: true }) });
      }
    } else if (targetId) {
      target.value = targetId;
    }
    openDialog(dialog);
    form.elements.paperTitle.focus();
  }

  return { openCreate: (options) => open(null, options), openEdit: (plan) => open(plan) };
}
