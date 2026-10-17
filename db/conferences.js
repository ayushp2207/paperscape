import { getDb } from './connection.js';
import { collection as plans } from './submissionPlans.js';
import { escapeRegex } from '../lib/validation.js';

export const collection = () => getDb().collection('conferences');

export const DEADLINE_KEYS = ['abstract', 'paper', 'notification', 'cameraReady'];

// Seeded conferences (ownerId: null) are visible to everyone; user-created ones only to their owner.
const visibleTo = (ownerId) => ({ $or: [{ ownerId: null }, { ownerId }] });

// Month boundaries in AoE (UTC-12) so a deadline on the last day of a month stays in that month.
function monthRange(month) {
  const [year, m] = month.split('-').map(Number);
  const next = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
  return {
    $gte: new Date(`${month}-01T00:00:00-12:00`),
    $lt: new Date(`${next}-01T00:00:00-12:00`),
  };
}

// Next upcoming deadline, else start date, else Infinity (dates TBD sort last).
function sortKey(conf, now) {
  const upcoming = DEADLINE_KEYS.map((key) => conf.deadlines?.[key])
    .filter((date) => date && date > now)
    .map((date) => date.getTime());
  if (upcoming.length) return Math.min(...upcoming);
  return conf.startDate ? conf.startDate.getTime() : Infinity;
}

export async function listVisible(ownerId, { areas = [], month, q, includePast = false }) {
  const now = new Date();
  const and = [visibleTo(ownerId)];

  if (areas.length) and.push({ areas: { $in: areas } });
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ acronym: pattern }, { name: pattern }, { 'location.city': pattern }] });
  }
  if (month) {
    const range = monthRange(month);
    and.push({
      $or: [
        { startDate: range },
        { endDate: range },
        ...DEADLINE_KEYS.map((key) => ({ [`deadlines.${key}`]: range })),
      ],
    });
  }
  // A conference with no end date (TBD) still counts as upcoming.
  if (!includePast) and.push({ $or: [{ endDate: null }, { endDate: { $gte: now } }] });

  const conferences = await collection().find({ $and: and }).toArray();
  return conferences.sort(
    (a, b) => sortKey(a, now) - sortKey(b, now) || a.acronym.localeCompare(b.acronym),
  );
}

export function getVisible(id, ownerId) {
  return collection().findOne({ _id: id, ...visibleTo(ownerId) });
}

export async function create(ownerId, data) {
  const now = new Date();
  const doc = { ...data, ownerId, isSeed: false, createdAt: now, updatedAt: now };
  const { insertedId } = await collection().insertOne(doc);
  return { _id: insertedId, ...doc };
}

// Only the owner's own conferences can change; seeded ones never match.
export function updateOwned(id, ownerId, data) {
  return collection().findOneAndUpdate(
    { _id: id, ownerId },
    { $set: { ...data, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
}

export async function deleteOwned(id, ownerId) {
  const { deletedCount } = await collection().deleteOne({ _id: id, ownerId });
  return deletedCount === 1;
}

export function countPlansUsing(id, ownerId) {
  return plans().countDocuments({
    ownerId,
    $or: [{ targetConferenceId: id }, { backupConferenceId: id }],
  });
}

export async function duplicate(id, ownerId) {
  const source = await getVisible(id, ownerId);
  if (!source) return null;
  const { acronym, name, year, website, areas, location, startDate, endDate, deadlines } = source;
  return create(ownerId, {
    acronym,
    name: `${name} (my copy)`,
    year,
    website,
    areas,
    location,
    startDate,
    endDate,
    deadlines,
  });
}
