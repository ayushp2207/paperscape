import { Router } from 'express';

import { getById, search } from '../db/papers.js';
import { isIntInRange, notFound, toObjectId, validator } from '../lib/validation.js';
import { AREA_IDS } from '../public/js/shared/areas.js';

const router = Router();

const MIN_YEAR = 2000;
const MAX_YEAR = 2030;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 200;
const YEAR_MESSAGE = `Year must be between ${MIN_YEAR} and ${MAX_YEAR}`;

const isOptionalYear = (year) => year === undefined || isIntInRange(year, MIN_YEAR, MAX_YEAR);

// "" or missing → fallback; anything else must be a whole number (NaN otherwise, caught below).
const toInt = (value, fallback) => (value === undefined || value === '' ? fallback : Number(value));

function parseSearchQuery(query) {
  const v = validator();
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const area = typeof query.area === 'string' && query.area ? query.area : undefined;
  const yearFrom = toInt(query.yearFrom, undefined);
  const yearTo = toInt(query.yearTo, undefined);
  const page = toInt(query.page, 1);
  const limit = toInt(query.limit, 20);

  v.check(
    q.length <= MAX_QUERY_LENGTH,
    'q',
    `Search text must be at most ${MAX_QUERY_LENGTH} characters`,
  );
  v.check(!area || AREA_IDS.includes(area), 'area', `Unknown area. Use: ${AREA_IDS.join(', ')}`);
  v.check(isOptionalYear(yearFrom), 'yearFrom', YEAR_MESSAGE);
  v.check(isOptionalYear(yearTo), 'yearTo', YEAR_MESSAGE);
  v.check(
    !(yearFrom && yearTo) || yearFrom <= yearTo,
    'yearTo',
    '"To" year must not be before "From" year',
  );
  v.check(Number.isInteger(page), 'page', 'Page must be a whole number');
  v.check(Number.isInteger(limit), 'limit', 'Limit must be a whole number');
  v.done();

  // Out-of-range paging is clamped rather than rejected.
  return {
    q,
    area,
    yearFrom,
    yearTo,
    page: Math.max(1, page),
    limit: Math.min(MAX_LIMIT, Math.max(1, limit)),
  };
}

router.get('/', async (req, res) => {
  res.json(await search(parseSearchQuery(req.query)));
});

router.get('/:id', async (req, res) => {
  const paper = await getById(toObjectId(req.params.id, 'Paper'));
  if (!paper) throw notFound('Paper');
  res.json(paper);
});

export default router;
