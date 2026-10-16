import { el } from './dom.js';
import { icon } from './icons.js';

const TOAST_MS = 4000;

export function toast(message, type = 'info') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const close = el(
    'button',
    { class: 'toast__close', type: 'button', 'aria-label': 'Dismiss' },
    icon('x', { size: 16 }),
  );
  const node = el(
    'div',
    { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status' },
    el('p', {}, message),
    close,
  );
  const remove = () => node.remove();
  close.addEventListener('click', remove);
  region.append(node);
  setTimeout(remove, TOAST_MS);
}

export function openDialog(dialog) {
  if (!dialog.dataset.wired) {
    // Clicking the backdrop (the dialog element itself, outside its content) closes it.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close('cancel');
    });
    dialog.dataset.wired = 'true';
  }
  dialog.showModal();
}

export function closeDialog(dialog, returnValue) {
  dialog.close(returnValue);
}

export function confirmDialog({ title, message, confirmText = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    const dialog = el(
      'dialog',
      { class: 'dialog dialog--small', 'aria-labelledby': 'confirm-title' },
      el(
        'form',
        { method: 'dialog', class: 'dialog__body' },
        el('h2', { id: 'confirm-title', class: 'dialog__title' }, title),
        el('p', { class: 'muted' }, message),
        el(
          'div',
          { class: 'dialog__actions' },
          el('button', { class: 'btn btn--ghost', value: 'cancel' }, 'Cancel'),
          el(
            'button',
            { class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, value: 'confirm' },
            confirmText,
          ),
        ),
      ),
    );
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm');
      dialog.remove();
    });
    document.body.append(dialog);
    openDialog(dialog);
  });
}

export function emptyState({ iconName = 'inbox', title, text, actionLabel, onAction }) {
  return el(
    'div',
    { class: 'empty-state' },
    icon(iconName, { size: 32, className: 'empty-state__icon' }),
    el('h3', { class: 'empty-state__title' }, title),
    text && el('p', { class: 'muted' }, text),
    actionLabel &&
      el(
        'button',
        { class: 'btn btn--primary', type: 'button', on: { click: onAction } },
        icon('plus'),
        actionLabel,
      ),
  );
}

export function skeleton(count = 3, variant = 'card') {
  return el(
    'div',
    {
      class: `skeleton-group skeleton-group--${variant}`,
      'aria-busy': 'true',
      'aria-label': 'Loading',
    },
    Array.from({ length: count }, () => el('div', { class: `skeleton skeleton--${variant}` })),
  );
}

export function errorState(message, onRetry) {
  return el(
    'div',
    { class: 'empty-state empty-state--error', role: 'alert' },
    icon('alert', { size: 32, className: 'empty-state__icon' }),
    el('h3', { class: 'empty-state__title' }, 'Something went wrong'),
    el('p', { class: 'muted' }, message),
    onRetry &&
      el(
        'button',
        { class: 'btn btn--ghost', type: 'button', on: { click: onRetry } },
        'Try again',
      ),
  );
}

export function clearFieldErrors(form) {
  form.querySelectorAll('.field-error').forEach((node) => node.remove());
  form.querySelectorAll('[aria-invalid]').forEach((node) => node.removeAttribute('aria-invalid'));
}

// Maps server `details` ({ field: message }) onto inputs with matching name attributes.
export function showFieldErrors(form, details = {}) {
  clearFieldErrors(form);
  let first;
  for (const [field, message] of Object.entries(details)) {
    const input = form.querySelector(`[name="${CSS.escape(field)}"]`);
    if (!input) continue;
    const errorId = `${input.id || field}-error`;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', errorId);
    (input.closest('.field') ?? input.parentElement).append(
      el('p', { class: 'field-error', id: errorId }, message),
    );
    first ??= input;
  }
  first?.focus();
}
