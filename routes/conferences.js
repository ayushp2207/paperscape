import { Router } from 'express';

import {
  DEADLINE_KEYS,
  countPlansUsing,
  create,
  deleteOwned,
  duplicate,
  getVisible,
  listVisible,
  updateOwned,
} from '../db/conferences.js';
import {
  HttpError,
  ValidationError,
  isNonEmptyString,
  notFound,
  toObjectId,
  validator,
} from '../lib/validation.js';
import { AREA_IDS } from '../public/js/shared/areas.js';
import { aoeEndOfDay, calendarDay } from '../public/js/shared/format.js';

const router = Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const asList = (value) =>
  [value]
    .flat()
    .filter(Boolean)
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);

function parseListQuery(query) {
  const v = validator();
  const areas = asList(query.area);
  const month = typeof query.month === 'string' ? query.month : undefined;
  const q = typeof query.q === 'string' ? query.q.trim() : '';

  v.check(
    areas.every((area) => AREA_IDS.includes(area)),
    'area',
    `Unknown area. Use: ${AREA_IDS.join(', ')}`,
  );
  v.check(!month || MONTH_PATTERN.test(month), 'month', 'Month must be YYYY-MM');
  v.check(q.length <= 100, 'q', 'Search text is too long');
  v.done();

  return { areas, month, q, includePast: query.past === 'true' };
}

// "YYYY-MM-DD" | null | "" → normalised string or null; undefined result = invalid.
function parseDay(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : undefined;
}

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

// Validates a create/update body and returns only the editable fields, converted for storage.
// Dates and location may be null ("TBD"). Same rules as scripts/seed-conferences.js.
function parseConferenceInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError({ body: 'Expected a JSON object' });
  }
  const v = validator();
  const { acronym, name, year, website, areas, location, startDate, endDate } = body;
  const deadlines = body.deadlines ?? {};

  v.check(isNonEmptyString(acronym, 20), 'acronym', 'Acronym is required (max 20 characters)');
  v.check(isNonEmptyString(name, 200), 'name', 'Name is required (max 200 characters)');
  v.check(
    Number.isInteger(year) && year >= 2000 && year <= 2100,
    'year',
    'Year must be between 2000 and 2100',
  );
  const hasWebsite = website !== undefined && website !== null && website !== '';
  v.check(
    !hasWebsite || (typeof website === 'string' && website.length <= 300 && isHttpUrl(website)),
    'website',
    'Website must be a full http(s) URL',
  );
  v.check(
    Array.isArray(areas) && areas.length > 0 && areas.every((area) => AREA_IDS.includes(area)),
    'areas',
    'Pick at least one research area',
  );

  const hasLocation = location !== undefined && location !== null;
  if (hasLocation) {
    const valid = typeof location === 'object' && !Array.isArray(location);
    const { city, country, venue, lat, lng } = valid ? location : {};
    v.check(valid && isNonEmptyString(city, 100), 'location.city', 'City is required');
    v.check(valid && isNonEmptyString(country, 100), 'location.country', 'Country is required');
    v.check(
      venue === undefined || venue === null || venue === '' || isNonEmptyString(venue, 150),
      'location.venue',
      'Venue is too long',
    );
    v.check(
      typeof lat === 'number' && lat >= -90 && lat <= 90,
      'location.lat',
      'Latitude must be between -90 and 90',
    );
    v.check(
      typeof lng === 'number' && lng >= -180 && lng <= 180,
      'location.lng',
      'Longitude must be between -180 and 180',
    );
  }

  v.check(typeof deadlines === 'object' && !Array.isArray(deadlines), 'deadlines', 'Invalid');
  const days = {
    startDate: parseDay(startDate),
    endDate: parseDay(endDate),
    ...Object.fromEntries(
      DEADLINE_KEYS.map((key) => [`deadlines.${key}`, parseDay(deadlines?.[key])]),
    ),
  };
  for (const [field, value] of Object.entries(days)) {
    v.check(value !== undefined, field, 'Use a valid date (YYYY-MM-DD) or leave empty');
  }

  // Plain YYYY-MM-DD strings compare correctly; null (TBD) skips the check.
  const order = [
    ['deadlines.abstract', 'deadlines.paper', 'Must be on or before the paper deadline'],
    ['deadlines.paper', 'deadlines.notification', 'Must be on or before the notification'],
    ['deadlines.notification', 'startDate', 'Must be on or before the conference starts'],
    ['startDate', 'endDate', 'Must be on or before the end date'],
  ];
  for (const [earlier, later, message] of order) {
    v.check(!(days[earlier] && days[later] && days[earlier] > days[later]), earlier, message);
  }
  v.done();

  const toDay = (value) => (value ? calendarDay(value) : null);
  const toDeadline = (value) => (value ? aoeEndOfDay(value) : null);
  return {
    acronym: acronym.trim(),
    name: name.trim(),
    year,
    website: hasWebsite ? website.trim() : null,
    areas: [...new Set(areas)],
    location: hasLocation
      ? {
          city: location.city.trim(),
          country: location.country.trim(),
          venue: location.venue?.trim() || null,
          lat: location.lat,
          lng: location.lng,
        }
      : null,
    startDate: toDay(days.startDate),
    endDate: toDay(days.endDate),
    deadlines: Object.fromEntries(
      DEADLINE_KEYS.map((key) => [key, toDeadline(days[`deadlines.${key}`])]),
    ),
  };
}

router.get('/', async (req, res) => {
  res.json(await listVisible(req.ownerId, parseListQuery(req.query)));
});

router.get('/:id', async (req, res) => {
  const conference = await getVisible(toObjectId(req.params.id, 'Conference'), req.ownerId);
  if (!conference) throw notFound('Conference');
  res.json(conference);
});

router.post('/', async (req, res) => {
  res.status(201).json(await create(req.ownerId, parseConferenceInput(req.body)));
});

router.put('/:id', async (req, res) => {
  const id = toObjectId(req.params.id, 'Conference');
  const updated = await updateOwned(id, req.ownerId, parseConferenceInput(req.body));
  if (!updated) throw notFound('Conference');
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const id = toObjectId(req.params.id, 'Conference');
  const plansUsing = await countPlansUsing(id, req.ownerId);
  if (plansUsing > 0) {
    throw new HttpError(
      409,
      `This conference is used by ${plansUsing} of your submission plans. Change those plans first.`,
    );
  }
  if (!(await deleteOwned(id, req.ownerId))) throw notFound('Conference');
  res.status(204).end();
});

router.post('/:id/duplicate', async (req, res) => {
  const copy = await duplicate(toObjectId(req.params.id, 'Conference'), req.ownerId);
  if (!copy) throw notFound('Conference');
  res.status(201).json(copy);
});

export default router;
