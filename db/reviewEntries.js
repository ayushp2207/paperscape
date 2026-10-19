import { getDb } from './connection.js';
import { collection as papers } from './papers.js';
import { HttpError } from '../lib/validation.js';

export const collection = () => getDb().collection('reviewEntries');

const DUPLICATE_KEY = 11000;

// The paper fields an entry card needs (never the long reference list).
const PAPER_SUMMARY = {
  title: 1,
  authors: 1,
  year: 1,
  venue: 1,
  abstract: 1,
  doi: 1,
  areas: 1,
  citedByCount: 1,
  openalexUrl: 1,
};

const withPaper = [
  {
    $lookup: {
      from: 'papers',
      localField: 'paperId',
      foreignField: '_id',
      pipeline: [{ $project: PAPER_SUMMARY }],
      as: 'paper',
    },
  },
  { $unwind: '$paper' },
];

export function listForReview(reviewId, ownerId, { status } = {}) {
  const match = { reviewId, ownerId };
  if (status) match.status = status;
  return collection()
    .aggregate([{ $match: match }, { $sort: { createdAt: -1, _id: -1 } }, ...withPaper])
    .toArray();
}

async function getWithPaper(entryId, ownerId) {
  const [entry] = await collection()
    .aggregate([{ $match: { _id: entryId, ownerId } }, ...withPaper])
    .toArray();
  return entry ?? null;
}

// The unique (reviewId, paperId) index is what blocks a second add of the same paper.
export async function create(ownerId, reviewId, paperId) {
  const now = new Date();
  const doc = {
    ownerId,
    reviewId,
    paperId,
    status: 'to-read',
    relation: 'unsure',
    relevance: 3,
    notes: '',
    findings: [],
    createdAt: now,
    updatedAt: now,
  };
  try {
    const { insertedId } = await collection().insertOne(doc);
    return getWithPaper(insertedId, ownerId);
  } catch (err) {
    if (err.code === DUPLICATE_KEY) throw new HttpError(409, 'This paper is already in the review');
    throw err;
  }
}

export function update(entryId, ownerId, fields) {
  return collection().findOneAndUpdate(
    { _id: entryId, ownerId },
    { $set: { ...fields, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
}

export function remove(entryId, ownerId, session) {
  return collection().findOneAndDelete({ _id: entryId, ownerId }, { session });
}

export function removeForReview(reviewId, ownerId, session) {
  return collection().deleteMany({ reviewId, ownerId }, { session });
}

// True when every id is an entry of this review (threads may only hold the review's own papers).
export async function allInReview(entryIds, reviewId, ownerId) {
  const found = await collection().countDocuments({ _id: { $in: entryIds }, reviewId, ownerId });
  return found === entryIds.length;
}

// Status counts and latest activity for every review of an owner, in one query.
export async function summaryByReview(ownerId) {
  const rows = await collection()
    .aggregate([
      { $match: { ownerId } },
      {
        $group: {
          _id: { reviewId: '$reviewId', status: '$status' },
          count: { $sum: 1 },
          lastActivityAt: { $max: '$updatedAt' },
        },
      },
    ])
    .toArray();

  const summaries = new Map();
  for (const { _id, count, lastActivityAt } of rows) {
    const key = String(_id.reviewId);
    const summary = summaries.get(key) ?? { counts: {}, lastActivityAt };
    summary.counts[_id.status] = count;
    if (lastActivityAt > summary.lastActivityAt) summary.lastActivityAt = lastActivityAt;
    summaries.set(key, summary);
  }
  return summaries;
}

// Citation links among a review's saved papers (PROJECT_PLAN §10.5): an edge means
// the `from` entry's paper lists the `to` entry's paper in its references.
export async function citationGraph(reviewId, ownerId) {
  const entries = await collection()
    .find({ reviewId, ownerId }, { projection: { paperId: 1 } })
    .toArray();
  const saved = await papers()
    .find(
      { _id: { $in: entries.map((entry) => entry.paperId) } },
      { projection: { openalexId: 1, title: 1, year: 1, referencedWorks: 1 } },
    )
    .toArray();

  const entryIdByPaper = new Map(entries.map((entry) => [String(entry.paperId), entry._id]));
  const entryIdByOpenalex = new Map(
    saved.map((paper) => [paper.openalexId, entryIdByPaper.get(String(paper._id))]),
  );

  const nodes = saved.map((paper) => ({
    entryId: entryIdByPaper.get(String(paper._id)),
    paperId: paper._id,
    title: paper.title,
    year: paper.year,
  }));
  // OpenAlex sometimes holds a preprint and its published version as two works that cite each
  // other; a link between two copies of the same paper says nothing, so it is left out.
  const titleOf = new Map(saved.map((paper) => [paper.openalexId, paper.title.toLowerCase()]));
  const edges = saved.flatMap((paper) =>
    paper.referencedWorks
      .filter((ref) => entryIdByOpenalex.has(ref) && titleOf.get(ref) !== paper.title.toLowerCase())
      .map((ref) => ({
        from: entryIdByPaper.get(String(paper._id)),
        to: entryIdByOpenalex.get(ref),
      })),
  );
  return { nodes, edges };
}
