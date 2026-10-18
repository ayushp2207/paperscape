import { getDb } from './connection.js';

export const collection = () => getDb().collection('submissionPlans');

// Embeds the target and backup conference documents (null if missing).
const withConferences = [
  {
    $lookup: {
      from: 'conferences',
      localField: 'targetConferenceId',
      foreignField: '_id',
      as: 'target',
    },
  },
  {
    $lookup: {
      from: 'conferences',
      localField: 'backupConferenceId',
      foreignField: '_id',
      as: 'backup',
    },
  },
  {
    $set: {
      target: { $ifNull: [{ $first: '$target' }, null] },
      backup: { $ifNull: [{ $first: '$backup' }, null] },
    },
  },
];

export function listForOwner(ownerId) {
  return collection()
    .aggregate([{ $match: { ownerId } }, { $sort: { updatedAt: -1 } }, ...withConferences])
    .toArray();
}

export async function getOwned(id, ownerId) {
  const [plan] = await collection()
    .aggregate([{ $match: { _id: id, ownerId } }, ...withConferences])
    .toArray();
  return plan ?? null;
}

export async function create(ownerId, data) {
  const now = new Date();
  const { insertedId } = await collection().insertOne({
    ...data,
    ownerId,
    createdAt: now,
    updatedAt: now,
  });
  return getOwned(insertedId, ownerId);
}

export async function updateOwned(id, ownerId, data) {
  const { matchedCount } = await collection().updateOne(
    { _id: id, ownerId },
    { $set: { ...data, updatedAt: new Date() } },
  );
  return matchedCount === 1 ? getOwned(id, ownerId) : null;
}

export async function setMilestoneDone(id, ownerId, milestoneId, done) {
  const { matchedCount } = await collection().updateOne(
    { _id: id, ownerId, 'milestones.id': milestoneId },
    { $set: { 'milestones.$.done': done, updatedAt: new Date() } },
  );
  return matchedCount === 1 ? getOwned(id, ownerId) : null;
}

export async function deleteOwned(id, ownerId) {
  const { deletedCount } = await collection().deleteOne({ _id: id, ownerId });
  return deletedCount === 1;
}
