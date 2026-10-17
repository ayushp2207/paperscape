// Seeds the shared, read-only conference list from scripts/data/conferences.json.
// Re-runnable: replaces only documents with isSeed: true, never user-created conferences.
// Unknown dates/locations are null in the JSON and show as "TBD" in the UI.
import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { closeDb, connectDb } from '../db/connection.js';
import { collection } from '../db/conferences.js';
import { AREA_IDS } from '../public/js/shared/areas.js';
import { aoeEndOfDay, calendarDay } from '../public/js/shared/format.js';

dotenv.config({ quiet: true });

const DATA_FILE = path.join(import.meta.dirname, 'data', 'conferences.json');
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEADLINE_KEYS = ['abstract', 'paper', 'notification', 'cameraReady'];

function checkDate(value, label, errors) {
  if (value === null) return;
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    errors.push(`${label} must be "YYYY-MM-DD" or null`);
  }
}

function checkOrder(earlier, later, label, errors) {
  if (earlier && later && earlier > later) errors.push(label);
}

function validate(conf) {
  const errors = [];
  for (const key of ['acronym', 'name', 'website']) {
    if (typeof conf[key] !== 'string' || !conf[key].trim()) errors.push(`${key} is required`);
  }
  if (!Number.isInteger(conf.year)) errors.push('year must be an integer');
  if (!Array.isArray(conf.areas) || conf.areas.length === 0) {
    errors.push('areas must be a non-empty array');
  } else {
    const unknown = conf.areas.filter((area) => !AREA_IDS.includes(area));
    if (unknown.length) errors.push(`unknown areas: ${unknown.join(', ')}`);
  }

  if (conf.location !== null) {
    const { city, country, lat, lng } = conf.location ?? {};
    if (!city || !country) errors.push('location needs city and country (or be null)');
    if (typeof lat !== 'number' || lat < -90 || lat > 90)
      errors.push('location.lat must be -90..90');
    if (typeof lng !== 'number' || lng < -180 || lng > 180)
      errors.push('location.lng must be -180..180');
  }

  checkDate(conf.startDate, 'startDate', errors);
  checkDate(conf.endDate, 'endDate', errors);
  const deadlines = conf.deadlines ?? {};
  for (const key of DEADLINE_KEYS) checkDate(deadlines[key] ?? null, `deadlines.${key}`, errors);

  // YYYY-MM-DD strings compare correctly as plain strings.
  checkOrder(conf.startDate, conf.endDate, 'startDate is after endDate', errors);
  checkOrder(
    deadlines.abstract,
    deadlines.paper,
    'abstract deadline is after paper deadline',
    errors,
  );
  checkOrder(
    deadlines.paper,
    deadlines.notification,
    'paper deadline is after notification',
    errors,
  );
  checkOrder(
    deadlines.notification,
    conf.startDate,
    'notification is after the conference starts',
    errors,
  );

  return errors;
}

const toDay = (value) => (value ? calendarDay(value) : null);
const toDeadline = (value) => (value ? aoeEndOfDay(value) : null);

function toDocument(conf, now) {
  const deadlines = conf.deadlines ?? {};
  return {
    ownerId: null,
    isSeed: true,
    name: conf.name.trim(),
    acronym: conf.acronym.trim(),
    year: conf.year,
    areas: conf.areas,
    website: conf.website.trim(),
    location: conf.location
      ? {
          city: conf.location.city,
          country: conf.location.country,
          venue: conf.location.venue ?? null,
          lat: conf.location.lat,
          lng: conf.location.lng,
        }
      : null,
    startDate: toDay(conf.startDate),
    endDate: toDay(conf.endDate),
    deadlines: Object.fromEntries(DEADLINE_KEYS.map((key) => [key, toDeadline(deadlines[key])])),
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const conferences = JSON.parse(await readFile(DATA_FILE, 'utf8'));

  const problems = conferences
    .map((conf, i) => ({ label: conf.acronym ?? `entry #${i + 1}`, errors: validate(conf) }))
    .filter((result) => result.errors.length > 0);
  if (problems.length > 0) {
    for (const { label, errors } of problems) console.error(`✗ ${label}: ${errors.join('; ')}`);
    throw new Error(
      `${problems.length} invalid conference(s) in ${DATA_FILE}; nothing was written.`,
    );
  }

  const now = new Date();
  const docs = conferences.map((conf) => toDocument(conf, now));

  await connectDb();
  const { deletedCount } = await collection().deleteMany({ isSeed: true });
  const { insertedCount } = await collection().insertMany(docs);

  const withDates = docs.filter((doc) => doc.startDate && doc.deadlines.paper).length;
  const withLocation = docs.filter((doc) => doc.location).length;
  console.log(
    `Seeded ${insertedCount} conferences (replaced ${deletedCount}) · ` +
      `${withDates} with dates · ${withLocation} with location · ` +
      `${insertedCount - withDates} with dates TBD`,
  );
}

try {
  await main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
