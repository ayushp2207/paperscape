import { api } from '../shared/api.js';
import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { closeDialog, openDialog, showFieldErrors, toast } from '../shared/ui.js';
import { LINK_REPORT_REASONS } from './vocab.js';

// Where a paper's main link goes: its DOI (the publisher) when known, else its OpenAlex page.
export const paperUrl = (paper) => paper.doi ?? paper.openalexUrl;

// A second way in when the DOI link is down: the paper's OpenAlex page.
export function backupLink(paper) {
  if (!paper.doi) return null;
  return el(
    'a',
    {
      class: 'link-btn',
      href: paper.openalexUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': `${paper.title} on OpenAlex (new tab)`,
    },
    icon('external', { size: 14 }),
    'OpenAlex page',
  );
}

// Asks what is wrong with the link, then sends one report. The dialog removes itself on close.
function openReport(paper) {
  const form = el(
    'form',
    {
      class: 'dialog__body',
      novalidate: true,
      on: {
        submit: async (event) => {
          event.preventDefault();
          const reason = form.elements.reason.value;
          if (!reason) {
            showFieldErrors(form, { reason: 'Pick what is wrong with the link' });
            return;
          }
          try {
            await api.post(`/papers/${paper._id}/report-link`, { reason });
            closeDialog(dialog);
            toast('Thanks, the link has been reported', 'success');
          } catch (err) {
            toast(err.message, 'error');
          }
        },
      },
    },
    el('h2', { class: 'dialog__title', id: 'report-title' }, 'Report a broken link'),
    el('p', { class: 'muted' }, paper.title),
    el(
      'fieldset',
      { class: 'field report-reasons' },
      el('legend', {}, 'What happens when you open it?'),
      LINK_REPORT_REASONS.map((reason, i) =>
        el(
          'label',
          { class: 'check' },
          el('input', { type: 'radio', name: 'reason', value: reason.id, checked: i === 0 }),
          el('span', {}, reason.label),
        ),
      ),
    ),
    el(
      'div',
      { class: 'dialog__actions' },
      el(
        'button',
        { class: 'btn btn--ghost', type: 'button', on: { click: () => closeDialog(dialog) } },
        'Cancel',
      ),
      el('button', { class: 'btn btn--primary', type: 'submit' }, 'Send report'),
    ),
  );
  const dialog = el(
    'dialog',
    { class: 'dialog dialog--small', 'aria-labelledby': 'report-title' },
    form,
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  openDialog(dialog);
}

export function reportLinkButton(paper) {
  return el(
    'button',
    { class: 'link-btn', type: 'button', on: { click: () => openReport(paper) } },
    icon('alert', { size: 14 }),
    'Report broken link',
  );
}
