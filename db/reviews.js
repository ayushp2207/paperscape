import { randomUUID } from 'node:crypto';

import { getDb } from './connection.js';
import * as entries from './reviewEntries.js';
import { STATUS_IDS } from '../public/js/review/vocab.js';

export const collection = () => getDb().collection('reviews');

// A review owns its entries and threads, so changes that span both run in one transaction:
// either everything is written or nothing is (no orphaned entries, no dangling thread ids).
async function inTransaction(work) {
  const session = getDb().client.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}

function withSummary(review, summary) {
  const counts = Object.fromEntries(STATUS_IDS.map((id) => [id, summary?.counts[id] ?? 0]));
  counts.total = STATUS_IDS.reduce((sum, id) => sum + counts[id], 0);
  const entryActivity = summary?.lastActivityAt;
  return {
    ...review,
    counts,
    lastActivityAt:
      entryActivity && entryActivity > review.updatedAt ? entryActivity : review.updatedAt,
  };
}

// Two queries in total, however many reviews there are.
export async function listWithSummary(ownerId) {
  const [reviews, summaries] = await Promise.all([
    collection().find({ ownerId }).sort({ updatedAt: -1 }).toArray(),
    entries.summaryByReview(ownerId),
  ]);
  return reviews
    .map((review) => withSummary(review, summaries.get(String(review._id))))
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}

export function getOwned(id, ownerId) {
  return collection().findOne({ _id: id, ownerId });
}

export async function create(ownerId, data) {
  const now = new Date();
  const doc = { ...data, ownerId, threads: [], createdAt: now, updatedAt: now };
  const { insertedId } = await collection().insertOne(doc);
  return { _id: insertedId, ...doc };
}

export function updateOwned(id, ownerId, data) {
  return collection().findOneAndUpdate(
    { _id: id, ownerId },
    { $set: { ...data, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
}

// Deletes the review and every entry in it. Returns null if the review isn't the owner's.
export function removeOwned(id, ownerId) {
  return inTransaction(async (session) => {
    const { deletedCount } = await collection().deleteOne({ _id: id, ownerId }, { session });
    if (deletedCount === 0) return null;
    const { deletedCount: entriesRemoved } = await entries.removeForReview(id, ownerId, session);
    return { entriesRemoved };
  });
}

// Deletes an entry and takes it out of every thread of its review.
export function removeEntry(entryId, ownerId) {
  return inTransaction(async (session) => {
    const entry = await entries.remove(entryId, ownerId, session);
    if (!entry) return null;
    await collection().updateOne(
      { _id: entry.reviewId, ownerId },
      { $pull: { 'threads.$[].entryIds': entryId }, $set: { updatedAt: new Date() } },
      { session },
    );
    return entry;
  });
}

export async function addThread(reviewId, ownerId, data) {
  const thread = { id: randomUUID(), ...data };
  const { matchedCount } = await collection().updateOne(
    { _id: reviewId, ownerId },
    { $push: { threads: thread }, $set: { updatedAt: new Date() } },
  );
  return matchedCount ? thread : null;
}

export async function updateThread(reviewId, ownerId, threadId, fields) {
  const set = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [`threads.$.${key}`, value]),
  );
  const review = await collection().findOneAndUpdate(
    { _id: reviewId, ownerId, 'threads.id': threadId },
    { $set: { ...set, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  return review?.threads.find((thread) => thread.id === threadId) ?? null;
}

export async function removeThread(reviewId, ownerId, threadId) {
  const { modifiedCount } = await collection().updateOne(
    { _id: reviewId, ownerId, 'threads.id': threadId },
    { $pull: { threads: { id: threadId } }, $set: { updatedAt: new Date() } },
  );
  return modifiedCount > 0;
}
