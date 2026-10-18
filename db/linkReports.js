import { ObjectId } from 'mongodb';

import { getDb } from './connection.js';

export const collection = () => getDb().collection('linkReports');

export const REPORT_REASONS = ['not-loading', 'wrong-page', 'outdated', 'other'];

// One open report per browser per link; reporting again just refreshes it.
export async function upsertOpenReport(ownerId, conference, { url, reason, note }) {
  const now = new Date();
  await collection().updateOne(
    { ownerId, conferenceId: conference._id, url, status: 'open' },
    {
      $set: { reason, note, acronym: conference.acronym, year: conference.year, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function resolveReports(ids) {
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (objectIds.length === 0) return 0;
  const { modifiedCount } = await collection().updateMany(
    { _id: { $in: objectIds }, status: 'open' },
    { $set: { status: 'resolved', resolvedAt: new Date() } },
  );
  return modifiedCount;
}
