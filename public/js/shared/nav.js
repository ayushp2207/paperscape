import { icon } from './icons.js';

const THEME_KEY = 'paperscape.theme';

function currentTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function renderThemeButton(button) {
  const theme = currentTheme();
  button.replaceChildren(icon(theme === 'dark' ? 'sun' : 'moon'));
  button.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
  );
}

function initTheme() {
  const button = document.getElementById('theme-toggle');
  if (!button) return;
  renderThemeButton(button);
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage unavailable (private mode); the theme still applies for this page view.
    }
    renderThemeButton(button);
  });
}

function initActiveLink() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const current = page === 'review.html' ? 'reviews.html' : page;
  document.querySelectorAll('.site-nav a').forEach((link) => {
    if (link.getAttribute('href') === current) link.setAttribute('aria-current', 'page');
  });
}

function initMobileMenu() {
  const button = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!button || !nav) return;
  button.replaceChildren(icon('menu'));
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });
}

initTheme();
initActiveLink();
initMobileMenu();
