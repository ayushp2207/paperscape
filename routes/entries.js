import { Router } from 'express';

import { update } from '../db/reviewEntries.js';
import { removeEntry } from '../db/reviews.js';
import {
  ValidationError,
  isIntInRange,
  isOneOf,
  notFound,
  toObjectId,
  validator,
} from '../lib/validation.js';
import { LIMITS, RELATION_IDS, STATUS_IDS } from '../public/js/review/vocab.js';

const router = Router();

const EDITABLE = ['status', 'relation', 'relevance', 'notes', 'findings'];

// Partial update: only the fields sent are validated and saved (a note saved on blur
// sends just `notes`). Blank findings are dropped rather than rejected.
function parseEntryUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError({ body: 'Expected a JSON object' });
  }
  const v = validator();
  const { status, relation, relevance, notes, findings } = body;
  const has = (field) => body[field] !== undefined;

  v.check(EDITABLE.some(has), 'body', `Send at least one of: ${EDITABLE.join(', ')}`);
  if (has('status')) {
    v.check(
      isOneOf(status, STATUS_IDS),
      'status',
      `Status must be one of: ${STATUS_IDS.join(', ')}`,
    );
  }
  if (has('relation')) {
    v.check(
      isOneOf(relation, RELATION_IDS),
      'relation',
      `Relation must be one of: ${RELATION_IDS.join(', ')}`,
    );
  }
  if (has('relevance')) {
    v.check(
      isIntInRange(relevance, LIMITS.relevanceMin, LIMITS.relevanceMax),
      'relevance',
      `Relevance must be a whole number from ${LIMITS.relevanceMin} to ${LIMITS.relevanceMax}`,
    );
  }
  if (has('notes')) {
    v.check(
      typeof notes === 'string' && notes.length <= LIMITS.notes,
      'notes',
      `Notes must be at most ${LIMITS.notes} characters`,
    );
  }
  const cleanFindings = Array.isArray(findings)
    ? findings.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : undefined;
  if (has('findings')) {
    v.check(
      Array.isArray(findings) &&
        findings.every((item) => typeof item === 'string') &&
        cleanFindings.length <= LIMITS.findings &&
        cleanFindings.every((item) => item.length <= LIMITS.finding),
      'findings',
      `Up to ${LIMITS.findings} findings, each at most ${LIMITS.finding} characters`,
    );
  }
  v.done();

  const fields = {};
  if (has('status')) fields.status = status;
  if (has('relation')) fields.relation = relation;
  if (has('relevance')) fields.relevance = relevance;
  if (has('notes')) fields.notes = notes.trim();
  if (has('findings')) fields.findings = cleanFindings;
  return fields;
}

router.put('/:entryId', async (req, res) => {
  const fields = parseEntryUpdate(req.body);
  const entry = await update(toObjectId(req.params.entryId, 'Entry'), req.ownerId, fields);
  if (!entry) throw notFound('Entry');
  res.json(entry);
});

router.delete('/:entryId', async (req, res) => {
  const removed = await removeEntry(toObjectId(req.params.entryId, 'Entry'), req.ownerId);
  if (!removed) throw notFound('Entry');
  res.status(204).end();
});

export default router;
