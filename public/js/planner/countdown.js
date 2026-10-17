import { el } from '../shared/dom.js';
import { countdown, urgency } from '../shared/format.js';
import { icon } from '../shared/icons.js';

const TICK_MS = 60_000;

function update(chip) {
  const date = chip.dataset.countdown;
  chip.className = `countdown countdown--${urgency(date)}`;
  chip.replaceChildren(icon('clock', { size: 14 }), countdown(date).label);
}

export function countdownChip(date) {
  const chip = el('span', { dataset: { countdown: new Date(date).toISOString() } });
  update(chip);
  return chip;
}

// One interval per page refreshes every chip currently in the DOM.
export function startCountdownTicker(root = document) {
  return setInterval(() => root.querySelectorAll('[data-countdown]').forEach(update), TICK_MS);
}
