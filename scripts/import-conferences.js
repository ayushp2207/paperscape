// Refreshes scripts/data/conferences.json from the ccf-deadlines dataset
// (https://github.com/ccfddl/ccf-deadlines, MIT License).
//
// For each conference it keeps the last two past editions plus every upcoming edition.
// Anything the dataset doesn't have stays null ("TBD"); nothing is estimated.
// Entries for conferences not listed in SOURCES (e.g. CoLLAs) are kept untouched.
// Host-city coordinates come from scripts/data/cities.json (alias found in the place text → city).
//
// Usage: npm run import:conferences  (then: npm run seed:conferences)
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, 'data');
const CONFERENCES_FILE = path.join(DATA_DIR, 'conferences.json');
const CITIES_FILE = path.join(DATA_DIR, 'cities.json');
const RAW_BASE = 'https://raw.githubusercontent.com/ccfddl/ccf-deadlines/main/conference';
const PAST_EDITIONS_KEPT = 2;

// Our acronym → path of the conference file in the dataset.
const SOURCES = {
  NeurIPS: 'AI/nips',
  ICML: 'AI/icml',
  ICLR: 'AI/iclr',
  AAAI: 'AI/aaai',
  IJCAI: 'AI/ijcai',
  AISTATS: 'AI/aistats',
  UAI: 'AI/uai',
  COLT: 'AI/colt',
  CVPR: 'AI/cvpr',
  ICCV: 'AI/iccv',
  WACV: 'AI/wacv',
  BMVC: 'AI/bmvc',
  '3DV': 'CG/3dv',
  MICCAI: 'MX/miccai',
  ACL: 'AI/acl',
  EMNLP: 'AI/emnlp',
  NAACL: 'AI/naacl',
  KDD: 'DB/sigkdd',
  WWW: 'MX/www',
  SIGIR: 'DB/sigir',
  WSDM: 'DB/wsdm',
  ICDM: 'DB/icdm',
  'ECML-PKDD': 'DB/pkdd',
  CoRL: 'AI/corl',
  ICRA: 'AI/icra',
  IROS: 'AI/iros',
  RSS: 'AI/rss',
  AAMAS: 'AI/aamas',
  LoG: 'AI/log',
  MLSys: 'MX/mlsys',
  ACML: 'AI/acml',
};

// --- Minimal YAML reader for the dataset's simple format (maps, lists, scalars, comments). ---

function parseScalar(raw) {
  const value = raw.trim();
  if (value === '') return null;
  if (/^'.*'$/.test(value)) return value.slice(1, -1).replace(/''/g, "'");
  if (/^".*"$/.test(value)) return value.slice(1, -1);
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === '#' && (i === 0 || line[i - 1] === ' ')) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseYaml(text) {
  const lines = text
    .split('\n')
    .map((line) => stripComment(line).replace(/\s+$/, ''))
    .filter((line) => line.trim() !== '')
    .map((line) => ({ indent: line.search(/\S/), text: line.trim() }));
  let i = 0;

  function parseBlock(indent) {
    if (i >= lines.length) return null;
    return lines[i].text.startsWith('- ') ? parseList(indent) : parseMap(indent);
  }

  function parseEntry(text, map, childIndent) {
    const colon = text.indexOf(':');
    const key = text.slice(0, colon).trim();
    const rest = text.slice(colon + 1);
    if (rest.trim() !== '') map[key] = parseScalar(rest);
    else
      map[key] =
        i < lines.length && lines[i].indent > childIndent - 1 ? parseBlock(lines[i].indent) : null;
  }

  function parseMap(indent) {
    const map = {};
    while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith('- ')) {
      const { text } = lines[i];
      i += 1;
      parseEntry(text, map, indent + 1);
    }
    return map;
  }

  function parseList(indent) {
    const list = [];
    while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('- ')) {
      const itemText = lines[i].text.slice(2);
      const itemIndent = indent + 2;
      i += 1;
      if (!itemText.includes(':')) {
        list.push(parseScalar(itemText));
        continue;
      }
      const item = {};
      parseEntry(itemText, item, itemIndent + 1);
      while (
        i < lines.length &&
        lines[i].indent === itemIndent &&
        !lines[i].text.startsWith('- ')
      ) {
        const { text } = lines[i];
        i += 1;
        parseEntry(text, item, itemIndent + 1);
      }
      list.push(item);
    }
    return list;
  }

  return parseBlock(lines[0]?.indent ?? 0);
}

// --- Converting free-text dataset fields into our format. ---

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const pad = (n) => String(n).padStart(2, '0');

// "July 13-19, 2025" · "June 30 - July 3, 2026" · "December 8-10 (Sydney), December 9-11 (…), 2026"
function parseDateRange(text) {
  if (!text || /tbd/i.test(text)) return null;
  const year = Number(text.match(/(\d{4})\s*$/)?.[1]);
  if (!year) return undefined;
  const body = text.replace(/\(.*?\)/g, ' ').replace(/,?\s*\d{4}\s*$/, '');
  const days = [];
  let month = null;
  for (const token of body.match(/[A-Za-z]+|\d{1,2}/g) ?? []) {
    const monthNumber = MONTHS[token.slice(0, 3).toLowerCase()];
    if (monthNumber) month = monthNumber;
    else if (/^\d+$/.test(token) && month) days.push(`${year}-${pad(month)}-${pad(Number(token))}`);
  }
  if (days.length === 0) return undefined;
  days.sort();
  return { startDate: days[0], endDate: days[days.length - 1] };
}

function toIsoInstant(value, timezone) {
  if (!value || /tbd/i.test(String(value))) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}:\d{2}))?$/);
  if (!match) return undefined;
  const time = match[2] ?? '23:59:59';
  const tz = String(timezone ?? 'AoE').toUpperCase();
  let offset = '-12:00';
  if (tz !== 'AOE') {
    const parts = tz.match(/^UTC([+-]\d{1,2})?$/);
    if (!parts) return undefined;
    const hours = Number(parts[1] ?? 0);
    offset = hours === 0 ? 'Z' : `${hours < 0 ? '-' : '+'}${pad(Math.abs(hours))}:00`;
  }
  return `${match[1]}T${time}${offset}`;
}

// Multi-round conferences: earliest round still open, else the last round.
function pickRound(timeline, timezone, now) {
  const rounds = (timeline ?? [])
    .map((round) => ({ round, paper: toIsoInstant(round.deadline, timezone) }))
    .filter(({ paper }) => paper);
  if (rounds.length === 0) return (timeline ?? [])[0] ?? null;
  rounds.sort((a, b) => new Date(a.paper) - new Date(b.paper));
  return (rounds.find(({ paper }) => new Date(paper) > now) ?? rounds[rounds.length - 1]).round;
}

function parseLocation(place, cities) {
  if (!place || /tbd|virtual|online/i.test(place)) return null;
  const sites = place.split(';').map((site) => site.trim());
  const firstSite = sites[0];
  const cityName = Object.keys(cities)
    .filter((name) => firstSite.toLowerCase().includes(name.toLowerCase()))
    .sort(
      (a, b) =>
        firstSite.toLowerCase().indexOf(a.toLowerCase()) -
        firstSite.toLowerCase().indexOf(b.toLowerCase()),
    )[0];
  if (!cityName) return undefined;
  const { city, country, lat, lng } = cities[cityName];
  const beforeCity = firstSite.slice(0, firstSite.toLowerCase().indexOf(cityName.toLowerCase()));
  const venueParts = [beforeCity.replace(/[,\s]+$/, '').trim()].filter(Boolean);
  if (sites.length > 1) venueParts.push(`also ${sites.slice(1).join('; ')}`);
  return { city, country, venue: venueParts.join(' · ') || null, lat, lng };
}

function convertEdition(conf, base, cities, now) {
  const issues = [];
  const label = `${base.acronym} ${conf.year}`;
  const range = parseDateRange(conf.date);
  if (range === undefined) issues.push(`${label}: could not read date "${conf.date}"`);
  const location = parseLocation(conf.place, cities);
  if (location === undefined) issues.push(`${label}: no coordinates for place "${conf.place}"`);

  const round = pickRound(conf.timeline, conf.timezone, now) ?? {};
  const deadline = (key) => {
    const value = toIsoInstant(round[key], conf.timezone);
    if (value === undefined) issues.push(`${label}: could not read ${key} "${round[key]}"`);
    return value ?? null;
  };

  return {
    issues,
    acronym: base.acronym,
    name: base.name,
    year: conf.year,
    website: conf.link || base.website,
    areas: base.areas,
    location: location ?? null,
    startDate: range?.startDate ?? null,
    endDate: range?.endDate ?? null,
    deadlines: {
      abstract: deadline('abstract_deadline'),
      paper: deadline('deadline'),
      notification: deadline('decision_deadline'),
      cameraReady: null,
    },
  };
}

// Past once the end date has passed; an undated edition from an earlier year is past too.
const isPast = (edition, now) =>
  edition.endDate
    ? new Date(`${edition.endDate}T23:59:59-12:00`) < now
    : edition.year < now.getUTCFullYear();

// Placeholder for the next edition when the dataset has none yet: only the year is known.
// The year step follows the conference's own cadence (e.g. ICCV runs every 2 years).
function nextEditionPlaceholder(editions, base) {
  const [prev, last] = editions.slice(-2);
  const step = prev && last ? last.year - prev.year || 1 : 1;
  return {
    issues: [],
    acronym: base.acronym,
    name: base.name,
    year: last.year + step,
    website: new URL(last.website || base.website).origin,
    areas: base.areas,
    location: null,
    startDate: null,
    endDate: null,
    deadlines: { abstract: null, paper: null, notification: null, cameraReady: null },
  };
}

// Last N past editions + all upcoming ones (or a TBD placeholder when none is announced).
function selectEditions(editions, base, now) {
  const past = editions.filter((edition) => isPast(edition, now));
  const upcoming = editions.filter((edition) => !isPast(edition, now));
  if (upcoming.length === 0 && editions.length > 0) {
    upcoming.push(nextEditionPlaceholder(editions, base));
  }
  return [...past.slice(-PAST_EDITIONS_KEPT), ...upcoming];
}

async function fetchConference(sourcePath) {
  const response = await fetch(`${RAW_BASE}/${sourcePath}.yml`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${sourcePath}`);
  const [entry] = parseYaml(await response.text());
  return entry;
}

async function main() {
  const now = new Date();
  const existing = JSON.parse(await readFile(CONFERENCES_FILE, 'utf8'));
  const cities = JSON.parse(await readFile(CITIES_FILE, 'utf8'));
  // Name, areas and fallback website come from our curated entry (latest edition wins).
  const baseByAcronym = new Map(existing.map((conf) => [conf.acronym, conf]));
  const issues = [];
  const output = [];

  for (const [acronym, sourcePath] of Object.entries(SOURCES)) {
    const base = baseByAcronym.get(acronym);
    if (!base) throw new Error(`${acronym} is in SOURCES but missing from conferences.json`);
    const entry = await fetchConference(sourcePath);
    const editions = (entry.confs ?? [])
      .filter((conf) => Number.isInteger(conf.year))
      .sort((a, b) => a.year - b.year)
      .map((conf) => convertEdition(conf, base, cities, now));
    for (const { issues: editionIssues, ...edition } of selectEditions(editions, base, now)) {
      issues.push(...editionIssues);
      output.push(edition);
    }
  }

  const manual = existing.filter((conf) => !(conf.acronym in SOURCES));
  output.push(...manual);
  await writeFile(CONFERENCES_FILE, `${JSON.stringify(output, null, 2)}\n`);

  const withDates = output.filter((conf) => conf.startDate).length;
  console.log(
    `Wrote ${output.length} editions (${Object.keys(SOURCES).length} imported conferences, ` +
      `${manual.length} manual) · ${withDates} with dates`,
  );
  if (issues.length) {
    console.log(`\nNeeds review (${issues.length}):`);
    for (const issue of issues) console.log(`  - ${issue}`);
  }
}

try {
  await main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
