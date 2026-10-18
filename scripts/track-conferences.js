// Daily conference tracker. Updates scripts/data/conferences.json and tracker-state.json and
// writes a Markdown summary that becomes the body of the single review pull request.
//
// - Series come from scripts/data/series.json; editions from the ccf-deadlines dataset.
// - Official pages are checked every day for editions with a deadline in the next 7 days,
//   and weekly (Mondays, or with --all) for every other upcoming edition.
// - A changed page is scanned for dates; confident changes are applied (and pinned so the
//   dataset doesn't overwrite them), everything else is listed for manual review. Auto-fills
//   only ever fill TBD fields, from edition-specific pages, keeping the dates in order.
// - New editions are discovered through each series' edition URL pattern.
// - Open broken-link reports from the site are listed and resolved when the PR is merged.
//
// Usage: npm run track:conferences [-- --all] [-- --summary <file>]
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { fetchCcfEditions } from './lib/ccf.js';
import { extractDeadlines } from './lib/extract-dates.js';
import { checkPage, findDatesPageLink, fingerprint, htmlToText } from './lib/pages.js';

dotenv.config({ quiet: true });

const DATA_DIR = path.join(import.meta.dirname, 'data');
const FILES = {
  series: path.join(DATA_DIR, 'series.json'),
  conferences: path.join(DATA_DIR, 'conferences.json'),
  cities: path.join(DATA_DIR, 'cities.json'),
  state: path.join(DATA_DIR, 'tracker-state.json'),
};
const DEADLINE_KEYS = ['abstract', 'paper', 'notification', 'cameraReady'];
const PAST_EDITIONS_KEPT = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const forceAll = args.includes('--all');
const summaryPath = args.includes('--summary')
  ? args[args.indexOf('--summary') + 1]
  : path.join(tmpdir(), 'tracker-summary.md');

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (fallback !== undefined && err.code === 'ENOENT') return fallback;
    throw err;
  }
};
const writeJson = (file, data) => writeFile(file, `${JSON.stringify(data, null, 2)}\n`);

// A deadline is a day ("YYYY-MM-DD" = 23:59 AoE) or an exact ISO instant.
const toInstant = (value) =>
  value ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59-12:00` : value) : null;
const aoeDay = (value) =>
  value ? new Date(toInstant(value).getTime() - 12 * 3600 * 1000).toISOString().slice(0, 10) : null;
const sameValue = (field, a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (field.startsWith('deadlines.')) return toInstant(a).getTime() === toInstant(b).getTime();
  return JSON.stringify(a) === JSON.stringify(b);
};
const fillTemplate = (template, year) =>
  template.replaceAll('{year}', String(year)).replaceAll('{yy}', String(year).slice(-2));
const label = (edition) => `${edition.acronym} ${edition.year}`;

const emptyEdition = (series, year) => ({
  acronym: series.acronym,
  name: series.name,
  year,
  website: series.website,
  areas: series.areas,
  location: null,
  startDate: null,
  endDate: null,
  deadlines: { abstract: null, paper: null, notification: null, cameraReady: null },
});

const getField = (edition, field) =>
  field.startsWith('deadlines.') ? edition.deadlines[field.slice(10)] : edition[field];

function setField(edition, field, value, report) {
  const old = getField(edition, field);
  if (sameValue(field, old, value)) return false;
  if (field.startsWith('deadlines.')) {
    const key = field.slice(10);
    // A deadline that moves later is an extension; remember the original.
    if (old && value && toInstant(value) > toInstant(old)) {
      edition.extensions = { ...edition.extensions, [key]: edition.extensions?.[key] ?? old };
      report.extensions.push({ edition: label(edition), key, from: old, to: value });
    }
    edition.deadlines[key] = value;
  } else {
    edition[field] = value;
  }
  return true;
}

// Existing edition + dataset values. Fields pinned from an official page win over the dataset.
// Changes go into a per-edition log so only editions we keep get reported.
function mergeEdition(series, existing, fromDataset, logs) {
  const edition = existing ? structuredClone(existing) : emptyEdition(series, fromDataset.year);
  edition.name = series.name;
  edition.areas = series.areas;
  const report = { changes: [], extensions: [], isNew: !existing };
  logs.set(edition, report);
  if (!fromDataset) return edition;

  const pinned = new Set(edition.pinned ?? []);
  const fields = [
    'website',
    'location',
    'startDate',
    'endDate',
    ...DEADLINE_KEYS.map((k) => `deadlines.${k}`),
  ];
  for (const field of fields) {
    const value = getField(fromDataset, field);
    if (value === null || value === undefined || pinned.has(field)) continue;
    const old = getField(edition, field);
    if (setField(edition, field, value, report) && field !== 'website') {
      report.changes.push({
        edition: label(edition),
        field,
        from: old,
        to: value,
        source: 'dataset',
      });
    }
  }
  return edition;
}

const isPast = (edition, now) =>
  edition.endDate
    ? new Date(`${edition.endDate}T23:59:59-12:00`) < now
    : edition.year < now.getUTCFullYear();

// Last N past editions + all upcoming ones (or a TBD placeholder for the next edition).
function selectEditions(editions, series, now) {
  const past = editions.filter((edition) => isPast(edition, now));
  const upcoming = editions.filter((edition) => !isPast(edition, now));
  if (upcoming.length === 0) {
    const last = editions.at(-1);
    // With no data at all, start at next year; discovery fills in the site once it exists.
    const year = last ? last.year + (series.cadence ?? 1) : now.getUTCFullYear() + 1;
    upcoming.push(emptyEdition(series, year));
  }
  return [...past.slice(-PAST_EDITIONS_KEPT), ...upcoming];
}

function hasDeadlineWithinWeek(edition, now) {
  return DEADLINE_KEYS.some((key) => {
    const at = toInstant(edition.deadlines[key]);
    return at && at >= now && at - now <= 7 * DAY_MS;
  });
}

// "…/2027/…", "nsdi27", "icc2027.…": the page belongs to this edition, not the series.
function isEditionSpecific(url, year) {
  const yy = String(year).slice(-2);
  return (
    url.includes(String(year)) || new RegExp(`[a-z]${yy}(?![0-9])`, 'i').test(new URL(url).pathname)
  );
}

// abstract ≤ paper ≤ notification ≤ camera-ready, and every deadline before the conference starts.
function keepsOrder(edition, key, value) {
  const order = ['abstract', 'paper', 'notification', 'cameraReady'];
  const at = (k) => (k === key ? toInstant(value) : toInstant(edition.deadlines[k]));
  const known = order.map(at).filter(Boolean);
  if (known.some((date, i) => i > 0 && known[i - 1] > date)) return false;
  const start = edition.startDate ? new Date(`${edition.startDate}T00:00:00-12:00`) : null;
  return !start || toInstant(value) < start;
}

async function checkEditionPage(edition, state, report) {
  const url = edition.website;
  const result = await checkPage(url);
  const previous = state.pages[url];
  if (result.status !== 'ok') {
    state.pages[url] = { ...previous, status: result.status };
    if (result.status === 'broken') {
      report.broken.push({
        edition: label(edition),
        url,
        why: result.error ?? `HTTP ${result.httpStatus}`,
      });
    }
    return;
  }

  // Dates often live on a "Call for papers" / "Important dates" page: check it too.
  let text = htmlToText(result.html);
  const datesUrl = findDatesPageLink(result.html, result.finalUrl ?? url);
  if (datesUrl) {
    const datesPage = await checkPage(datesUrl);
    if (datesPage.status === 'ok') text += `\n${htmlToText(datesPage.html)}`;
  }
  const print = fingerprint(text);
  state.pages[url] = { fingerprint: print, status: 'ok' };
  if (previous?.fingerprint === print) return; // unchanged
  const firstSight = !previous?.fingerprint;

  const { confident, unclear } = extractDeadlines(text, edition.year);
  // Auto-fill only empty fields, only from an edition-specific page, only if the dates stay in
  // order. A different value for a field we already have is reported, never applied.
  const editionPage = isEditionSpecific(url, edition.year);
  let applied = 0;
  for (const [key, day] of Object.entries(confident)) {
    const current = edition.deadlines[key];
    if (aoeDay(current) === day) continue;
    const value = `${day}T23:59:59-12:00`;
    if (current) {
      if (firstSight) continue; // only a *change* on the page is worth a second look
      report.possibleChanges.push({ edition: label(edition), key, current, page: day, url });
    } else if (editionPage && keepsOrder(edition, key, value)) {
      const field = `deadlines.${key}`;
      setField(edition, field, value, report);
      edition.pinned = [...new Set([...(edition.pinned ?? []), field])];
      report.changes.push({ edition: label(edition), field, from: null, to: day, source: url });
      applied += 1;
    }
  }
  // On first sight the page is just the baseline: only its fills (if any) are reported.
  if (!firstSight && (applied === 0 || unclear.length)) {
    report.pageChanges.push({ edition: label(edition), url, unclear });
  }
}

// The next edition's site, found via the series URL pattern (only same-host, non-redirected hits).
async function discoverNextEdition(series, editions, report) {
  if (!series.editionUrl) return;
  const target = editions.find((edition) => !edition.startDate && !edition.deadlines.paper);
  if (!target) return;
  const url = fillTemplate(series.editionUrl, target.year);
  if (target.website === url) return;
  const result = await checkPage(url);
  if (result.status !== 'ok' || new URL(result.finalUrl).host !== new URL(url).host) return;
  target.website = url;
  report.newEditions.push({ edition: label(target), url });
}

async function openLinkReports() {
  if (!process.env.MONGODB_URI) return { reports: [], note: 'MONGODB_URI not set: skipped' };
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const reports = await client
      .db(process.env.DB_NAME || 'paperscape')
      .collection('linkReports')
      .find({ status: 'open' })
      .sort({ createdAt: 1 })
      .limit(50)
      .toArray();
    return { reports };
  } finally {
    await client.close();
  }
}

const show = (value) => {
  if (!value) return 'TBD';
  if (typeof value === 'object') return [value.city, value.country].filter(Boolean).join(', ');
  return /T/.test(value) ? `${aoeDay(value)} AoE` : value;
};

function summarize(report, reports, reportsNote, counts) {
  const lines = [
    '## Conference tracker updates',
    '',
    `Run: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ` +
      `${counts.editions} editions across ${counts.series} series · ${counts.checked} pages checked` +
      `${counts.weekly ? ' (weekly full check)' : ''}`,
    '',
    'Merging this PR updates the live site and resolves the broken-link reports listed below.',
  ];
  const section = (title, rows, header) => {
    if (rows.length === 0) return;
    lines.push(
      '',
      `### ${title} (${rows.length})`,
      '',
      header,
      header.replace(/[^|]/g, '-'),
      ...rows,
    );
  };
  section(
    'Date and venue changes',
    report.changes.map(
      (c) =>
        `| ${c.edition} | ${c.field.replace('deadlines.', '')} | ${show(c.from)} | **${show(c.to)}** | ${c.source === 'dataset' ? 'dataset' : `[official site](${c.source})`} |`,
    ),
    '| Conference | Field | Was | Now | Source |',
  );
  section(
    'Deadline extensions',
    report.extensions.map(
      (e) => `| ${e.edition} | ${e.key} | ${show(e.from)} | **${show(e.to)}** |`,
    ),
    '| Conference | Deadline | Original | Extended to |',
  );
  if (report.added.length) {
    lines.push('', `### Editions added from the dataset (${report.added.length})`, '');
    lines.push(report.added.join(', '));
  }
  section(
    'New editions found',
    report.newEditions.map((n) => `| ${n.edition} | ${n.url} |`),
    '| Conference | Site |',
  );
  section(
    'Possible changes: the official site shows a different date',
    report.possibleChanges.map(
      (c) => `| ${c.edition} | ${c.key} | ${show(c.current)} | ${c.page} | [page](${c.url}) |`,
    ),
    '| Conference | Deadline | We have | Page says | Source |',
  );
  if (report.pageChanges.length) {
    lines.push('', `### Pages changed: please check (${report.pageChanges.length})`, '');
    for (const p of report.pageChanges) {
      lines.push(`- **${p.edition}**: ${p.url}`);
      for (const text of p.unclear) lines.push(`  - \`${text.replace(/`/g, "'")}\``);
    }
  }
  section(
    'Broken links found by the tracker',
    report.broken.map((b) => `| ${b.edition} | ${b.url} | ${b.why} |`),
    '| Conference | Link | Problem |',
  );
  section(
    'Broken links reported on the site',
    reports.map(
      (r) =>
        `| ${r.acronym} ${r.year} | ${r.url} | ${r.reason}${r.note ? `: ${r.note.replace(/\|/g, '/')}` : ''} | ${r.createdAt.toISOString().slice(0, 10)} |`,
    ),
    '| Conference | Link | Reason | Reported |',
  );
  if (reportsNote) lines.push('', `_Site reports: ${reportsNote}_`);
  if (report.issues.length) {
    lines.push(
      '',
      '<details><summary>Data issues</summary>',
      '',
      ...report.issues.map((i) => `- ${i}`),
      '',
      '</details>',
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const now = new Date();
  const weekly = forceAll || now.getUTCDay() === 1;
  const [seriesList, current, cities, state] = await Promise.all([
    readJson(FILES.series),
    readJson(FILES.conferences),
    readJson(FILES.cities),
    readJson(FILES.state, { pages: {}, reviewedReports: [] }),
  ]);
  const report = {
    possibleChanges: [],
    added: [],
    changes: [],
    extensions: [],
    newEditions: [],
    pageChanges: [],
    broken: [],
    issues: [],
  };
  const output = [];
  let checked = 0;

  for (const series of seriesList) {
    const existing = new Map(
      current.filter((c) => c.acronym === series.acronym).map((c) => [c.year, c]),
    );
    let dataset = [];
    if (series.ccf) {
      try {
        dataset = await fetchCcfEditions(series, cities, now);
      } catch (err) {
        report.issues.push(`${series.acronym}: ${err.message}`);
      }
    }
    const datasetByYear = new Map(dataset.map((edition) => [edition.year, edition]));
    const years = [...new Set([...existing.keys(), ...datasetByYear.keys()])].sort((a, b) => a - b);
    const logs = new Map();
    const merged = years.map((year) =>
      mergeEdition(series, existing.get(year), datasetByYear.get(year), logs),
    );
    const kept = selectEditions(merged, series, now);
    for (const edition of kept) {
      report.issues.push(...(datasetByYear.get(edition.year)?.issues ?? []));
      const log = logs.get(edition);
      if (log?.isNew) report.added.push(label(edition));
      else if (log) {
        report.changes.push(...log.changes);
        report.extensions.push(...log.extensions);
      }
    }

    const upcoming = kept.filter((edition) => !isPast(edition, now));
    if (weekly) await discoverNextEdition(series, upcoming, report);
    for (const edition of upcoming) {
      if (!edition.website || !(weekly || hasDeadlineWithinWeek(edition, now))) continue;
      await checkEditionPage(edition, state, report);
      checked += 1;
    }
    output.push(...kept);
  }

  let reports = [];
  let reportsNote;
  try {
    ({ reports, note: reportsNote } = await openLinkReports());
  } catch (err) {
    reportsNote = `could not read reports (${err.message})`;
  }
  if (reports.length) state.reviewedReports = reports.map((r) => String(r._id));

  // Stable key order keeps the state file diff-free when nothing changed.
  state.pages = Object.fromEntries(
    Object.entries(state.pages).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeJson(FILES.conferences, output);
  await writeJson(FILES.state, state);
  await writeFile(
    summaryPath,
    summarize(report, reports, reportsNote, {
      editions: output.length,
      series: seriesList.length,
      checked,
      weekly,
    }),
  );
  console.log(
    `${output.length} editions · ${report.added.length} added · ${report.changes.length} changes · ${report.extensions.length} extensions · ` +
      `${report.newEditions.length} new editions · ${report.possibleChanges.length} possible changes · ` +
      `${report.pageChanges.length} pages to check · ` +
      `${report.broken.length} broken · ${reports.length} reports · summary: ${summaryPath}`,
  );
}

try {
  await main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
