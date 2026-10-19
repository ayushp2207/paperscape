import { Router } from 'express';

import { getById, reportLink, search, topicVocabulary } from '../db/papers.js';
import {
  ValidationError,
  isIntInRange,
  isObjectIdString,
  notFound,
  toObjectId,
  validator,
} from '../lib/validation.js';
import { LINK_REPORT_REASONS } from '../public/js/review/vocab.js';
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
  const cites = typeof query.cites === 'string' && query.cites ? query.cites : undefined;
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
  v.check(!cites || isObjectIdString(cites), 'cites', 'Unknown paper');
  v.check(Number.isInteger(page), 'page', 'Page must be a whole number');
  v.check(Number.isInteger(limit), 'limit', 'Limit must be a whole number');
  v.done();

  // Out-of-range paging is clamped rather than rejected.
  return {
    q,
    area,
    cites,
    yearFrom,
    yearTo,
    page: Math.max(1, page),
    limit: Math.min(MAX_LIMIT, Math.max(1, limit)),
  };
}

// With `cites=<paperId>`, only papers that cite that paper; the reply names it as `citing`.
router.get('/', async (req, res) => {
  const { cites, ...query } = parseSearchQuery(req.query);
  if (!cites) return res.json(await search(query));
  const cited = await getById(toObjectId(cites, 'Paper'));
  if (!cited) throw notFound('Paper');
  const result = await search({ ...query, citesOpenalexId: cited.openalexId });
  res.json({ ...result, citing: { _id: cited._id, title: cited.title } });
});

// Research phrases mined from the papers, for title, keyword and area suggestions in the
// review form, as compact [phrase, paperCount, areaId] rows. Same for everyone and only changes
// with a re-seed, so browsers (and any cache in front of the server) may keep it for a day.
router.get('/topics', async (_req, res) => {
  const vocabulary = await topicVocabulary();
  res.set('Cache-Control', 'public, max-age=86400');
  res.json(vocabulary.map(({ phrase, count, area }) => [phrase, count, area]));
});

router.get('/:id', async (req, res) => {
  const paper = await getById(toObjectId(req.params.id, 'Paper'));
  if (!paper) throw notFound('Paper');
  res.json(paper);
});

// Flags the paper's link (DOI, else OpenAlex page) as broken. Body: { reason }.
router.post('/:id/report-link', async (req, res) => {
  const reasons = LINK_REPORT_REASONS.map((reason) => reason.id);
  if (!reasons.includes(req.body?.reason)) {
    throw new ValidationError({ reason: 'Pick what is wrong with the link' });
  }
  const paper = await getById(toObjectId(req.params.id, 'Paper'));
  if (!paper) throw notFound('Paper');
  await reportLink(paper._id, req.ownerId, {
    reason: req.body.reason,
    url: paper.doi ?? paper.openalexUrl,
  });
  res.status(201).json({ ok: true });
});

export default router;
