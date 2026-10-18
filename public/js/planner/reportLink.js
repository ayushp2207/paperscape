import { api, ApiError } from '../shared/api.js';
import { el } from '../shared/dom.js';
import { openDialog, showFieldErrors, toast } from '../shared/ui.js';

const REASONS = [
  { value: 'not-loading', label: "The site doesn't load" },
  { value: 'wrong-page', label: 'It opens the wrong page' },
  { value: 'outdated', label: 'It points to an old edition' },
  { value: 'other', label: 'Something else' },
];

// Small dialog that flags a conference's website link for review.
export function reportBrokenLink(conference) {
  const form = el(
    'form',
    { class: 'dialog__body form', method: 'dialog' },
    el(
      'div',
      { class: 'dialog__header' },
      el('h2', { class: 'dialog__title', id: 'report-title' }, 'Report a broken link'),
    ),
    el(
      'p',
      { class: 'muted' },
      `${conference.acronym} ${conference.year}: `,
      el('span', { class: 'report-url' }, conference.website),
    ),
    el(
      'fieldset',
      { class: 'field' },
      el('legend', {}, 'What is wrong?'),
      REASONS.map(({ value, label }, i) =>
        el(
          'label',
          { class: 'check' },
          el('input', { type: 'radio', name: 'reason', value, required: true, checked: i === 0 }),
          label,
        ),
      ),
    ),
    el(
      'div',
      { class: 'field' },
      el('label', { for: 'report-note' }, 'Details (optional)'),
      el('textarea', {
        class: 'textarea',
        id: 'report-note',
        name: 'note',
        maxlength: '500',
        placeholder: 'e.g. the correct link, if you know it',
      }),
    ),
    el(
      'div',
      { class: 'dialog__actions' },
      el('button', { class: 'btn btn--ghost', value: 'cancel', formnovalidate: true }, 'Cancel'),
      el('button', { class: 'btn btn--primary', type: 'submit', value: 'send' }, 'Send report'),
    ),
  );
  const dialog = el(
    'dialog',
    { class: 'dialog dialog--small', 'aria-labelledby': 'report-title' },
    form,
  );

  form.addEventListener('submit', async (event) => {
    if (event.submitter?.value === 'cancel') return; // let method="dialog" close it
    event.preventDefault();
    try {
      await api.post('/reports', {
        conferenceId: conference._id,
        reason: form.elements.reason.value,
        note: form.elements.note.value.trim() || null,
      });
      dialog.close();
      toast("Thanks! We'll check that link.", 'success');
    } catch (err) {
      if (err instanceof ApiError && err.details) showFieldErrors(form, err.details);
      else toast(err.message, 'error');
    }
  });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  openDialog(dialog);
}
