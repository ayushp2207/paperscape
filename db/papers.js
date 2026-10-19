import { getDb } from './connection.js';
import { buildVocabulary } from '../public/js/review/topics.js';

export const collection = () => getDb().collection('papers');

// Search results and lookups never need the (long) reference list, and never expose link
// reports (they hold other browsers' ids).
const SUMMARY = { projection: { referencedWorks: 0, linkReports: 0 } };

// `citesOpenalexId` keeps only papers whose reference list includes that paper.
export async function search({ q, area, yearFrom, yearTo, page, limit, citesOpenalexId }) {
  const filter = {};
  if (q) filter.$text = { $search: q };
  if (citesOpenalexId) filter.referencedWorks = citesOpenalexId;
  if (area) filter.areas = area;
  if (yearFrom || yearTo) {
    filter.year = {};
    if (yearFrom) filter.year.$gte = yearFrom;
    if (yearTo) filter.year.$lte = yearTo;
  }
  const sort = q ? { score: { $meta: 'textScore' } } : { citedByCount: -1 };

  const [items, total] = await Promise.all([
    collection()
      .find(filter, SUMMARY)
      .sort({ ...sort, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    collection().countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

// Papers are read-only between seeds, so the vocabulary is built once per server start.
let vocabulary;
export function topicVocabulary() {
  vocabulary ??= collection()
    .find({}, { projection: { _id: 0, title: 1, abstract: 1, areas: 1 } })
    .toArray()
    .then(buildVocabulary)
    .catch((err) => {
      vocabulary = undefined;
      throw err;
    });
  return vocabulary;
}

export function getById(id) {
  return collection().findOne({ _id: id }, { projection: { linkReports: 0 } });
}

// A browser's report that a paper's link is broken; reporting again replaces its earlier one.
// Stored on the paper (the seed never overwrites this field) for a maintainer to check.
export async function reportLink(id, ownerId, { reason, url }) {
  await collection().updateOne({ _id: id }, { $pull: { linkReports: { ownerId } } });
  await collection().updateOne(
    { _id: id },
    { $push: { linkReports: { ownerId, reason, url, reportedAt: new Date() } } },
  );
}

// Upserts by OpenAlex id. A paper found under several areas keeps all of them.
export async function upsertMany(papers) {
  if (papers.length === 0) return { upsertedCount: 0, modifiedCount: 0 };
  const now = new Date();
  return collection().bulkWrite(
    papers.map(({ areas, ...paper }) => ({
      updateOne: {
        filter: { openalexId: paper.openalexId },
        update: {
          $set: { ...paper, updatedAt: now },
          $addToSet: { areas: { $each: areas } },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

// How many papers cite at least one other paper in the collection (the Citations tab needs this).
export async function citationStats() {
  const papers = await collection()
    .find({}, { projection: { _id: 0, openalexId: 1, referencedWorks: 1 } })
    .toArray();
  const ids = new Set(papers.map((paper) => paper.openalexId));
  const linked = papers.filter((paper) => paper.referencedWorks.some((ref) => ids.has(ref)));
  return { total: papers.length, linked: linked.length };
}
