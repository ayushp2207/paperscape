import { Router } from 'express';

import { getById as getPaper } from '../db/papers.js';
import {
  addThread,
  create,
  getOwned,
  listWithSummary,
  removeOwned,
  removeThread,
  updateOwned,
  updateThread,
} from '../db/reviews.js';
import {
  allInReview,
  citationGraph,
  create as createEntry,
  listForReview,
} from '../db/reviewEntries.js';
import {
  ValidationError,
  isNonEmptyString,
  isObjectIdString,
  isOptionalString,
  notFound,
  toObjectId,
  validator,
} from '../lib/validation.js';
import { AREA_IDS } from '../public/js/shared/areas.js';
import { LIMITS, STATUS_IDS } from '../public/js/review/vocab.js';

const router = Router();

const INCLUDES = ['entries', 'citations'];

function requireObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError({ body: 'Expected a JSON object' });
  }
}

const isStringList = (value, maxItems, maxLength) =>
  Array.isArray(value) &&
  value.length <= maxItems &&
  value.every((item) => isNonEmptyString(item, maxLength));

function parseReviewInput(body) {
  requireObject(body);
  const v = validator();
  const { title, question, description, keywords, area } = body;
  v.check(
    isNonEmptyString(title, LIMITS.title),
    'title',
    `Title is required (max ${LIMITS.title} characters)`,
  );
  v.check(
    isNonEmptyString(question, LIMITS.question),
    'question',
    `Research question is required (max ${LIMITS.question} characters)`,
  );
  v.check(
    isOptionalString(description, LIMITS.description),
    'description',
    `Description must be at most ${LIMITS.description} characters`,
  );
  v.check(
    area === undefined || area === null || AREA_IDS.includes(area),
    'area',
    `Unknown area. Use: ${AREA_IDS.join(', ')}`,
  );
  v.check(
    keywords === undefined || isStringList(keywords, LIMITS.keywords, LIMITS.keyword),
    'keywords',
    `Up to ${LIMITS.keywords} keywords, each at most ${LIMITS.keyword} characters`,
  );
  v.done();

  return {
    title: title.trim(),
    question: question.trim(),
    description: (description ?? '').trim(),
    keywords: [...new Set((keywords ?? []).map((keyword) => keyword.trim()))],
    area: area ?? null,
  };
}

// `?include=entries,citations` lets the review page load everything it needs in one request.
function parseInclude(value) {
  const include = new Set(
    String(value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const unknown = [...include].filter((item) => !INCLUDES.includes(item));
  if (unknown.length) {
    throw new ValidationError({ include: `Unknown include. Use: ${INCLUDES.join(', ')}` });
  }
  return include;
}

// Threads are ordered lists of the review's own entries. Create needs a title and at least
// two papers; an update may change any subset of title, note and order.
function parseThreadInput(body, { partial }) {
  requireObject(body);
  const v = validator();
  const { title, note, entryIds } = body;
  if (!partial || title !== undefined) {
    v.check(
      isNonEmptyString(title, LIMITS.threadTitle),
      'title',
      `Thread title is required (max ${LIMITS.threadTitle} characters)`,
    );
  }
  v.check(
    isOptionalString(note, LIMITS.threadNote),
    'note',
    `Note must be at most ${LIMITS.threadNote} characters`,
  );
  if (!partial || entryIds !== undefined) {
    const ids = Array.isArray(entryIds) ? entryIds : [];
    v.check(
      ids.length >= LIMITS.minThreadPapers && ids.every(isObjectIdString),
      'entryIds',
      `A thread needs at least ${LIMITS.minThreadPapers} papers`,
    );
    v.check(
      new Set(ids).size === ids.length,
      'entryIds',
      'A paper can appear only once in a thread',
    );
  }
  v.check(
    [title, note, entryIds].some((field) => field !== undefined),
    'body',
    'Nothing to update',
  );
  v.done();

  const thread = {};
  if (title !== undefined) thread.title = title.trim();
  if (note !== undefined || !partial) thread.note = (note ?? '').trim();
  if (entryIds !== undefined) thread.entryIds = entryIds.map((id) => toObjectId(id));
  return thread;
}

async function requireReview(req) {
  const review = await getOwned(toObjectId(req.params.id, 'Review'), req.ownerId);
  if (!review) throw notFound('Review');
  return review;
}

async function requireOwnEntries(thread, review, ownerId) {
  if (thread.entryIds && !(await allInReview(thread.entryIds, review._id, ownerId))) {
    throw new ValidationError({ entryIds: 'Every paper in a thread must be saved in this review' });
  }
}

router.get('/', async (req, res) => {
  res.json(await listWithSummary(req.ownerId));
});

router.post('/', async (req, res) => {
  res.status(201).json(await create(req.ownerId, parseReviewInput(req.body)));
});

router.get('/:id', async (req, res) => {
  const include = parseInclude(req.query.include);
  const review = await requireReview(req);
  const [entries, citations] = await Promise.all([
    include.has('entries') && listForReview(review._id, req.ownerId),
    include.has('citations') && citationGraph(review._id, req.ownerId),
  ]);
  res.json({ ...review, ...(entries && { entries }), ...(citations && { citations }) });
});

router.put('/:id', async (req, res) => {
  const updated = await updateOwned(
    toObjectId(req.params.id, 'Review'),
    req.ownerId,
    parseReviewInput(req.body),
  );
  if (!updated) throw notFound('Review');
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const removed = await removeOwned(toObjectId(req.params.id, 'Review'), req.ownerId);
  if (!removed) throw notFound('Review');
  res.status(204).end();
});

router.get('/:id/entries', async (req, res) => {
  const { status } = req.query;
  if (status !== undefined && !STATUS_IDS.includes(status)) {
    throw new ValidationError({ status: `Unknown status. Use: ${STATUS_IDS.join(', ')}` });
  }
  const review = await requireReview(req);
  res.json(await listForReview(review._id, req.ownerId, { status }));
});

router.post('/:id/entries', async (req, res) => {
  requireObject(req.body);
  if (!isObjectIdString(req.body.paperId)) {
    throw new ValidationError({ paperId: 'A valid paperId is required' });
  }
  const review = await requireReview(req);
  const paper = await getPaper(toObjectId(req.body.paperId, 'Paper'));
  if (!paper) throw notFound('Paper');
  res.status(201).json(await createEntry(req.ownerId, review._id, paper._id));
});

router.get('/:id/citations', async (req, res) => {
  const review = await requireReview(req);
  res.json(await citationGraph(review._id, req.ownerId));
});

router.post('/:id/threads', async (req, res) => {
  const thread = parseThreadInput(req.body, { partial: false });
  const review = await requireReview(req);
  await requireOwnEntries(thread, review, req.ownerId);
  res.status(201).json(await addThread(review._id, req.ownerId, thread));
});

router.put('/:id/threads/:threadId', async (req, res) => {
  const fields = parseThreadInput(req.body, { partial: true });
  const review = await requireReview(req);
  await requireOwnEntries(fields, review, req.ownerId);
  const thread = await updateThread(review._id, req.ownerId, req.params.threadId, fields);
  if (!thread) throw notFound('Thread');
  res.json(thread);
});

router.delete('/:id/threads/:threadId', async (req, res) => {
  const review = await requireReview(req);
  if (!(await removeThread(review._id, req.ownerId, req.params.threadId))) {
    throw notFound('Thread');
  }
  res.status(204).end();
});

export default router;
