// Polite page checks for the conference tracker: identifies itself, honours robots.txt,
// waits between requests to the same host, and never retries aggressively.
import { createHash } from 'node:crypto';

const USER_AGENT = 'PaperscapeBot/1.0 (+https://github.com/ayushp2207/paperscape)';
const TIMEOUT_MS = 20000;
const HOST_DELAY_MS = 1500;

const robotsCache = new Map();
const lastHit = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHost(host) {
  const wait = (lastHit.get(host) ?? 0) + HOST_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

// Disallow rules for "*" or our bot from robots.txt (missing/unreadable robots.txt allows all).
async function disallowedPaths(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let rules = [];
  try {
    await waitForHost(new URL(origin).host);
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) {
      let applies = false;
      for (const raw of (await response.text()).split('\n')) {
        const line = raw.replace(/#.*/, '').trim();
        const [field, ...rest] = line.split(':');
        const value = rest.join(':').trim();
        if (/^user-agent$/i.test(field)) applies = value === '*' || /paperscape/i.test(value);
        else if (applies && /^disallow$/i.test(field) && value) rules.push(value);
      }
    }
  } catch {
    rules = [];
  }
  robotsCache.set(origin, rules);
  return rules;
}

// Visible text only, so layout tweaks or rotating scripts don't count as a change.
export function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|p|div|li|tr|h[1-6]|dt|dd|td|th)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

export const fingerprint = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

// → { status: 'ok' | 'broken' | 'blocked' | 'skipped', httpStatus?, finalUrl?, html?, error? }
// "blocked" (401/403/418/429) usually means bot protection, not a dead link.
export async function checkPage(url) {
  let target;
  try {
    target = new URL(url);
  } catch {
    return { status: 'broken', error: 'invalid URL' };
  }
  const rules = await disallowedPaths(target.origin);
  if (rules.some((rule) => target.pathname.startsWith(rule))) {
    return { status: 'skipped', error: 'disallowed by robots.txt' };
  }
  try {
    await waitForHost(target.host);
    const response = await fetch(target, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const base = { httpStatus: response.status, finalUrl: response.url };
    if ([401, 403, 418, 429].includes(response.status)) return { status: 'blocked', ...base };
    if (!response.ok) return { status: 'broken', ...base };
    return { status: 'ok', ...base, html: await response.text() };
  } catch (err) {
    return { status: 'broken', error: err.name === 'TimeoutError' ? 'timed out' : err.message };
  }
}

// Same-site link to the page that usually holds the dates ("Call for papers", "Important dates").
export function findDatesPageLink(html, pageUrl) {
  const base = new URL(pageUrl);
  for (const [, href, inner] of html.matchAll(
    /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const text = inner.replace(/<[^>]+>/g, ' ').trim();
    if (!/call\s+for\s+papers|important\s+dates|\bcfp\b|submission/i.test(text)) continue;
    try {
      const url = new URL(href, base);
      if (url.host === base.host && url.href !== base.href) return url.href;
    } catch {
      // Ignore malformed hrefs.
    }
  }
  return null;
}
