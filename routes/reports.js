import { Router } from 'express';

import { getVisible } from '../db/conferences.js';
import { REPORT_REASONS, upsertOpenReport } from '../db/linkReports.js';
import { ValidationError, notFound, toObjectId, validator } from '../lib/validation.js';

const router = Router();

// POST /api/reports { conferenceId, reason, note? } → flags the conference's website link.
router.post('/', async (req, res) => {
  const { conferenceId, reason, note } = req.body ?? {};
  if (typeof conferenceId !== 'string') {
    throw new ValidationError({ conferenceId: 'Missing conference' });
  }
  const conference = await getVisible(toObjectId(conferenceId, 'Conference'), req.ownerId);
  if (!conference) throw notFound('Conference');

  const v = validator();
  v.check(REPORT_REASONS.includes(reason), 'reason', 'Pick what is wrong with the link');
  v.check(
    note === undefined || note === null || (typeof note === 'string' && note.length <= 500),
    'note',
    'Note is too long (max 500)',
  );
  v.check(Boolean(conference.website), 'conferenceId', 'This conference has no link to report');
  v.done();

  await upsertOpenReport(req.ownerId, conference, {
    url: conference.website,
    reason,
    note: note?.trim() || null,
  });
  res.status(201).json({ ok: true });
});

export default router;
