import { Router } from 'express';
import { randomUUID } from 'node:crypto';

import { getVisible } from '../db/conferences.js';
import {
  create,
  deleteOwned,
  getOwned,
  listForOwner,
  setMilestoneDone,
  updateOwned,
} from '../db/submissionPlans.js';
import {
  ValidationError,
  isNonEmptyString,
  isObjectIdString,
  notFound,
  toObjectId,
  validator,
} from '../lib/validation.js';
import { aoeEndOfDay } from '../public/js/shared/format.js';

const router = Router();

const PLAN_STATUSES = ['drafting', 'submitted', 'accepted', 'rejected', 'withdrawn'];
const MAX_MILESTONES = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidDay = (value) =>
  typeof value === 'string' &&
  DATE_PATTERN.test(value) &&
  new Date(`${value}T12:00:00Z`).toISOString().startsWith(value);

// Validates a create/update body; conference ids must be visible to this owner.
// Error keys match the form's field names, e.g. "milestones.2.label".
async function parsePlanInput(body, ownerId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError({ body: 'Expected a JSON object' });
  }
  const v = validator();
  const { paperTitle, targetConferenceId, status = 'drafting', notes } = body;
  const backupConferenceId = body.backupConferenceId || null;
  const milestones = body.milestones ?? [];

  v.check(isNonEmptyString(paperTitle, 200), 'paperTitle', 'Paper title is required (max 200)');
  v.check(isObjectIdString(targetConferenceId), 'targetConferenceId', 'Pick a target conference');
  v.check(
    backupConferenceId === null || isObjectIdString(backupConferenceId),
    'backupConferenceId',
    'Invalid backup conference',
  );
  v.check(
    !backupConferenceId || backupConferenceId !== targetConferenceId,
    'backupConferenceId',
    'Backup must be different from the target',
  );
  v.check(PLAN_STATUSES.includes(status), 'status', 'Invalid status');
  v.check(
    notes === undefined || notes === null || (typeof notes === 'string' && notes.length <= 2000),
    'notes',
    'Notes are too long (max 2000)',
  );
  v.check(
    Array.isArray(milestones) && milestones.length <= MAX_MILESTONES,
    'milestones',
    `Up to ${MAX_MILESTONES} milestones`,
  );
  if (Array.isArray(milestones)) {
    milestones.forEach((milestone, i) => {
      v.check(
        isNonEmptyString(milestone?.label, 100),
        `milestones.${i}.label`,
        'Milestone needs a label (max 100)',
      );
      v.check(isValidDay(milestone?.dueDate), `milestones.${i}.dueDate`, 'Pick a due date');
    });
  }
  v.done();

  const target = await getVisible(toObjectId(targetConferenceId, 'Conference'), ownerId);
  const backup = backupConferenceId
    ? await getVisible(toObjectId(backupConferenceId, 'Conference'), ownerId)
    : null;
  v.check(target, 'targetConferenceId', 'Target conference not found');
  v.check(!backupConferenceId || backup, 'backupConferenceId', 'Backup conference not found');
  v.done();

  const seen = new Set();
  const cleanMilestones = milestones
    .map((milestone) => {
      // Keep client ids so toggles survive edits; assign new ones when missing or duplicated.
      let id = UUID_PATTERN.test(milestone.id ?? '') ? milestone.id.toLowerCase() : randomUUID();
      if (seen.has(id)) id = randomUUID();
      seen.add(id);
      return {
        id,
        label: milestone.label.trim(),
        dueDate: aoeEndOfDay(milestone.dueDate),
        done: milestone.done === true,
      };
    })
    .sort((a, b) => a.dueDate - b.dueDate);

  return {
    paperTitle: paperTitle.trim(),
    targetConferenceId: target._id,
    backupConferenceId: backup?._id ?? null,
    status,
    notes: notes?.trim() ?? '',
    milestones: cleanMilestones,
  };
}

router.get('/', async (req, res) => {
  res.json(await listForOwner(req.ownerId));
});

router.get('/:id', async (req, res) => {
  const plan = await getOwned(toObjectId(req.params.id, 'Plan'), req.ownerId);
  if (!plan) throw notFound('Plan');
  res.json(plan);
});

router.post('/', async (req, res) => {
  res.status(201).json(await create(req.ownerId, await parsePlanInput(req.body, req.ownerId)));
});

router.put('/:id', async (req, res) => {
  const id = toObjectId(req.params.id, 'Plan');
  const plan = await updateOwned(id, req.ownerId, await parsePlanInput(req.body, req.ownerId));
  if (!plan) throw notFound('Plan');
  res.json(plan);
});

router.patch('/:id/milestones/:milestoneId', async (req, res) => {
  const { done } = req.body ?? {};
  if (typeof done !== 'boolean') throw new ValidationError({ done: 'done must be true or false' });
  const plan = await setMilestoneDone(
    toObjectId(req.params.id, 'Plan'),
    req.ownerId,
    req.params.milestoneId,
    done,
  );
  if (!plan) throw notFound('Milestone');
  res.json(plan);
});

router.delete('/:id', async (req, res) => {
  if (!(await deleteOwned(toObjectId(req.params.id, 'Plan'), req.ownerId))) {
    throw notFound('Plan');
  }
  res.status(204).end();
});

export default router;
